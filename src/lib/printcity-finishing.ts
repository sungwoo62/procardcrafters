// OMO-3457: printcity 명함 후가공(addwork) 옵션 + 수량브래킷 surcharge 해석.
//
// 데이터: src/data/printcity-namecard-finishing.json
//   = scripts/omo3457-printcity-namecard-finishing-crawl.mjs 가 price-api.dtp21.com/v2/addwork/all 에서
//     productId[] 가 명함 16제품에 직접 링크된 addwork 만 추려, 옵션별 수량브래킷 가격을 직독한 것.
//
// 가격 모델:
//   - per_order : 박/박동판/형압/압동판/오시/미싱/넘버링/점자 — 주문당 고정 셋업비(수량브래킷별 금액).
//   - per_unit  : 타공/귀도리/엠보싱 — 매당 단가. surcharge = 단가 × 수량.
//   고객가(USD·마진)·결제 컷오버는 보드 게이트 — 본 모듈은 printcity 공급가(KRW)+VAT 견적까지.
import data from '@/data/printcity-namecard-finishing.json'

export interface FinishingBracket {
  /** 수량 하한(포함) */
  min: number
  /** 수량 상한(포함) */
  max: number
  /** per_order=주문당 금액(원), per_unit=매당 단가(원) */
  v: number
}
export interface FinishingOption {
  /** printcity 옵션 코드 조합(예: ['BKS:1F','BKK:GOLD-GS']) */
  codes: string[]
  label: string
  brackets: FinishingBracket[]
}
export interface FinishingWork {
  workType: string
  group: string
  /** 표시명(접미사 제거): 박/박동판/형압/압동판/오시/미싱/타공/엠보싱/귀도리/넘버링… */
  name: string
  /** printcity 원본 workTypeKO */
  label: string
  pricing: 'per_order' | 'per_unit'
  options: FinishingOption[]
}
export interface FinishingProduct {
  id: string
  nameKO: string
  works: FinishingWork[]
}
export interface FinishingPayload {
  issue: string
  source: string
  method: string
  capturedAt: string
  productCount: number
  totalWorkLinks: number
  products: FinishingProduct[]
}

export const FINISHING = data as unknown as FinishingPayload

/** 제품 id 의 후가공 work 목록(없으면 빈 배열 — printcity 미노출 제품). */
export function getProductFinishing(productId: string): FinishingWork[] {
  return FINISHING.products.find((p) => p.id === productId)?.works ?? []
}

/** 수량 qty 에 해당하는 브래킷 금액(min<=qty<=max). 데이터 역전/범위밖은 최근접 브래킷으로 보정. */
function bracketValue(brackets: FinishingBracket[], qty: number): number | null {
  if (!brackets.length) return null
  for (const b of brackets) {
    const lo = Math.min(b.min, b.max)
    const hi = Math.max(b.min, b.max)
    if (qty >= lo && qty <= hi) return b.v
  }
  let best: FinishingBracket | null = null
  let bestDist = Infinity
  for (const b of brackets) {
    const lo = Math.min(b.min, b.max)
    const hi = Math.max(b.min, b.max)
    const d = qty > hi ? qty - hi : lo - qty
    if (d < bestDist) { bestDist = d; best = b }
  }
  return best ? best.v : null
}

/** work 의 옵션(codes)을 찾는다. codes 빈 배열이면 단일/기본 옵션. */
export function findFinishingOption(work: FinishingWork, optionCodes: string[]): FinishingOption | null {
  const exact = work.options.find(
    (o) => o.codes.length === optionCodes.length && o.codes.every((c) => optionCodes.includes(c)),
  )
  if (exact) return exact
  return optionCodes.length === 0 ? work.options[0] ?? null : null
}

/**
 * 후가공 1건의 printcity 공급가 surcharge(원). per_unit 은 매당단가×수량, per_order 는 고정.
 * 옵션/브래킷 미일치 시 null.
 */
export function finishingSurchargeKrw(work: FinishingWork, optionCodes: string[], qty: number): number | null {
  const opt = findFinishingOption(work, optionCodes)
  if (!opt) return null
  const v = bracketValue(opt.brackets, qty)
  if (v == null) return null
  return work.pricing === 'per_unit' ? Math.round(v * qty) : Math.round(v)
}

export interface FinishingLine {
  workType: string
  name: string
  optionLabel: string
  pricing: 'per_order' | 'per_unit'
  krw: number
}

/**
 * 선택된 후가공들의 surcharge 합계 + 라인. selections: workType → 선택된 옵션 codes(존재=선택됨).
 */
export function finishingTotalKrw(
  works: FinishingWork[],
  selections: Record<string, string[]>,
  qty: number,
): { total: number; lines: FinishingLine[] } {
  const lines: FinishingLine[] = []
  let total = 0
  for (const work of works) {
    const sel = selections[work.workType]
    if (!sel) continue
    const krw = finishingSurchargeKrw(work, sel, qty)
    if (krw == null) continue
    const opt = findFinishingOption(work, sel)
    lines.push({
      workType: work.workType,
      name: work.name,
      optionLabel: opt?.label ?? '기본',
      pricing: work.pricing,
      krw,
    })
    total += krw
  }
  return { total, lines }
}
