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
  // CLF2000 collapse: menus 견적전용 (brochures 는 OMO-3142 garbage 로 quote-only 재분류)
  'menus': { mode: 'quote-only', note: 'CLF2000 collapse 비대표' },
  // CPR4000 collapse 잔여 (saddle-stitch-booklet 는 OMO-3142 garbage 로 quote-only 재분류)
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
  // CCD collapse: mini-calendars 견적전용 (desk-calendars 도 OMO-3142 garbage 로 quote-only 재분류)
  'mini-calendars': { mode: 'quote-only', note: 'CCD2000 collapse 비대표' },

  // ── OMO-3142 인시던트 재분류 ──
  // matrix-default 였으나 라이브 probe(scripts/omo3142-probe.mjs) 결과 generic endpoint 가
  // '수량사다리' 매트릭스가 아닌 '사이즈가격 그리드'(minQty=1, q1 floor 64000/8000 = garbage)를
  // 반환하는 제품들. 다음 cron 에서 base_price_krw 가 64000 등으로 재오염되므로 견적전용 고정.
  // (이슈는 4종만 지목했으나 OMO-3097 #77 이 패키징/메모/포스터를 CATEGORY_MAP 에 추가해
  //  실제 재오염 범위가 더 넓음 — probe 로 전수 확인.)
  'wall-calendars': { mode: 'quote-only', note: 'CCD1000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'desk-calendars': { mode: 'quote-only', note: 'CCD2000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'leaflets': { mode: 'quote-only', note: 'CPR3000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'saddle-stitch-booklet': { mode: 'quote-only', note: 'CPR4000 사이즈가격 그리드 q1=8000 garbage (OMO-3142 probe)' },
  'brochures': { mode: 'quote-only', note: 'CLF2000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'posters': { mode: 'quote-only', note: 'CPR2000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'memo-pads-general': { mode: 'quote-only', note: 'CNR3000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  // 비매트릭스 (matrixRows=0) — 원래도 no-matrix 로 skip 됐으나 의도를 명시
  'sticky-notes': { mode: 'quote-only', note: 'CPS7000 비매트릭스 (OMO-3142 probe)' },
  'wedding-cards': { mode: 'quote-only', note: 'CDP2000 비매트릭스 (OMO-3142 probe)' },
  'greeting-cards-general': { mode: 'quote-only', note: 'CCM2000 비매트릭스 (OMO-3142 probe)' },
  'transparent-stickers': { mode: 'quote-only', note: 'CST1000 비매트릭스 (OMO-3142 probe)' },
  'kraft-stickers': { mode: 'quote-only', note: 'CST1000 비매트릭스 (OMO-3142 probe)' },
  'eco-stickers': { mode: 'quote-only', note: 'CST1000 비매트릭스 (OMO-3142 probe)' },
  // 패키징(박스/가방) — CEO 복구내역 보존 대상. q1=64000 garbage 로 절대 자동 갱신 금지.
  'general-boxes': { mode: 'quote-only', note: 'CHI3000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'corrugated-boxes': { mode: 'quote-only', note: 'CHI3000 사이즈가격 그리드 garbage (OMO-3142 probe)' },
  'gift-boxes': { mode: 'quote-only', note: 'CHI3000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'cake-boxes': { mode: 'quote-only', note: 'CHI3000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'tube-boxes': { mode: 'quote-only', note: 'CHI3000 사이즈가격 그리드 garbage (OMO-3142 probe)' },
  'paper-shopping-bags': { mode: 'quote-only', note: 'CPK4000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  'kraft-bags': { mode: 'quote-only', note: 'CPK3000 사이즈가격 그리드 garbage (OMO-3142 probe)' },
  'gift-bags': { mode: 'quote-only', note: 'CPK2000 사이즈가격 그리드 q1=64000 garbage (OMO-3142 probe)' },
  // invitation-cards(CVS1000): generic JSON endpoint 가 category_code 를 무시하고
  //   명함(CNC1000) 매트릭스로 폴백한다 — q200=4000/SNW300W00 이 CNC1000 과 바이트 동일
  //   (OMO-3143 라이브 probe 2026-06-14: CVS1000 rows=174/derived=4000/paper=SNW300W00,
  //    product=name/card/est/invitation 전부 동일 = CNC1000 과 일치. 반면 CNC2000/3000 은
  //    rows/derived 가 상이해 엔드포인트가 명함류는 실제 구분함 → CVS1000 만 폴백 확정).
  //   실제 초대장(CVS1000) 단가는 goods_view cascade(OMO-3111)에서 MOQ 500매·q500 공급가
  //   70,500 으로, generic matrix 의 4000(=명함값)과 무관. 따라서 4000 은 초대장 실가가
  //   아니며 자동 sync 부적합 → 'quote-only' 확정(last-good 25000 보존). 절대 화이트리스트
  //   등재 금지(4000 이 정상 명함값과 같아 오인 위험 → 회귀테스트로 가드).
  'invitation-cards': {
    mode: 'quote-only',
    note: 'CVS1000 generic endpoint 가 명함 CNC1000 매트릭스로 폴백(q200=4000=명함값), 초대장 실가 아님 (OMO-3143 probe)',
  },
}

/**
 * OMO-3142 가드 — 자동 base_price sync 화이트리스트.
 *
 * 배경: 기존엔 PRODUCT_BASE_PRICE_SPECS 에 명시되지 않은 모든 slug 가 'matrix' 기본으로
 * 떨어져, generic endpoint 가 주는 값을 무조건 기록했다. 그런데 라이브 probe 결과 다수
 * 카테고리(패키징/캘린더/책자/포스터/메모…)는 수량사다리가 아닌 사이즈가격 그리드를 주어
 * q1 floor 64000/8000 같은 garbage 를 산출한다(인시던트 근본원인).
 *
 * 해결: matrix 자동 갱신을 **default-deny** 로 반전. 라이브 probe 로 '제품별 수량사다리
 * (MOQ≥100, 카테고리별 상이값)'가 확인된 slug 만 여기에 등재한다. 미등재 matrix slug 는
 * 'unverified-matrix' 로 skip(last-good 보존) → 미분류/신규 slug 도 절대 garbage 미기록.
 *
 * 등재 근거(OMO-3142 probe, 2026-06-14): CNC1000~6000 명함류는 minQty 100~200,
 * 카테고리별 상이한 정상 단가(4000/3500/10000/8000/9000/4000)를 반환 → 검증.
 */
export const MATRIX_VERIFIED_SLUGS = new Set<string>([
  'business-cards',          // CNC1000 q200=4000
  'premium-business-cards',  // CNC2000 q200=3500
  'pearl-business-cards',    // CNC2000 q200=3500
  'premium-foil-cards',      // CNC3000 q200=10000
  'letterpress-business-cards', // CNC4000 q200=8000
  'transparent-business-cards', // CNC5000 q100=9000
  'uv-business-cards',       // CNC6000 q200=4000
])

/** 정상 수량사다리의 최소 MOQ. 이보다 작은 최소수량(특히 q1)은 사이즈가격 제품의
 *  비-수량 그리드 → 기준단가 부적합(garbage 차단). 검증 제품은 모두 MOQ≥100. */
const MIN_LADDER_QUANTITY = 50

/** 무관 카테고리 다수에 일괄 등장한 q1 floor sentinel(라이브 probe 확인). 검증 slug
 *  라도 이 값이 산출되면 Swadpia 응답 변형으로 보고 기록 거부(belt-and-suspenders). */
const SUSPECT_BASE_PRICE_KRW = new Set<number>([64_000])

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

  // matrix (기본) — OMO-3142 default-deny 가드
  // ① 화이트리스트 미등재 slug 는 자동 갱신 제외(미분류/신규/garbage 카테고리 전부 차단)
  if (!MATRIX_VERIFIED_SLUGS.has(slug)) {
    return { priceKrw: null, mode: 'matrix', reason: 'unverified-matrix' }
  }
  // ② 최소수량이 정상 MOQ 미만이면 사이즈가격 그리드로 보고 거부
  const minQty = minPrintQuantity(data)
  if (minQty !== null && minQty < MIN_LADDER_QUANTITY) {
    return { priceKrw: null, mode: 'matrix', reason: 'suspect-low-moq' }
  }
  const price = extractMatrixBasePriceKrw(data)
  if (price === null) {
    return { priceKrw: null, mode: 'matrix', reason: 'no-matrix' }
  }
  // ③ 무관 카테고리 일괄 garbage sentinel 거부
  if (SUSPECT_BASE_PRICE_KRW.has(price)) {
    return { priceKrw: null, mode: 'matrix', reason: 'suspect-value' }
  }
  return { priceKrw: price, mode: 'matrix' }
}
