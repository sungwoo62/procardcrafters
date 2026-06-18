// OMO-3465: printcity 명함 후가공(addwork) **정밀 복제** — 후가공별 전 selecter(사이즈/카운트/면/종류) +
// isHide + price 조합(수량브래킷·calcValue). OMO-3457 v1(side+color 평탄화)을 printcity 실제 구동방식으로 재구성.
//
// 데이터: src/data/printcity-namecard-finishing.json (schemaVersion 2)
//   = scripts/omo3465-printcity-namecard-finishing-crawl.mjs 가 price-api.dtp21.com/v2/addwork/all 에서
//     명함 16제품에 직접 링크된 addwork 의 selecters[](codeCategory·select·isHide) + price[](조합→브래킷+calcValue)을 직독.
//
// 가격 모델:
//   - per_order : 박/박동판/형압/압동판/오시/미싱/넘버링/점자 — 주문당 고정 셋업비(수량브래킷별 금액).
//   - per_unit  : 타공/귀도리/엠보싱 — 매당 단가. surcharge = 단가 × 수량.
//   - calc(=calcValue) ≠ 0 : 면적종속(surcharge += calc × area). 명함은 전수 0(박 사이즈는 생산스펙, 가격 무영향).
//   고객가(USD·마진)·결제 컷오버는 보드 게이트 — 본 모듈은 printcity 공급가(KRW)+VAT 견적까지.
import data from '@/data/printcity-namecard-finishing.json'

export interface FinishingBracket {
  /** 수량 하한(포함) */
  min: number
  /** 수량 상한(포함) */
  max: number
  /** per_order=주문당 금액(원), per_unit=매당 단가(원) */
  v: number
  /** 면적종속 계수(calcValue). 0 이면 면적 무영향. */
  calc: number
}
export interface FinishingSelecterOption {
  /** printcity 옵션 코드(예: 'BKS:1F') */
  code: string
  /** printcity 원본 한국어 옵션명 */
  titleKO: string
}
export interface FinishingSelecter {
  /** printcity codeCategory(예: 'bakSideCode') — 후가공 내 옵션축 식별자 */
  codeCategory: string
  /** 축 표시명(접미사 정리된 KO) */
  titleKO: string
  /** 이 축의 옵션코드가 price 조합에 등장 = 가격에 영향. false 면 생산스펙(선택만). */
  priceKeying: boolean
  /** 노출 옵션(isHide:true 는 크롤 단계에서 제외됨) */
  select: FinishingSelecterOption[]
}
export interface FinishingCombo {
  /** 이 가격을 결정하는 priceKeying 코드 조합(예: ['BKS:1F','BKK:GOLD-GS']) */
  codes: string[]
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
  /** 박/형압/엠보싱: printcity 처럼 하단패널에서 도안 사이즈(width×height mm)를 생산스펙으로 입력(명함=가격 무영향). */
  foilSizeSpec: boolean
  selecters: FinishingSelecter[]
  priceCombos: FinishingCombo[]
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
  schemaVersion: number
  capturedAt: string
  productCount: number
  totalWorkLinks: number
  products: FinishingProduct[]
}

export const FINISHING = data as unknown as FinishingPayload

// ───────────────────────── 영어 표시 라벨(데이터는 KO, UI 는 EN) ─────────────────────────
const WORKTYPE_EN: Record<string, string> = {
  bak: 'Foil Stamping', bakDongpan: 'Foil Die', ap: 'Embossing Press', apDongpan: 'Emboss Die',
  osi: 'Scoring', mising: 'Perforation', tagong: 'Hole Punch', embo: 'Pigment Emboss',
  guido: 'Round Corners', numbering: 'Numbering', apBraille: 'Braille Press', emboBraille: 'Braille Emboss',
  domusong: 'Die-Cut',
}
const CATEGORY_EN: Record<string, string> = {
  apSideCode: 'Press type', bakSideCode: 'Side', bakKindCode: 'Foil type',
  tagongSizeCode: 'Hole size', tagongCountCode: 'Holes',
  osiLineCountCode: 'Score lines', misingLineCountCode: 'Perforation lines',
  emboSideCode: 'Side', emboKindCode: 'Pigment', guidoRadiusCode: 'Corner radius',
  apBrailleCode: 'Input method', emboBrailleCode: 'Input method', customCode1: 'Braille volume',
  numberingCountCode: 'Positions', numberingKindCode: 'Numbering type',
}
const OPTION_EN: Record<string, string> = {
  'APS:1F': 'Emboss (front raised)', 'APS:1B': 'Deboss (back raised)',
  'BKS:1F': 'Front', 'BKS:1B': 'Back', 'BKS:2': 'Both sides',
  'BKK:GOLD-GS': 'Gold (gloss)', 'BKK:GOLD-MT': 'Gold (matte)',
  'BKK:SILVER-GS': 'Silver (gloss)', 'BKK:SILVER-MT': 'Silver (matte)',
  'BKK:RED': 'Red', 'BKK:BLUE': 'Blue', 'BKK:GREEN': 'Green', 'BKK:BLACK': 'Black',
  'BKK:PEARL3': 'Pearl', 'BKK:HOLOGRAM3': 'Hologram', 'BKK:DONG': 'Copper', 'BKK:REDGOLD': 'Rose gold',
  'TGR:3': '3mm', 'TGR:4': '4mm', 'TGR:5': '5mm', 'TGR:7': '7mm',
  'TGH:1': '1 hole', 'TGH:2': '2 holes',
  'OSL:1': '1 line (center)', 'OSL:C1': '1 line (off-center)', 'OSL:2': '2 lines', 'OSL:3': '3 lines',
  'MSL:1': '1 line (center)', 'MSL:C1': '1 line (off-center)', 'MSL:2': '2 lines', 'MSL:3': '3 lines',
  'EBS:1F': 'Front', 'EBS:1B': 'Back', 'EBS:2': 'Both sides',
  'EBK:BLACK': 'Black', 'EBK:TRANSPARENT': 'Clear',
  'GDR:4': 'R 4mm', 'GDR:6': 'R 6mm',
  'BRA:DIR-AP1': 'Direct input', 'BRA:DIR-AP2': 'Pick from list',
  'BRA:DIR-EB1': 'Direct input', 'BRA:DIR-EB2': 'Pick from list',
  'LESS-300': '< 300 dots', 'OVER-300': '≥ 300 dots', 'LESS-250': '< 250 dots', 'OVER-250': '≥ 250 dots',
  'NBC:1': '1 position', 'NBC:2': '2 positions', 'NUK:NORMAL': 'Standard',
}
export const enWorkName = (work: FinishingWork): string => WORKTYPE_EN[work.workType] || work.name
export const enCategory = (sel: FinishingSelecter): string => CATEGORY_EN[sel.codeCategory] || sel.titleKO
export const enOption = (code: string): string => OPTION_EN[code] || code
/** 선택 코드들의 영문 요약 라벨(견적 라인용). */
export const enSelectionLabel = (codes: string[]): string =>
  codes.length ? codes.map(enOption).join(' · ') : 'Standard'

// ───────────────────────── 조회/가격 ─────────────────────────

/** 제품 id 의 후가공 work 목록. 없으면 빈 배열(printcity 미노출 제품). */
export function getProductFinishing(productId: string): FinishingWork[] {
  return FINISHING.products.find((p) => p.id === productId)?.works ?? []
}

/** work 의 기본 선택(각 selecter 의 첫 노출 옵션). codeCategory → code. */
export function defaultSelecterCodes(work: FinishingWork): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of work.selecters) if (s.select[0]) out[s.codeCategory] = s.select[0].code
  return out
}

/** 선택 코드 집합으로 매칭되는 가격 조합. combo.codes 가 선택코드의 부분집합이면 후보, 가장 구체적인 것 채택. */
export function findFinishingCombo(work: FinishingWork, selectedCodes: string[]): FinishingCombo | null {
  const set = new Set(selectedCodes)
  const cands = work.priceCombos.filter((c) => c.codes.every((code) => set.has(code)))
  if (cands.length) return cands.sort((a, b) => b.codes.length - a.codes.length)[0]
  // 폴백: 조합이 하나뿐이면 그것(셋업비형 — codes=[] 또는 단일).
  return work.priceCombos.length === 1 ? work.priceCombos[0] : null
}

/** 수량 qty 에 해당하는 브래킷(min<=qty<=max). 데이터 역전/범위밖은 최근접 브래킷으로 보정. */
function bracketAt(brackets: FinishingBracket[], qty: number): FinishingBracket | null {
  if (!brackets.length) return null
  for (const b of brackets) {
    const lo = Math.min(b.min, b.max)
    const hi = Math.max(b.min, b.max)
    if (qty >= lo && qty <= hi) return b
  }
  let best: FinishingBracket | null = null
  let bestDist = Infinity
  for (const b of brackets) {
    const lo = Math.min(b.min, b.max)
    const hi = Math.max(b.min, b.max)
    const d = qty > hi ? qty - hi : lo - qty
    if (d < bestDist) { bestDist = d; best = b }
  }
  return best
}

/**
 * 후가공 1건의 printcity 공급가 surcharge(원).
 * per_unit=매당단가×수량, per_order=고정. calc≠0 이면 면적(area, mm²→cm² 등 데이터 단위) 종속분 가산.
 * 조합/브래킷 미일치 시 null.
 */
export function finishingSurchargeKrw(
  work: FinishingWork,
  selectedCodes: string[],
  qty: number,
  area = 0,
): number | null {
  const combo = findFinishingCombo(work, selectedCodes)
  if (!combo) return null
  const b = bracketAt(combo.brackets, qty)
  if (!b) return null
  let base = work.pricing === 'per_unit' ? b.v * qty : b.v
  if (b.calc) base += work.pricing === 'per_unit' ? b.calc * area * qty : b.calc * area
  return Math.round(base)
}

export interface FinishingLine {
  workType: string
  name: string
  optionLabel: string
  pricing: 'per_order' | 'per_unit'
  krw: number
}

/**
 * 선택된 후가공들의 surcharge 합계 + 라인.
 * selections: workType → 선택된 옵션 codes(존재=선택됨). codes 는 해당 work 의 모든 selecter 선택 코드(flat).
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
    lines.push({
      workType: work.workType,
      name: enWorkName(work),
      optionLabel: enSelectionLabel(sel),
      pricing: work.pricing,
      krw,
    })
    total += krw
  }
  return { total, lines }
}
