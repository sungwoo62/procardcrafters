/**
 * 제품별 Swadpia 기준단가(base_price_krw) 산출 규칙 (OMO-3072)
 *
 * 배경(부모 OMO-3070 가격감사):
 *  1) 기존 sync 의 extractBasePrice 가 `sorted[0]` 를 취해, 동일 최소수량(예: q200)에
 *     용지별 복수 단가가 존재하면 배열 순서에 따라 임의값을 선택하는 비결정성이 있었다.
 *  2) generic endpoint 가 print_info1 매트릭스를 주지 않는 카테고리
 *     (스티커 CST*, 라벨 CLP*, 봉투 CEV1000, 전단 CLF1000, 엽서 CDP3000 등)는
 *     단일 기준단가를 도출할 수 없는데, 기존 코드는 `papers[0]` 로 임의 폴백했다.
 *  3) 카테고리 collapse(CPR5000←banners/x/rollup/mini 등)로 서로 다른 제품이
 *     같은 레퍼런스를 받거나, 역매핑이 카테고리당 slug 1개만 처리해 나머지 제품은
 *     아예 sync 되지 않고 stale 상태로 남았다.
 *
 * 해결:
 *  - extractMatrixBasePriceKrw: 결정적 규칙(최소수량 → 최저 print_unit2 →
 *    동단가 시 paper_code 사전순)으로 매트릭스 기준단가 산출. 매트릭스가 없으면
 *    null 을 반환하고 papers[0] 임의 폴백은 **하지 않는다**.
 *  - PRODUCT_BASE_PRICE_SPECS: 제품 slug 별 산출 모드를 명시. 비매트릭스/collapse
 *    제품은 'quote-only'(자동 sync 제외, 견적전용)로 분류하거나, 대표 용지코드가
 *    확정되면 'paper' 모드로 제품별 용지+수량 지정 쿼리 경로를 쓴다.
 */

import {
  type SwadpiaCategoryData,
  calculateSwadpiaPriceKrw,
} from './swadpia'

export type BasePriceMode = 'matrix' | 'paper' | 'quote-only'

export interface ProductBasePriceSpec {
  mode: BasePriceMode
  /** paper 모드: Swadpia paper_code (제품별 대표 용지 지정) */
  paperCode?: string
  /** paper 모드 기준수량 (미지정 시 매트릭스 최소수량 또는 1) */
  quantity?: number
  /** 양면 여부 (기본 true) */
  doubleSided?: boolean
  /** 분류 근거 메모 */
  note?: string
}

export interface BasePriceResult {
  /** 산출된 기준단가(KRW). null 이면 자동 sync 대상에서 제외(견적전용/데이터없음). */
  priceKrw: number | null
  mode: BasePriceMode
  /** priceKrw 가 null 인 사유 (quote-only / no-matrix / no-data / paper-*) */
  reason?: string
}

/**
 * 매트릭스 기반 결정적 기준단가(KRW).
 *
 * 규칙:
 *  ① 최소수량(min quantity) 선택
 *  ② 그 수량의 entry 중 최저 print_unit2(양면 인쇄단가) 선택
 *  ③ 동일 단가가 복수면 paper_code 사전순으로 결정적 tie-break
 *
 * printEntries 가 비어 있으면 null 을 반환한다(임의 papers[0] 폴백 금지).
 */
export function extractMatrixBasePriceKrw(data: SwadpiaCategoryData): number | null {
  if (data.printEntries.length === 0) return null

  const minQty = Math.min(...data.printEntries.map((e) => e.quantity))
  const atMin = data.printEntries
    .filter((e) => e.quantity === minQty)
    .sort(
      (a, b) =>
        a.print_unit2 - b.print_unit2 || a.paper_code.localeCompare(b.paper_code),
    )

  const chosen = atMin[0]
  if (!chosen || chosen.print_unit2 <= 0) return null
  return Math.round(chosen.print_unit2)
}

/** 매트릭스 최소수량 (없으면 null) */
function minPrintQuantity(data: SwadpiaCategoryData): number | null {
  if (data.printEntries.length === 0) return null
  return Math.min(...data.printEntries.map((e) => e.quantity))
}

/**
 * 제품 slug 별 기준단가 산출 모드.
 *
 * 여기에 없는 slug 는 기본 'matrix'(generic endpoint 가 매트릭스를 주는 카테고리).
 * 단, matrix 로 분류돼도 런타임에 매트릭스가 비어 있으면 deriveProductBasePriceKrw
 * 가 null(reason: 'no-matrix')을 반환하므로, 어떤 경우에도 임의값이 기록되지 않는다.
 *
 * 비매트릭스/collapse 비대표 제품은 'quote-only'로 명시한다. 대표 용지코드가
 * 확정되면 { mode: 'paper', paperCode, quantity } 로 전환해 제품별 기준단가를
 * 산출할 수 있다(후속 데이터 작업).
 */
export const PRODUCT_BASE_PRICE_SPECS: Record<string, ProductBasePriceSpec> = {
  // ── 비매트릭스 (generic endpoint 가 print_info1 매트릭스를 주지 않음) ──
  'stickers': { mode: 'quote-only', note: 'CST1000 비매트릭스' },
  'die-cut-stickers': { mode: 'quote-only', note: 'CST2000 비매트릭스' },
  'holographic-stickers': { mode: 'quote-only', note: 'CST5000 비매트릭스' },
  'roll-stickers': { mode: 'quote-only', note: 'CST7000 비매트릭스' },
  'price-labels': { mode: 'quote-only', note: 'CLP1000 비매트릭스·collapse' },
  'barcode-labels': { mode: 'quote-only', note: 'CLP1000 비매트릭스·collapse' },
  'food-labels': { mode: 'quote-only', note: 'CLP1000 비매트릭스·collapse' },
  'flyers': { mode: 'quote-only', note: 'CLF1000 비매트릭스' },
  'postcards': { mode: 'quote-only', note: 'CDP3000 비매트릭스' },
  'standard-envelopes': { mode: 'quote-only', note: 'CEV1000 비매트릭스·collapse' },
  'admin-envelopes': { mode: 'quote-only', note: 'CEV1000 비매트릭스·collapse' },
  'gusset-envelopes': { mode: 'quote-only', note: 'CEV1000 비매트릭스·collapse' },

  // ── collapse 비대표 제품 (대표 1종만 matrix sync, 나머지는 견적전용) ──
  // CNC3000: collapse 비대표 → 메탈릭 실버 대표 pin 으로 paper 모드 자동가격 복원 (OMO-3076 확정).
  // print_info1 이 paper_code 키 매트릭스(LUX200SVU q200 print_unit2=15000)라 lookupPrintCost 결정적.
  'metallic-business-cards': {
    mode: 'paper',
    paperCode: 'LUX200SVU',   // Luxury 실버 200μ
    quantity: 200,
    doubleSided: true,
    note: 'CNC3000 collapse 비대표 → 메탈릭 실버 대표 pin (OMO-3076 확정)',
  },
  // CLF2000: 대표 brochures(matrix) / menus 견적전용
  'menus': { mode: 'quote-only', note: 'CLF2000 collapse 비대표' },
  // CPR4000: 대표 saddle-stitch-booklet(matrix) / 나머지 견적전용
  'perfect-bound-booklet': { mode: 'quote-only', note: 'CPR4000 collapse 비대표' },
  'catalogs': { mode: 'quote-only', note: 'CPR4000 collapse 비대표' },
  // CPR5000: 사이즈가격(비매트릭스) collapse — 전 제품 견적전용
  'banners': { mode: 'quote-only', note: 'CPR5000 사이즈가격·collapse' },
  'x-banners': { mode: 'quote-only', note: 'CPR5000 사이즈가격·collapse' },
  'rollup-banners': { mode: 'quote-only', note: 'CPR5000 사이즈가격·collapse' },
  'mini-banners': { mode: 'quote-only', note: 'CPR5000 사이즈가격·collapse' },
  // CNR2000: 서식 4종 비매트릭스 collapse — 전 제품 견적전용
  'receipts': { mode: 'quote-only', note: 'CNR2000 비매트릭스·collapse' },
  'quotation-forms': { mode: 'quote-only', note: 'CNR2000 비매트릭스·collapse' },
  'invoice-forms': { mode: 'quote-only', note: 'CNR2000 비매트릭스·collapse' },
  'ncr-forms': { mode: 'quote-only', note: 'CNR2000 비매트릭스·collapse' },
  // CCD2000: 대표 desk-calendars(matrix) / mini-calendars 견적전용
  'mini-calendars': { mode: 'quote-only', note: 'CCD2000 collapse 비대표' },
}

/**
 * 제품 slug + 카테고리 데이터로 기준단가(KRW)를 결정적으로 산출한다.
 * priceKrw 가 null 이면 호출자는 자동 업데이트를 건너뛰어야 한다.
 */
export function deriveProductBasePriceKrw(
  slug: string,
  data: SwadpiaCategoryData,
): BasePriceResult {
  const spec = PRODUCT_BASE_PRICE_SPECS[slug] ?? { mode: 'matrix' as const }

  if (spec.mode === 'quote-only') {
    return { priceKrw: null, mode: 'quote-only', reason: spec.note ?? 'quote-only' }
  }

  if (spec.mode === 'paper') {
    if (!spec.paperCode) {
      return { priceKrw: null, mode: 'paper', reason: 'paper-no-code' }
    }
    const qty = spec.quantity ?? minPrintQuantity(data) ?? 1
    const price = calculateSwadpiaPriceKrw(
      data,
      spec.paperCode,
      qty,
      spec.doubleSided ?? true,
    )
    return price > 0
      ? { priceKrw: Math.round(price), mode: 'paper' }
      : { priceKrw: null, mode: 'paper', reason: 'paper-zero' }
  }

  // matrix (기본)
  const price = extractMatrixBasePriceKrw(data)
  return price !== null
    ? { priceKrw: price, mode: 'matrix' }
    : { priceKrw: null, mode: 'matrix', reason: 'no-matrix' }
}
