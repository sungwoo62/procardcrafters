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
import { estimateItemWeight, pickBox, boxDimsCmForWeight } from '@/lib/weight-estimate'

const DEFAULT_VAT_MARKUP_PCT = 10
const DEFAULT_FALLBACK_USD = 35

// FedEx API 응답 금액을 USD 로 환산.
// 계약 계정(KR)은 preferredCurrency:USD 요청에도 KRW 로 응답하므로,
// currency 가 USD 가 아니면 환율(usdPerKrw)로 환산한다.
function toUsd(amount: number, currency: string | undefined, usdPerKrw: number): number {
  if (!currency || currency.toUpperCase() === 'USD') return amount
  // 현재 계약 통화는 KRW 한 종류. 그 외 통화는 KRW 와 동일 처리(안전한 환산).
  return krwToUsd(amount, usdPerKrw)
}

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
  // 서비스 설명 (print_shipping_services 또는 FedEx API에서 조회)
  descriptionEn?: string | null
  descriptionKo?: string | null
  transitTimeLabelEn?: string | null
  transitTimeLabelKo?: string | null
  deliveryDayOfWeek?: string | null
  deliveryTimestamp?: string | null
}

export interface ShippingQuoteOptions {
  options: ShippingQuote[]
  defaultOptionIndex: number
}

// 단순 in-memory 캐시: (country|postal|weight_bracket|service) → quote, 24h TTL
interface CacheEntry { quote: ShippingQuote; expiresAt: number }
const RATE_CACHE = new Map<string, CacheEntry>()
const RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface OptionsCacheEntry { options: ShippingQuote[]; expiresAt: number }
const OPTIONS_CACHE = new Map<string, OptionsCacheEntry>()

function cacheKey(country: string, postal: string, weightKg: number, serviceCode: string | undefined): string {
  const bracket = bucketWeightKg(weightKg)
  return `${country.toUpperCase()}|${postal}|${bracket}|${serviceCode ?? 'AUTO'}`
}

function optionsCacheKey(country: string, postal: string, weightKg: number): string {
  const bracket = bucketWeightKg(weightKg)
  return `OPT|${country.toUpperCase()}|${postal}|${bracket}`
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
      const { data: cfg } = await supabase.from('print_shipping_config').select('vat_markup_percent, krw_per_usd_override').eq('id', 1).maybeSingle()
      const markupPct = Number(cfg?.vat_markup_percent ?? DEFAULT_VAT_MARKUP_PCT)
      const override = Number(cfg?.krw_per_usd_override ?? 0)
      const usdPerKrw = override > 0 ? 1 / override : await getKrwToUsdRate()
      const apiResult = await fetchFedexRates({
        recipientCountryCode: upperCountry,
        recipientPostalCode: recipientPostal ?? '00000',
        recipientCity: 'CITY',
        weightKg: effectiveWeight,
        // OMO-3458: 무게에 맞는 박스 치수를 함께 넘겨 FedEx 부피무게(dimensional weight) 반영.
        ...boxDimsCmForWeight(effectiveWeight),
        preferredService: mapPreferredService(serviceCode),
      })
      if (apiResult.cheapest) {
        // FedEx 계약 계정(KR)은 preferredCurrency:USD 요청에도 KRW 로 응답한다.
        // USD 가 아니면 환율로 환산해야 한다 (미환산 시 1500배 과다 청구).
        const baseUsd = toUsd(apiResult.cheapest.totalNetCharge, apiResult.cheapest.currency, usdPerKrw)
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
  description_en?: string | null
  description_ko?: string | null
  transit_time_label_en?: string | null
  transit_time_label_ko?: string | null
}

const SERVICE_SELECT = 'id, code, name_en, is_active, description_en, description_ko, transit_time_label_en, transit_time_label_ko'
const AUTO_SERVICE_CODES = ['fedex_ip', 'fedex_ie', 'fedex_ipe', 'fedex_ip_pak', 'fedex_ipe_pak', 'fedex_ip_env', 'fedex_ipe_env']

async function loadCandidateServices(wantedCode: string | null): Promise<ServiceRow[]> {
  const supabase = createServerClient()
  if (wantedCode) {
    const { data } = await supabase
      .from('print_shipping_services')
      .select(SERVICE_SELECT)
      .eq('code', wantedCode)
      .eq('is_active', true)
    return (data ?? []) as ServiceRow[]
  }
  // auto-pick: IP, IE, IP Pak, IP Envelope 만 후보 (Freight 은 무게 자동 진입)
  const { data } = await supabase
    .from('print_shipping_services')
    .select(SERVICE_SELECT)
    .in('code', AUTO_SERVICE_CODES)
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
    descriptionEn: service.description_en ?? null,
    descriptionKo: service.description_ko ?? null,
    transitTimeLabelEn: service.transit_time_label_en ?? null,
    transitTimeLabelKo: service.transit_time_label_ko ?? null,
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

// ===== 모든 배송 옵션 배열 반환 (고객 선택 UI용) =====
export async function quoteShippingOptions(
  countryCode: string,
  weightKg: number,
  recipientPostal?: string,
): Promise<ShippingQuoteOptions> {
  const supabase = createServerClient()
  const upperCountry = countryCode.toUpperCase()
  const effectiveWeight = weightKg > 0 ? weightKg : 0.5

  if (isFedexApiConfigured()) {
    const key = optionsCacheKey(upperCountry, recipientPostal ?? '', effectiveWeight)
    const cached = OPTIONS_CACHE.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return { options: cached.options, defaultOptionIndex: 0 }
    }
    try {
      const { data: cfg } = await supabase
        .from('print_shipping_config')
        .select('vat_markup_percent, krw_per_usd_override')
        .eq('id', 1)
        .maybeSingle()
      const markupPct = Number(cfg?.vat_markup_percent ?? DEFAULT_VAT_MARKUP_PCT)
      const override = Number(cfg?.krw_per_usd_override ?? 0)
      const usdPerKrw = override > 0 ? 1 / override : await getKrwToUsdRate()
      const apiResult = await fetchFedexRates({
        recipientCountryCode: upperCountry,
        recipientPostalCode: recipientPostal ?? '00000',
        recipientCity: 'CITY',
        weightKg: effectiveWeight,
        // OMO-3458: 무게에 맞는 박스 치수를 함께 넘겨 FedEx 부피무게(dimensional weight) 반영.
        ...boxDimsCmForWeight(effectiveWeight),
      })
      if (apiResult.options.length > 0) {
        const allCodes = apiResult.options.map((o) => fedexServiceToInternalCode(o.serviceType))
        const { data: services } = await supabase
          .from('print_shipping_services')
          .select('code, description_en, description_ko, transit_time_label_en, transit_time_label_ko')
          .in('code', allCodes)
        const svcMap = new Map(services?.map((s) => [s.code, s]) ?? [])

        const options: ShippingQuote[] = apiResult.options.map((opt) => {
          // KRW 응답 → USD 환산 (quoteShipping 과 동일)
          const baseUsd = toUsd(opt.totalNetCharge, opt.currency, usdPerKrw)
          const code = fedexServiceToInternalCode(opt.serviceType)
          const svc = svcMap.get(code)
          return {
            costUsd: Math.round(baseUsd * (1 + markupPct / 100) * 100) / 100,
            baseCostUsd: Math.round(baseUsd * 100) / 100,
            markupPct,
            zoneCode: 'API',
            zoneNameEn: 'FedEx live rate',
            serviceCode: code,
            serviceNameEn: opt.serviceName,
            weightKg: effectiveWeight,
            contractDiscountPct: null,
            automationBonusPct: null,
            listRateKrw: null,
            isFallback: false,
            reason: 'fedex_api' as const,
            descriptionEn: svc?.description_en ?? null,
            descriptionKo: svc?.description_ko ?? null,
            transitTimeLabelEn: svc?.transit_time_label_en ?? null,
            transitTimeLabelKo: svc?.transit_time_label_ko ?? null,
            deliveryDayOfWeek: opt.deliveryDayOfWeek ?? null,
            deliveryTimestamp: opt.deliveryTimestamp ?? null,
          }
        })
        options.sort((a, b) => a.costUsd - b.costUsd)
        OPTIONS_CACHE.set(key, { options, expiresAt: Date.now() + RATE_CACHE_TTL_MS })
        return { options, defaultOptionIndex: 0 }
      }
    } catch {
      // fall through to DB fallback
    }
  }

  // DB fallback: 모든 후보 서비스 견적 → 배열 반환
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

  if (!zone) {
    return {
      options: [fallbackQuote('OTHER', 'Other (no zone match)', fallbackUsd, markupPct, effectiveWeight, null, 'fallback_no_zone')],
      defaultOptionIndex: 0,
    }
  }

  const krwPerUsd = Number(config?.krw_per_usd_override ?? 0) || await getKrwToUsdRate()
  const candidates = await loadCandidateServices(null)
  if (!candidates.length) {
    return {
      options: [fallbackQuote(zone.code, zone.name_en, fallbackUsd, markupPct, effectiveWeight, null, 'fallback_no_rate')],
      defaultOptionIndex: 0,
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const quotes: (ShippingQuote & { _krw: number })[] = []
  for (const svc of candidates) {
    const q = await quoteForService(supabase, zone, svc, effectiveWeight, krwPerUsd, markupPct, fallbackUsd, today)
    if (q) quotes.push(q)
  }

  if (!quotes.length) {
    return {
      options: [fallbackQuote(zone.code, zone.name_en, fallbackUsd, markupPct, effectiveWeight, null, 'fallback_no_rate')],
      defaultOptionIndex: 0,
    }
  }

  quotes.sort((a, b) => a._krw - b._krw)
  const options: ShippingQuote[] = quotes.map(({ _krw, ...q }) => { void _krw; return q })
  return { options, defaultOptionIndex: 0 }
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
  // OMO-3190: 평량(gsm) + 재단치수(mm)가 있으면 물리 산식(gsm × 면적 × 수량)으로
  // 종이 무게를 직접 산출한다. 없으면 unit_weight_g/default_weight_kg fallback.
  basis_weight_gsm?: number | null
  sheet_width_mm?: number | null
  sheet_height_mm?: number | null
}

/** 품목별 "내용물(종이) 무게"(g) — 박스 tare 미포함. */
function itemContentWeightG(it: OrderWeightItem): number {
  const orderQty = it.quantity ?? 1
  const optionQty = parseQuantityOption(it.selected_options?.quantity)
  const pieceCount = optionQty > 0 ? optionQty : orderQty

  // 1) 물리 산식: 평량 + 재단치수가 있으면 gsm × 면적 × 수량 (OMO-3190)
  const gsm = Number(it.basis_weight_gsm ?? 0)
  if (gsm > 0) {
    const { paperWeightG } = estimateItemWeight({
      gsm,
      sheetWidthMm: it.sheet_width_mm ?? null,
      sheetHeightMm: it.sheet_height_mm ?? null,
      quantity: pieceCount,
    })
    return paperWeightG
  }
  // 2) 정적 1매 무게 × 수량
  const unitG = Number(it.unit_weight_g ?? 0)
  if (unitG > 0) return unitG * pieceCount
  // 3) legacy default_weight_kg × 주문수량
  return Number(it.default_weight_kg ?? 0.5) * orderQty * 1000
}

/**
 * 주문 총 무게(kg) = 모든 품목 내용물 무게 합계 + 배송 박스 1개 tare.
 *
 * 내용물 무게는 품목별 우선순위로 산출:
 *   1) 평량(gsm) × 재단면적 × 수량  — 물리 산식(OMO-3190)
 *   2) unit_weight_g × piece_count   — 정적 1매 무게
 *   3) default_weight_kg × 주문수량   — legacy fallback
 * 합산된 종이 무게에 맞는 최소 박스 tier 를 골라 박스 무게까지 더한다.
 */
export function calculateOrderWeightKg(items: OrderWeightItem[]): number {
  const contentG = items.reduce((sum, it) => sum + itemContentWeightG(it), 0)
  if (contentG <= 0) return 0.5
  const { tareG } = pickBox(contentG)
  return Math.round(((contentG + tareG) / 1000) * 1000) / 1000
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
