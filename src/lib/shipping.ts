// 배송비 계산: DB 기반 권역(zone) × 무게(weight) × 서비스(service) 조합
//
// 정책
// - 원산지: 한국 (FedEx Korea)
// - VAT 가산: 요금에 +10% 마진 (보드 정책, print_shipping_config.vat_markup_percent)
// - 요금표 미입력 시 fallback_rate_usd 사용 (보드가 FedEx 표 전달 후 임포트)

import { createServerClient } from '@/lib/supabase'

// ===== 기본값 (DB 미로딩/SSR 초기 렌더 등에서만 사용) =====

const DEFAULT_VAT_MARKUP_PCT = 10
const DEFAULT_FALLBACK_USD = 35

const FALLBACK_ZONES: { code: string; nameEn: string; countries: string[]; baseUsd: number }[] = [
  { code: 'A', nameEn: 'Japan',                  countries: ['JP'],                                                           baseUsd: 20 },
  { code: 'B', nameEn: 'East Asia',              countries: ['CN', 'HK', 'TW', 'MO'],                                          baseUsd: 22 },
  { code: 'C', nameEn: 'Southeast Asia',         countries: ['SG', 'TH', 'MY', 'PH', 'ID', 'VN'],                              baseUsd: 25 },
  { code: 'D', nameEn: 'Americas',               countries: ['US', 'CA', 'MX'],                                                baseUsd: 28 },
  { code: 'E', nameEn: 'Europe',                 countries: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'PT', 'AT', 'CH', 'IE', 'CZ', 'HU', 'RO', 'GR'], baseUsd: 32 },
  { code: 'F', nameEn: 'Oceania',                countries: ['AU', 'NZ'],                                                       baseUsd: 30 },
  { code: 'G', nameEn: 'Middle East/S.Asia',     countries: ['AE', 'SA', 'QA', 'KW', 'IL', 'TR', 'IN', 'PK'],                  baseUsd: 35 },
  { code: 'H', nameEn: 'Africa/Other',           countries: ['ZA', 'EG', 'NG', 'KE'],                                          baseUsd: 38 },
]

// ===== Public API =====

export interface ShippingQuote {
  costUsd: number             // 고객 청구 금액 (FedEx 원가 + 10% VAT)
  baseCostUsd: number         // FedEx 원가
  markupPct: number           // 적용된 VAT 가산율
  zoneCode: string
  zoneNameEn: string
  serviceCode: string | null  // 사용된 서비스 (DB에 요율 있을 때만)
  weightKg: number
  isFallback: boolean         // true = 요율표 미입력 → 기본 요금 사용
}

/** 동기 fallback (SSR 초기 렌더, 클라이언트 사이드 견적, 테스트용). */
export function getShippingCost(countryCode: string): number {
  const zone =
    FALLBACK_ZONES.find((z) => z.countries.includes(countryCode.toUpperCase())) ??
    FALLBACK_ZONES[FALLBACK_ZONES.length - 1]
  return applyVatMarkup(zone.baseUsd, DEFAULT_VAT_MARKUP_PCT)
}

export function getShippingZoneName(countryCode: string): string {
  const zone =
    FALLBACK_ZONES.find((z) => z.countries.includes(countryCode.toUpperCase())) ??
    FALLBACK_ZONES[FALLBACK_ZONES.length - 1]
  return `Zone ${zone.code} - ${zone.nameEn}`
}

/**
 * DB 기반 정식 견적. 결제 생성 등 가격을 확정하는 곳에서 사용한다.
 * - country, weightKg, serviceCode(옵션) 를 받아
 * - print_shipping_zones / print_shipping_rates / print_shipping_config 를 조회
 * - VAT 가산을 적용한 최종 USD 금액을 돌려준다.
 */
export async function quoteShipping(
  countryCode: string,
  weightKg: number,
  serviceCode?: string,
): Promise<ShippingQuote> {
  const supabase = createServerClient()
  const upperCountry = countryCode.toUpperCase()
  const effectiveWeight = weightKg > 0 ? weightKg : 0.5

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

  // 권역 미해석 → fallback flat rate
  if (!zone) {
    const cost = applyVatMarkup(fallbackUsd, markupPct)
    return {
      costUsd: cost,
      baseCostUsd: fallbackUsd,
      markupPct,
      zoneCode: 'OTHER',
      zoneNameEn: 'Other (fallback rate)',
      serviceCode: null,
      weightKg: effectiveWeight,
      isFallback: true,
    }
  }

  // 활성 서비스 선택 (요청 서비스 → 그 외 정렬 첫 번째)
  const { data: services } = await supabase
    .from('print_shipping_services')
    .select('id, code')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const service = serviceCode
    ? services?.find((s) => s.code === serviceCode) ?? services?.[0]
    : services?.[0]

  if (!service) {
    return fallbackQuote(zone.code, zone.name_en, fallbackUsd, markupPct, effectiveWeight)
  }

  // 무게 구간 매칭: 입력 무게 이상의 가장 낮은 weight_kg_max
  const today = new Date().toISOString().slice(0, 10)
  const { data: rates } = await supabase
    .from('print_shipping_rates')
    .select('weight_kg_max, rate_usd, effective_from, effective_to')
    .eq('zone_id', zone.id)
    .eq('service_id', service.id)
    .lte('effective_from', today)
    .order('weight_kg_max', { ascending: true })

  const activeRates = (rates ?? []).filter((r) => !r.effective_to || r.effective_to >= today)
  const matchedRate =
    activeRates.find((r) => Number(r.weight_kg_max) >= effectiveWeight) ??
    activeRates[activeRates.length - 1]

  if (!matchedRate) {
    return fallbackQuote(zone.code, zone.name_en, fallbackUsd, markupPct, effectiveWeight, service.code)
  }

  const baseCostUsd = Number(matchedRate.rate_usd)
  return {
    costUsd: applyVatMarkup(baseCostUsd, markupPct),
    baseCostUsd,
    markupPct,
    zoneCode: zone.code,
    zoneNameEn: zone.name_en,
    serviceCode: service.code,
    weightKg: effectiveWeight,
    isFallback: false,
  }
}

/** 주문 항목 배열에서 총 무게(kg) 계산. */
export function calculateOrderWeightKg(
  items: { quantity: number; default_weight_kg?: number | null }[],
): number {
  return items.reduce((sum, it) => {
    const w = Number(it.default_weight_kg ?? 0.5)
    return sum + w * (it.quantity ?? 1)
  }, 0)
}

// ===== 내부 헬퍼 =====

function applyVatMarkup(usd: number, markupPct: number): number {
  return Math.round(usd * (1 + markupPct / 100) * 100) / 100
}

function fallbackQuote(
  zoneCode: string,
  zoneNameEn: string,
  fallbackUsd: number,
  markupPct: number,
  weightKg: number,
  serviceCode?: string,
): ShippingQuote {
  return {
    costUsd: applyVatMarkup(fallbackUsd, markupPct),
    baseCostUsd: fallbackUsd,
    markupPct,
    zoneCode,
    zoneNameEn,
    serviceCode: serviceCode ?? null,
    weightKg,
    isFallback: true,
  }
}

// 레거시 export (기존 import 경로 보존)
export const SHIPPING_ZONES = FALLBACK_ZONES.map((z) => ({
  name: `Zone ${z.code} - ${z.nameEn}`,
  baseUsd: z.baseUsd,
  countries: z.countries,
}))
