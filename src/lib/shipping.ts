// FedEx 계약 운임 v2 (할인 기반 모델)
//
// 정책
// - 원산지: 한국 (계약: ALLPACKMEISTER CO., LTD. account 210839884, 2520066223-100)
// - 청구 공식:
//     final_krw = list_rate_krw × (1 - contract_discount/100) × (1 - automation_bonus/100)
//     billable_usd = final_krw × krw→usd × (1 + vat_markup/100)
// - rate_usd 가 직접 설정되어 있으면 그 값 사용 (수동 입력 케이스)
// - 어느 항목도 없으면 fallback_rate_usd
// - 자동 서비스 선택: 가장 싼 서비스를 무게 기반으로 자동 picking

import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate, krwToUsd } from '@/lib/exchange-rate'
import { fetchFedexRates, fedexServiceToInternalCode, isFedexApiConfigured } from '@/lib/fedex-api'

const DEFAULT_VAT_MARKUP_PCT = 10
const DEFAULT_FALLBACK_USD = 35

const FALLBACK_ZONES: { code: string; nameEn: string; countries: string[]; baseUsd: number }[] = [
  { code: 'A', nameEn: 'Japan',                  countries: ['JP'],                                                           baseUsd: 18 },
  { code: 'D', nameEn: 'US & Canada',            countries: ['US', 'CA'],                                                      baseUsd: 15 },
  { code: 'E', nameEn: 'China',                  countries: ['CN'],                                                            baseUsd: 22 },
  { code: 'F', nameEn: 'HK / Macao',             countries: ['HK', 'MO'],                                                      baseUsd: 22 },
  { code: 'G', nameEn: 'Taiwan',                 countries: ['TW'],                                                            baseUsd: 22 },
  { code: 'I', nameEn: 'SE Asia',                countries: ['SG', 'TH', 'MY', 'PH', 'ID', 'VN'],                              baseUsd: 25 },
  { code: 'K', nameEn: 'Europe (W)',             countries: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'IE'],                  baseUsd: 32 },
  { code: 'P', nameEn: 'Australia & NZ',         countries: ['AU', 'NZ'],                                                       baseUsd: 30 },
]

export interface ShippingQuote {
  costUsd: number             // 고객 청구 금액 (FedEx 원가 + VAT)
  baseCostUsd: number         // 원가 (할인+보너스 반영 후, VAT 미적용)
  markupPct: number
  zoneCode: string
  zoneNameEn: string
  serviceCode: string | null
  serviceNameEn: string | null
  weightKg: number
  contractDiscountPct: number | null
  automationBonusPct: number | null
  listRateKrw: number | null
  isFallback: boolean
  reason:
    | 'fedex_api'
    | 'computed_from_contract'
    | 'direct_rate_usd'
    | 'fallback_no_rate'
    | 'fallback_no_zone'
    | 'fallback_no_list_price'
    | 'fallback_api_error'
}

// 단순 in-memory 캐시: (country|postal|weight_bracket|service) → quote, 24h TTL
interface CacheEntry { quote: ShippingQuote; expiresAt: number }
const RATE_CACHE = new Map<string, CacheEntry>()
const RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function cacheKey(country: string, postal: string, weightKg: number, serviceCode: string | undefined): string {
  const bracket = bucketWeightKg(weightKg)
  return `${country.toUpperCase()}|${postal}|${bracket}|${serviceCode ?? 'AUTO'}`
}

function bucketWeightKg(weightKg: number): number {
  const brackets = [0.5, 2.5, 5, 10, 20.5, 44.5, 70.5, 99, 299, 499, 999]
  return brackets.find((b) => weightKg <= b) ?? 9999
}

// ===== 동기 fallback (페이지 견적용) =====
export function getShippingCost(countryCode: string): number {
  const zone = matchFallbackZone(countryCode)
  return Math.round(zone.baseUsd * (1 + DEFAULT_VAT_MARKUP_PCT / 100) * 100) / 100
}

export function getShippingZoneName(countryCode: string): string {
  const zone = matchFallbackZone(countryCode)
  return `Zone ${zone.code} - ${zone.nameEn}`
}

function matchFallbackZone(countryCode: string) {
  const upper = countryCode.toUpperCase()
  return FALLBACK_ZONES.find((z) => z.countries.includes(upper)) ?? FALLBACK_ZONES[FALLBACK_ZONES.length - 1]
}

// ===== 메인 quote: FedEx API 우선, 실패 시 DB 계약식 fallback =====
export async function quoteShipping(
  countryCode: string,
  weightKg: number,
  serviceCode?: string,
  recipientPostal?: string,
): Promise<ShippingQuote> {
  const supabase = createServerClient()
  const upperCountry = countryCode.toUpperCase()
  const effectiveWeight = weightKg > 0 ? weightKg : 0.5

  // 1) FedEx API 우선 시도 (자격 설정 + 캐시 미스 시)
  if (isFedexApiConfigured()) {
    const key = cacheKey(upperCountry, recipientPostal ?? '', effectiveWeight, serviceCode)
    const cached = RATE_CACHE.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.quote
    }
    try {
      const { data: cfg } = await supabase.from('print_shipping_config').select('vat_markup_percent').eq('id', 1).maybeSingle()
      const markupPct = Number(cfg?.vat_markup_percent ?? DEFAULT_VAT_MARKUP_PCT)
      const apiResult = await fetchFedexRates({
        recipientCountryCode: upperCountry,
        recipientPostalCode: recipientPostal ?? '00000',
        recipientCity: 'CITY',
        weightKg: effectiveWeight,
        preferredService: mapPreferredService(serviceCode),
      })
      if (apiResult.cheapest) {
        const baseUsd = apiResult.cheapest.totalNetCharge
        const quote: ShippingQuote = {
          costUsd: Math.round(baseUsd * (1 + markupPct / 100) * 100) / 100,
          baseCostUsd: Math.round(baseUsd * 100) / 100,
          markupPct,
          zoneCode: 'API',
          zoneNameEn: 'FedEx live rate',
          serviceCode: fedexServiceToInternalCode(apiResult.cheapest.serviceType),
          serviceNameEn: apiResult.cheapest.serviceName,
          weightKg: effectiveWeight,
          contractDiscountPct: null,
          automationBonusPct: null,
          listRateKrw: null,
          isFallback: false,
          reason: 'fedex_api',
        }
        RATE_CACHE.set(key, { quote, expiresAt: Date.now() + RATE_CACHE_TTL_MS })
        return quote
      }
      // alerts 있고 cheapest 없음 → DB fallback 로 진입
    } catch {
      // API 오류 → DB fallback (로그는 silent — checkout 깨뜨리지 않음)
    }
  }

  // 2) DB 계약식 (이전 구현 그대로)

  const [{ data: config }, { data: zone }] = await Promise.all([
    supabase.from('print_shipping_config').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('print_shipping_zones')
      .select('id, code, name_en, countries, is_active')
      .contains('countries', [upperCountry])
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const markupPct = Number(config?.vat_markup_percent ?? DEFAULT_VAT_MARKUP_PCT)
  const fallbackUsd = Number(config?.fallback_rate_usd ?? DEFAULT_FALLBACK_USD)
  const autoPick = config?.auto_pick_service !== false

  if (!zone) {
    return fallbackQuote('OTHER', 'Other (no zone match)', fallbackUsd, markupPct, effectiveWeight, null, 'fallback_no_zone')
  }

  const krwPerUsd = Number(config?.krw_per_usd_override ?? 0) || await getKrwToUsdRate()

  // 후보 서비스 결정
  const wantedCode = serviceCode ?? (autoPick ? null : 'fedex_ip')
  const candidates = await loadCandidateServices(wantedCode)
  if (!candidates.length) {
    return fallbackQuote(zone.code, zone.name_en, fallbackUsd, markupPct, effectiveWeight, null, 'fallback_no_rate')
  }

  // 각 후보별 견적 계산 → 가장 싼 것 선택
  const today = new Date().toISOString().slice(0, 10)
  const quotes: (ShippingQuote & { _krw: number })[] = []
  for (const svc of candidates) {
    const q = await quoteForService(supabase, zone, svc, effectiveWeight, krwPerUsd, markupPct, fallbackUsd, today)
    if (q) quotes.push(q)
  }

  if (!quotes.length) {
    return fallbackQuote(zone.code, zone.name_en, fallbackUsd, markupPct, effectiveWeight, null, 'fallback_no_rate')
  }

  // 가장 싼 KRW 기준 선택 (자동 서비스 선택 활성화 시)
  quotes.sort((a, b) => a._krw - b._krw)
  const best = quotes[0]
  const { _krw, ...quote } = best
  void _krw
  return quote
}

interface ServiceRow {
  id: string
  code: string
  name_en: string
  is_active: boolean
}

async function loadCandidateServices(wantedCode: string | null): Promise<ServiceRow[]> {
  const supabase = createServerClient()
  if (wantedCode) {
    const { data } = await supabase
      .from('print_shipping_services')
      .select('id, code, name_en, is_active')
      .eq('code', wantedCode)
      .eq('is_active', true)
    return (data ?? []) as ServiceRow[]
  }
  // auto-pick: IP, IE, IP Pak, IP Envelope 만 후보 (Freight 은 무게 자동 진입)
  const { data } = await supabase
    .from('print_shipping_services')
    .select('id, code, name_en, is_active')
    .in('code', ['fedex_ip', 'fedex_ie', 'fedex_ipe', 'fedex_ip_pak', 'fedex_ipe_pak', 'fedex_ip_env', 'fedex_ipe_env'])
    .eq('is_active', true)
  return (data ?? []) as ServiceRow[]
}

async function quoteForService(
  supabase: ReturnType<typeof createServerClient>,
  zone: { id: string; code: string; name_en: string },
  service: ServiceRow,
  weightKg: number,
  krwPerUsd: number,
  markupPct: number,
  fallbackUsd: number,
  today: string,
): Promise<(ShippingQuote & { _krw: number }) | null> {
  const { data: rates } = await supabase
    .from('print_shipping_rates')
    .select('weight_kg_max, rate_usd, discount_pct, list_rate_krw, automation_bonus_pct, effective_from, effective_to')
    .eq('zone_id', zone.id)
    .eq('service_id', service.id)
    .lte('effective_from', today)
    .order('weight_kg_max', { ascending: true })

  const active = (rates ?? []).filter((r) => !r.effective_to || r.effective_to >= today)
  const matched = active.find((r) => Number(r.weight_kg_max) >= weightKg) ?? active[active.length - 1]
  if (!matched) return null

  // 자동발송시스템 보너스 (서비스별)
  const { data: bonusRow } = await supabase
    .from('print_shipping_service_bonuses')
    .select('bonus_pct')
    .eq('service_id', service.id)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  const automationBonusPct = Number(matched.automation_bonus_pct ?? 0) || Number(bonusRow?.bonus_pct ?? 0)
  const discountPct = matched.discount_pct == null ? null : Number(matched.discount_pct)
  const listRateKrw = matched.list_rate_krw == null ? null : Number(matched.list_rate_krw)
  const directRateUsd = Number(matched.rate_usd ?? 0)

  let baseUsd: number
  let reason: ShippingQuote['reason']
  let finalKrw = 0

  if (listRateKrw && discountPct != null) {
    finalKrw = listRateKrw * (1 - discountPct / 100) * (1 - automationBonusPct / 100)
    baseUsd = krwToUsd(finalKrw, krwPerUsd)
    reason = 'computed_from_contract'
  } else if (directRateUsd > 0) {
    baseUsd = directRateUsd
    finalKrw = directRateUsd / krwPerUsd
    reason = 'direct_rate_usd'
  } else if (discountPct != null) {
    // 할인은 있지만 list_rate_krw 미입력 → fallback
    baseUsd = fallbackUsd
    finalKrw = fallbackUsd / krwPerUsd
    reason = 'fallback_no_list_price'
  } else {
    return null
  }

  const costUsd = Math.round(baseUsd * (1 + markupPct / 100) * 100) / 100

  return {
    costUsd,
    baseCostUsd: Math.round(baseUsd * 100) / 100,
    markupPct,
    zoneCode: zone.code,
    zoneNameEn: zone.name_en,
    serviceCode: service.code,
    serviceNameEn: service.name_en,
    weightKg,
    contractDiscountPct: discountPct,
    automationBonusPct: automationBonusPct || null,
    listRateKrw: listRateKrw,
    isFallback: reason !== 'computed_from_contract' && reason !== 'direct_rate_usd',
    reason,
    _krw: finalKrw,
  }
}

function fallbackQuote(
  zoneCode: string,
  zoneNameEn: string,
  fallbackUsd: number,
  markupPct: number,
  weightKg: number,
  serviceCode: string | null,
  reason: ShippingQuote['reason'],
): ShippingQuote {
  return {
    costUsd: Math.round(fallbackUsd * (1 + markupPct / 100) * 100) / 100,
    baseCostUsd: fallbackUsd,
    markupPct,
    zoneCode,
    zoneNameEn,
    serviceCode,
    serviceNameEn: null,
    weightKg,
    contractDiscountPct: null,
    automationBonusPct: null,
    listRateKrw: null,
    isFallback: true,
    reason,
  }
}

function mapPreferredService(serviceCode?: string): 'INTERNATIONAL_PRIORITY' | 'INTERNATIONAL_ECONOMY' | undefined {
  if (!serviceCode) return undefined
  if (serviceCode === 'fedex_ip') return 'INTERNATIONAL_PRIORITY'
  if (serviceCode === 'fedex_ie') return 'INTERNATIONAL_ECONOMY'
  return undefined
}

export interface OrderWeightItem {
  quantity: number
  default_weight_kg?: number | null
  unit_weight_g?: number | null
  selected_options?: Record<string, string> | null
}

/**
 * 주문 총 무게(kg) 계산.
 * 우선순위:
 *   1) unit_weight_g × piece_count
 *      piece_count = selected_options.quantity (있으면)
 *                 또는 it.quantity (체크아웃 라우트는 이미 pieceCount 를 넣음)
 *   2) default_weight_kg × it.quantity (legacy)
 *   3) 0.5kg
 */
export function calculateOrderWeightKg(items: OrderWeightItem[]): number {
  return items.reduce((sum, it) => {
    const orderQty = it.quantity ?? 1
    const unitG = Number(it.unit_weight_g ?? 0)
    if (unitG > 0) {
      const optionQty = parseQuantityOption(it.selected_options?.quantity)
      const pieceCount = optionQty > 0 ? optionQty : orderQty
      return sum + (unitG * pieceCount) / 1000
    }
    return sum + Number(it.default_weight_kg ?? 0.5) * orderQty
  }, 0)
}

/** "500" / "500매" / "500 sheets" 등에서 숫자만 추출 */
function parseQuantityOption(value: string | undefined): number {
  if (!value) return 0
  const match = String(value).match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

// 레거시 export
export const SHIPPING_ZONES = FALLBACK_ZONES.map((z) => ({
  name: `Zone ${z.code} - ${z.nameEn}`,
  baseUsd: z.baseUsd,
  countries: z.countries,
}))
