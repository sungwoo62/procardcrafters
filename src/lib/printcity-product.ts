// OMO-3452: printcity 명함 실제 제품 페이지 데이터/가격 해석.
//
// 데이터: src/data/printcity-namecard-pricing.json
//   = scripts/omo3452-build-printcity-product-data.mjs 가 OMO-3414 풀 census(priceTable)에서
//     판매가능 명함 제품만 추려 조합별 수량가격으로 재가공한 것. printcity 공개 GET JSON 직독.
//
// 가격 모델(priceComplete): 각 조합(combo = 옵션 code 집합)이 수량별 완성가(공급가, KRW)를 가진다.
//   박/엣지박/부분코팅/에폭은 별도 surcharge 가 아니라 조합에 포함된 완성형 룩업.
import data from '@/data/printcity-namecard-pricing.json'

export interface PrintcityAxisOption {
  code: string
  ko: string
}
export interface PrintcityAxis {
  label: string
  options: PrintcityAxisOption[]
}
export interface PrintcityPriceRow {
  /** combo = 옵션 code 배열 (예: ['COT:NO','MAT:SNW-250','SIZ:NC-90X50','COL:40']) */
  c: string[]
  /** [수량, 공급가(원)] 배열 */
  p: [number, number][]
}
export interface PrintcityProductData {
  id: string
  nameKO: string
  label: string
  /** printcity 명함 하위분류명 (예 일반명함/카드명함/스페셜명함/디지털일반명함…) */
  sub?: string
  subCode?: string
  subType?: string
  ourSlug: string | null
  category3rd: string
  hasFoil: boolean
  /** 축 키(coating/material/color/size/foil/PCS/EPS...) → 라벨+옵션 */
  axes: Record<string, PrintcityAxis>
  quantities: number[]
  table: PrintcityPriceRow[]
}
export interface PrintcityPricingPayload {
  issue: string
  source: string
  method: string
  capturedAt: string
  productCount: number
  products: PrintcityProductData[]
}

export const PRINTCITY_PRICING = data as unknown as PrintcityPricingPayload
export const PRINTCITY_PRODUCTS = PRINTCITY_PRICING.products

export function getPrintcityProduct(id: string): PrintcityProductData | undefined {
  return PRINTCITY_PRODUCTS.find((p) => p.id === id)
}

/** 한 조합의 대표(최저) 200매 기준 base 가격 — 카드 리스트 "부터" 가격용. */
export function startingSupplyKrw(p: PrintcityProductData): { qty: number; krw: number } | null {
  let best: { qty: number; krw: number } | null = null
  for (const row of p.table) {
    for (const [q, v] of row.p) {
      if (v <= 0) continue
      // 200매 우선, 없으면 최소 수량의 최저가
      if (!best || q < best.qty || (q === best.qty && v < best.krw)) {
        if (!best || q <= best.qty) best = { qty: q, krw: v }
      }
    }
  }
  // 200매가 있으면 그것으로 교체
  for (const row of p.table) {
    for (const [q, v] of row.p) {
      if (q === 200 && v > 0 && (!best || best.qty !== 200 || v < best.krw)) {
        if (!best || best.qty !== 200 || v < best.krw) best = { qty: 200, krw: v }
      }
    }
  }
  return best
}

export interface PrintcitySelection {
  /** 축키 → 선택된 옵션 code */
  codes: Record<string, string>
  qty: number
}

/** code(예 'MAT:SNW-250') 가 속한 축 키(material/size/...)를 product.axes 에서 역추적. */
function axisKeyForCode(p: PrintcityProductData, code: string): string | null {
  for (const [key, ax] of Object.entries(p.axes)) {
    if (ax.options.some((o) => o.code === code)) return key
  }
  return null
}

/**
 * 구성기 초기 선택값 — 실제 가격이 있는 대표 조합에서 도출(첫 옵션 단순조합은 미가격일 수 있음).
 * 우선순위: 200매 최저가 행 → 최소수량 최저가 행 → 첫 행.
 */
export function defaultSelection(p: PrintcityProductData): PrintcitySelection {
  let bestRow = p.table[0]
  let bestScore = Infinity
  let bestQty = p.quantities[0] ?? 0
  for (const row of p.table) {
    for (const [q, v] of row.p) {
      if (v <= 0) continue
      // 200매를 강하게 선호, 그 외엔 최소수량·최저가
      const score = (q === 200 ? 0 : 1) * 1e9 + q * 1e3 + v
      if (score < bestScore) {
        bestScore = score
        bestRow = row
        bestQty = q
      }
    }
  }
  const codes: Record<string, string> = {}
  for (const c of bestRow?.c ?? []) {
    const key = axisKeyForCode(p, c)
    if (key) codes[key] = c
  }
  // 가격에 등장하지 않는 축이 있으면 첫 옵션으로 채움(있어선 안 되지만 안전망)
  for (const [key, ax] of Object.entries(p.axes)) {
    if (!codes[key]) codes[key] = ax.options[0]?.code ?? ''
  }
  return { codes, qty: bestQty }
}

/**
 * 선택된 옵션 조합 + 수량의 printcity 공급가(원)를 해석한다.
 * combo 의 모든 code 가 선택값과 일치하는 행을 찾고, 해당 수량 가격을 반환.
 * 일치행 없음/가격 없음 → null (구성기에서 "해당 조합 미제공" 표시).
 */
export function resolveSupplyKrw(p: PrintcityProductData, sel: PrintcitySelection): number | null {
  const chosen = new Set(Object.values(sel.codes))
  const row = p.table.find((r) => r.c.length === chosen.size && r.c.every((c) => chosen.has(c)))
  if (!row) {
    // 부분 일치 폴백: 선택된 모든 code 를 포함하는 행(축 일부가 가격에 무관할 때)
    const loose = p.table.find((r) => r.c.every((c) => chosen.has(c)) || Object.values(sel.codes).every((c) => r.c.includes(c)))
    if (!loose) return null
    const hit = loose.p.find(([q]) => q === sel.qty)
    return hit ? hit[1] : null
  }
  const hit = row.p.find(([q]) => q === sel.qty)
  return hit ? hit[1] : null
}

const VAT_RATE = 0.1
export function withVat(supply: number): { supply: number; vat: number; total: number } {
  const vat = Math.round(supply * VAT_RATE)
  return { supply, vat, total: supply + vat }
}

export const wonKR = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
