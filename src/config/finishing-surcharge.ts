// OMO-3196 (보드 재요청): 후가공 surcharge 를 수량별로 반영하고 "quote" 를 제거한다.
//   성원 calcuEstimate 라이브 probe(scripts/omo3196-finishing-amt.mts, 2026-06-15)로
//   명함(CNC1000) 후가공 단가를 수량 500~14000 tier 로 추출 → finishing-surcharge-cnc1000.json.
//   surcharge 는 수량에 비례 증가(예: 박 ₩22,300@500 → ₩431,400@12000).
//   재생성: node scripts/omo3196-gen-surcharge.mjs (probe 후).

import cnc1000 from './finishing-surcharge-cnc1000.json'

interface Tier {
  qty: number
  krw: Record<string, number>
}

// 명함류는 CNC1000 매트릭스 공유. (추후 타 카테고리 매트릭스 추가 시 여기에.)
const MATRIX: Record<string, Tier[]> = {
  business_cards: cnc1000 as Tier[],
  premium_business_cards: cnc1000 as Tier[],
  premium_foil_cards: cnc1000 as Tier[],
  letterpress_cards: cnc1000 as Tier[],
}

// 매트릭스 미보유 카테고리용 정액(저수량 검증치, OMO-3022/3030). 추후 매트릭스로 확장.
const FLAT_KRW: Record<string, number> = {
  coating: 38000,
  partial_coating: 150000,
  binding: 8000,
  folding: 20000,
  stitching: 40000,
  window_patch: 77000,
  tape: 23000,
  foil_stamp: 22300,
  deboss_emboss: 21400,
  die_cut: 21500,
  drilled_hole: 3800,
  round_corner: 3000,
  epoxy: 22500,
  score_crease: 7000,
  perforation: 7000,
}

const CARD_CATEGORIES = new Set([
  'business_cards',
  'premium_business_cards',
  'premium_foil_cards',
  'letterpress_cards',
])

function nearestTier(tiers: Tier[], qty: number): Tier {
  for (const t of tiers) if (t.qty >= qty) return t
  return tiers[tiers.length - 1]
}

/**
 * 후가공 surcharge(KRW) — 수량 고려.
 * 반환: number(≥0, 0 = 용지/인쇄 내장 = "Included") | null(데이터 없음 → 컨피규레이터 미노출).
 */
export function finishingSurchargeKrw(value: string, category: string, qty: number): number | null {
  // 명함류 코팅/별색은 용지·인쇄에 내장 → 별도 정액 없음(Included).
  if ((value === 'coating' || value === 'spot_color') && CARD_CATEGORIES.has(category)) return 0
  const m = MATRIX[category]
  if (m && m.length) {
    const tier = nearestTier(m, qty > 0 ? qty : m[0].qty)
    const v = tier.krw[value]
    return v === undefined ? null : v
  }
  return FLAT_KRW[value] ?? null
}
