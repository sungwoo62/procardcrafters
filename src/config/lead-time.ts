// OMO-2314: Lead-time / 생산 일정 정책.
//
// 사이트 표시 = Swadpia (성원애드피아) 생산일 + 내부 버퍼 (5 영업일).
// 5일 버퍼는 export packing / QA / 1차 시안 확인 / 국내 → LA 픽업 흡수.
// 배송 자체는 별도 (FedEx 등) — checkout 에서 별도 quote.
//
// Rush 업그레이드:
//   Standard = 버퍼 5일 그대로 (수수료 없음)
//   Express  = 버퍼 2일로 축소 — 추가 25% (3일 단축, 마진 흡수)
//
// 두 tier 로 시작 (Standard / Express). 수요 보고 Rush (버퍼 0일 -50%) 추가 검토.

export const PCCF_BUFFER_DAYS = 5

export type LeadTimeTier = 'standard' | 'express'

export interface LeadTimeTierDef {
  key: LeadTimeTier
  label: string
  description: string
  bufferDays: number
  /** Multiplier on base item price. 1.0 = no surcharge. */
  surchargeRate: number
}

export const LEAD_TIME_TIERS: LeadTimeTierDef[] = [
  {
    key: 'standard',
    label: 'Standard',
    description: 'Default — includes our QA + packing buffer.',
    bufferDays: PCCF_BUFFER_DAYS,
    surchargeRate: 1.0,
  },
  {
    key: 'express',
    label: 'Express',
    description: 'Skip 3 buffer days. Surcharge: +25%.',
    bufferDays: 2,
    surchargeRate: 1.25,
  },
]

export interface ProductDays {
  production_days_min: number
  production_days_max: number
}

/** Return [min, max] business days for the given tier. */
export function getProductionDays(
  product: ProductDays,
  tier: LeadTimeTier = 'standard',
): [number, number] {
  const t = LEAD_TIME_TIERS.find(x => x.key === tier) ?? LEAD_TIME_TIERS[0]
  const min = (product.production_days_min ?? 2) + t.bufferDays
  const max = (product.production_days_max ?? 4) + t.bufferDays
  return [min, max]
}

/** Human-readable production window (e.g. "7-9 business days"). */
export function formatProductionWindow(
  product: ProductDays,
  tier: LeadTimeTier = 'standard',
): string {
  const [min, max] = getProductionDays(product, tier)
  return min === max
    ? `${max} business days`
    : `${min}–${max} business days`
}

/** Returns the surcharge USD amount given a base subtotal. */
export function rushSurcharge(baseSubtotalUsd: number, tier: LeadTimeTier): number {
  const t = LEAD_TIME_TIERS.find(x => x.key === tier) ?? LEAD_TIME_TIERS[0]
  if (t.surchargeRate <= 1) return 0
  return Math.round((baseSubtotalUsd * (t.surchargeRate - 1)) * 100) / 100
}
