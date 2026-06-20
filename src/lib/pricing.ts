import { krwToUsd } from './exchange-rate'
import type { SwadpiaPrintEntry } from './swadpia'

/**
 * Swadpia-based price calculation (KRW to USD)
 *
 * Formula: (Swadpia print cost KRW) x margin_multiplier x exchange_rate + shipping
 *
 * - swadpiaPriceKrw: Swadpia print cost (per-quantity lookup)
 * - marginMultiplier: Margin multiplier (default 3.3)
 * - exchangeRate: KRW to USD exchange rate
 */
export function calculateItemPriceUsd(params: {
  basePriceKrw: number
  marginMultiplier: number
  extraPricesKrw: number[]
  exchangeRate: number
}): number {
  const { basePriceKrw, marginMultiplier, extraPricesKrw, exchangeRate } = params

  const totalKrw =
    (basePriceKrw + extraPricesKrw.reduce((sum, p) => sum + p, 0)) * marginMultiplier

  return krwToUsd(totalKrw, exchangeRate)
}

/**
 * Swadpia print cost matrix-based price calculation (USD)
 *
 * swadpiaCostKrw: Swadpia wholesale cost (print_info1 lookup result)
 * marginMultiplier: Margin multiplier (3.3)
 * exchangeRate: KRW to USD
 */
export function calculatePriceFromSwadpia(params: {
  swadpiaCostKrw: number
  marginMultiplier: number
  exchangeRate: number
}): number {
  const { swadpiaCostKrw, marginMultiplier, exchangeRate } = params
  const totalKrw = swadpiaCostKrw * marginMultiplier
  return krwToUsd(totalKrw, exchangeRate)
}

/**
 * Look up wholesale cost from the Swadpia print price matrix.
 * If no exact quantity match, use the nearest higher quantity (else the largest available).
 * Skips entries with print_unit2 <= 0 (Swadpia "전화문의"/phone-only — would crash pricing).
 * Returns the resolved entry so the caller knows whether Swadpia rounded the quantity up.
 *
 * ⚠️ 보안(OMO-3593): 이 함수는 도매 KRW(print_unit2)를 다룬다 → **서버 전용**.
 * 클라이언트(ProductConfigurator)는 결과 USD 만 받는다(buildSwadpiaPricingTable 경유).
 */
export function lookupSwadpiaCost(
  printEntries: SwadpiaPrintEntry[],
  paperCode: string,
  quantity: number,
): { costKrw: number; effectiveQty: number } | null {
  const entries = printEntries
    .filter((e) => e.paper_code === paperCode && e.print_unit2 > 0)
    .sort((a, b) => a.quantity - b.quantity)

  if (entries.length === 0) return null

  const exact = entries.find((e) => e.quantity === quantity)
  if (exact) return { costKrw: exact.print_unit2, effectiveQty: exact.quantity }

  const upper = entries.find((e) => e.quantity >= quantity)
  if (upper) return { costKrw: upper.print_unit2, effectiveQty: upper.quantity }

  const last = entries[entries.length - 1]
  return { costKrw: last.print_unit2, effectiveQty: last.quantity }
}

/** 한 (paper_code, quantity) 셀의 고객 표시용 결과 — 도매 KRW 비노출, USD 만. */
export interface SwadpiaPriceCell {
  effectiveQty: number
  totalUsd: number
}

/**
 * 클라이언트 전달용 Swadpia 가격 테이블(USD only).
 *
 * OMO-3593 보안: 도매 KRW(print_unit1/2)·매트릭스를 브라우저로 직렬화하지 않기 위해,
 * 서버에서 마진·환율을 적용한 **고객가 USD** 만 미리 산출해 전달한다.
 * - `useSwadpia`: 실시간 도매 배지 노출 게이트(원본과 동일하게 raw printEntries 존재 여부).
 * - `validPaperCodes`: 유효 단가(print_unit2>0) 보유 용지코드(순서 보존, [0]=폴백).
 * - `table[paperCode][String(qty)]`: 해당 수량의 고객가 USD + 성원 반올림 수량(effectiveQty).
 */
export interface SwadpiaPricingTable {
  useSwadpia: boolean
  validPaperCodes: string[]
  table: Record<string, Record<string, SwadpiaPriceCell>>
}

/**
 * 서버 전용: printEntries(도매 KRW)에서 고객가 USD 테이블을 산출한다.
 * 클라이언트 가격 로직(lookupSwadpiaCost + calculatePriceFromSwadpia)과 **동일한 연산**을
 * 미리 수행하므로 고객 표시가가 비트단위로 동일하다(회귀 안전).
 *
 * @param quantities 미리 계산할 수량 집합 = 수량 옵션값 ∪ {기본값 100}.
 */
export function buildSwadpiaPricingTable(params: {
  printEntries: SwadpiaPrintEntry[]
  quantities: number[]
  marginMultiplier: number
  exchangeRate: number
}): SwadpiaPricingTable {
  const { printEntries, quantities, marginMultiplier, exchangeRate } = params
  const valid = printEntries.filter((e) => e.print_unit2 > 0)
  // 원본 swadpiaPaperCode 와 동일한 순서(첫 등장순)로 유효 용지코드 수집.
  const validPaperCodes = [...new Set(valid.map((e) => e.paper_code))]

  const table: Record<string, Record<string, SwadpiaPriceCell>> = {}
  for (const code of validPaperCodes) {
    const perQty: Record<string, SwadpiaPriceCell> = {}
    for (const qty of quantities) {
      const r = lookupSwadpiaCost(valid, code, qty)
      if (r && r.costKrw > 0) {
        perQty[String(qty)] = {
          effectiveQty: r.effectiveQty,
          totalUsd: calculatePriceFromSwadpia({
            swadpiaCostKrw: r.costKrw,
            marginMultiplier,
            exchangeRate,
          }),
        }
      }
    }
    table[code] = perQty
  }

  return {
    // 배지 게이트는 원본과 동일하게 raw printEntries 존재 여부로 판단.
    useSwadpia: printEntries.length > 0,
    validPaperCodes,
    table,
  }
}
