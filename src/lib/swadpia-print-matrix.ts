/**
 * 성원 인쇄단가 매트릭스 — OMO-3623 표집 적재 (서버 전용, 클라 비노출)
 *
 * 배경(OMO-3610/3623):
 *  전단·포스터·브로셔·책자·캘린더 10종은 generic JSON 가격엔드포인트가 '사이즈가격
 *  그리드 garbage'(q1=64000 등)를 반환해 base_price 자동 sync 대상에서 제외(quote-only,
 *  last-good 보존)돼 있었다(OMO-3142). 성원 goods_view(실주문폼)에는 옵션별 실가가
 *  cascade 로 존재한다.
 *
 *  OMO-3623 하니스가 성원 자기 cascade 코드(print/postpress/product_class)를 headless
 *  chromium 으로 그대로 실행해 hidden 가격필드(total_price/supply_amt)를 parity-게이트로
 *  직독·표집했다(화면 OCR/LLM 금지 절대규칙 준수). 본 모듈은 그 표집을 코드 레벨
 *  결정적 가격원으로 적재한다.
 *
 * 적재 단위:
 *  base_price_krw = 대표 MOQ 구성의 성원 공급가(supply_amt, order_count=1, parity pass).
 *  고객가 = (base_price_krw + Σextra) × margin × FX (src/lib/pricing.ts) 와 정합.
 *  명함류 matrix base(print_unit2=MOQ 라인합계)와 동일한 '대표 MOQ 라인합계' 의미.
 *
 * 가격모델(카테고리군별 상이 — OMO-3623 발견):
 *  - CPR/CLF(전단·포스터·브로셔·책자): total_price === supply_amt (라인합계)
 *  - CCD(캘린더, 디지털/토너): supply_amt = total_price × order_count.
 *    적재값은 order_count=1 의 supply_amt(=부수단가) 이므로 base 로 직접 사용 가능.
 *
 * 제약:
 *  - 박(箔)은 total_price 미포함 → 별색 surcharge(finishing-surcharge)로 분리(범위 외).
 *  - 라이브 고객가 전환(라우팅 ON)은 보드 가격 승인 게이트. 기본 dormant.
 */

export interface PrintMatrixEntry {
  /** 성원 category_code */
  categoryCode: string
  /** goods_view estimate-class (동적 추출, 없으면 null) */
  estimateClass: string | null
  /** 대표 MOQ 구성의 성원 공급가(KRW) = base_price_krw 적재값 */
  baseSupplyKrw: number
  /** OMO-3623 표집 라벨(대표 구성 근거) */
  label: string
  /** 'line-total'(CPR/CLF) | 'unit×count'(CCD) */
  priceModel: 'line-total' | 'unit×count'
}

/**
 * OMO-3623 표집 적재 — slug → 대표 MOQ 공급가.
 * 출처: scripts/data/omo3623-print-price-samples.json (13 표집 / 10 slug, parity 13 pass·0 block).
 * 값은 sample_index=0, order_count=1, gate=pass 인 대표 구성의 supply_amt.
 */
export const PRINT_MATRIX: Record<string, PrintMatrixEntry> = {
  // ── CPR/CLF (전단·포스터·브로셔·책자): total_price === supply_amt ──
  'leaflets': {
    categoryCode: 'CPR3000',
    estimateClass: 'CLF2000',
    baseSupplyKrw: 119_800,
    label: 'ART150 A4 양면4/4 1000매 PTM10',
    priceModel: 'line-total',
  },
  'posters': {
    categoryCode: 'CPR2000',
    estimateClass: null,
    baseSupplyKrw: 87_200,
    label: 'ART150 A2 단면 250매 PTM10',
    priceModel: 'line-total',
  },
  'brochures': {
    categoryCode: 'CLF2000',
    estimateClass: null,
    baseSupplyKrw: 119_800,
    label: 'ART150 A4 양면4/4 1000매 PTM10',
    priceModel: 'line-total',
  },
  'menus': {
    categoryCode: 'CLF2000',
    estimateClass: null,
    baseSupplyKrw: 119_800,
    label: 'ART150 A4 양면4/4 1000매 PTM10',
    priceModel: 'line-total',
  },
  'saddle-stitch-booklet': {
    categoryCode: 'CPR4000',
    estimateClass: null,
    baseSupplyKrw: 823_000,
    label: '200부 표지ARE190 내지ARE105 32p PTM20',
    priceModel: 'line-total',
  },
  'perfect-bound-booklet': {
    categoryCode: 'CPR4000',
    estimateClass: null,
    baseSupplyKrw: 823_000,
    label: '200부 표지ARE190 내지ARE105 32p PTM20',
    priceModel: 'line-total',
  },
  'catalogs': {
    categoryCode: 'CPR4000',
    estimateClass: null,
    baseSupplyKrw: 823_000,
    label: '200부 표지ARE190 내지ARE105 32p PTM20',
    priceModel: 'line-total',
  },

  // ── CCD (캘린더, 디지털/토너): supply_amt = unit × order_count ──
  'wall-calendars': {
    categoryCode: 'CCD1000',
    estimateClass: null,
    baseSupplyKrw: 375_000,
    label: 'ART180 벽걸이 100부 PTC20',
    priceModel: 'unit×count',
  },
  'desk-calendars': {
    categoryCode: 'CCD2000',
    estimateClass: null,
    baseSupplyKrw: 7_500,
    label: 'ART180 탁상 디지털 DPF12',
    priceModel: 'unit×count',
  },
  'mini-calendars': {
    categoryCode: 'CCD2000',
    estimateClass: null,
    baseSupplyKrw: 7_500,
    label: 'ART180 탁상 디지털 DPF12',
    priceModel: 'unit×count',
  },
}

/** OMO-3623 매트릭스가 커버하는 slug 집합 (quote-only → matrix 재분류 대상). */
export const PRINT_MATRIX_SLUGS = new Set(Object.keys(PRINT_MATRIX))

/**
 * slug 의 표집 적재 base_price_krw. 미커버 slug 는 null.
 * (양수·parity pass 표집만 적재돼 있으므로 항상 양수 또는 null.)
 */
export function printMatrixBaseKrw(slug: string): number | null {
  return PRINT_MATRIX[slug]?.baseSupplyKrw ?? null
}

/**
 * 성원 매트릭스 라우팅(라이브 고객가 전환) 활성 여부.
 *
 * 기본 OFF(dormant) — 라이브 고객가를 바꾸는 컷오버는 보드 전용 승인 게이트.
 * 'on' | '1' | 'true' 일 때만 활성. 그 외(미설정 포함)는 현행 유지(quote-only/last-good).
 */
export function isMatrixRoutingEnabled(): boolean {
  const v = (process.env.SWADPIA_MATRIX_ROUTING ?? '').trim().toLowerCase()
  return v === 'on' || v === '1' || v === 'true'
}
