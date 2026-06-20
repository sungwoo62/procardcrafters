import { parseFoilLayersFromOptions } from './swadpia-finishing-fields'

// OMO-2664: 후가공 도매 surcharge(성원애드피아 wholesale KRW) 단일 소스.
//
// 값 출처: OMO-2647 라이브 검증 (CNC1000 명함 GNC1001, 1,000매 기준, 로그인).
//   scripts/test-artifacts/omo2647/surcharge.json / SUMMARY.md
//     - 타공(drilled_hole):  tagong_amt   = 3,800   (정액, 4mm 1개)
//     - 도무송(die_cut):     domusong_amt = 21,500  (정액, 전체도무송 라운드)
//     - 박(foil_stamp):      bak_amt      = 22,300  @ 면적 50×30mm(=1,500mm²)
//     - 형압(deboss_emboss): ap_amt      ≈ 22,300  @ 면적 50×30mm(=1,500mm²)
//
// 고객가 = wholesale KRW × product.margin_multiplier × exchangeRate
//   (보드 승인 77c05ea6 = product margin_multiplier 적용).
//
// 한계(정직히 명시):
//   - surcharge 는 명함(CNC1000)에서만 검증됨. 면적·정액 값은 명함 폼 기준.
//   - 박/형압은 면적(가로×세로 mm)에 선형 비례(성원 calcuBakPrice). 50×30mm 를
//     기준점으로 ratePerMm2 도출. 실제 성원 단가는 면적 외 박종류/사이즈 구간에도
//     의존하므로 본 추정은 면적 1차 근사. 자동발주 시 성원 calcuEstimate 가 최종 권위.
//   - surcharge 는 성원 1,000매 기준 셋업비 성격(동판/목형/타공) — 수량 의존성은
//     v1에서 정액 취급. 정확 단가는 자동발주 모달의 성원 재계산이 확정.

export interface FinishingSurchargeDef {
  /** finishing-catalog.ts 의 value 와 동일 키 */
  value: string
  /** 면적 비례 여부(true 면 areaMm2 입력에 따라 단가 변동) */
  areaPriced: boolean
  /** 정액 wholesale KRW (areaPriced=false 일 때) */
  flatKrw?: number
  /** mm² 당 wholesale KRW (areaPriced=true 일 때) */
  ratePerMm2?: number
}

/** 박/형압 면적 입력 UI 가 붙기 전/기본값 (로고 영역 가정, OMO-2647). */
export const FINISHING_DEFAULT_AREA_MM = { width: 50, height: 30 } as const

const AREA_PRICE_BASE_KRW = 22300
const AREA_PRICE_BASE_MM2 = FINISHING_DEFAULT_AREA_MM.width * FINISHING_DEFAULT_AREA_MM.height // 1,500

/** 면적 입력 UI 를 노출해야 하는 후가공(가로×세로 mm). */
export const AREA_PRICED_FINISHINGS = ['foil_stamp', 'deboss_emboss'] as const

export const FINISHING_SURCHARGE: Record<string, FinishingSurchargeDef> = {
  drilled_hole: { value: 'drilled_hole', areaPriced: false, flatKrw: 3800 },
  die_cut: { value: 'die_cut', areaPriced: false, flatKrw: 21500 },
  foil_stamp: { value: 'foil_stamp', areaPriced: true, ratePerMm2: AREA_PRICE_BASE_KRW / AREA_PRICE_BASE_MM2 },
  deboss_emboss: { value: 'deboss_emboss', areaPriced: true, ratePerMm2: AREA_PRICE_BASE_KRW / AREA_PRICE_BASE_MM2 },
}

// OMO-3520/OMO-3562: 후가공 수량의존 단가 공식(성원 wholesale KRW = intercept + perUnit·매).
// 보드 지시(2026-06-19): "수량 옵션에 따라서 (후가공) 금액 증가되게". 기존 정액/면적 모델은
// 수량 무관이라 성원 후가공 원가(수량 선형)와 괴리 → 고수량 역마진. 본 공식으로 수량 반영.
//
// 출처: OMO-3511 후가공 RE(클라이언트 JS 직독) + OMO-3520 라이브 스윕 실측 캘리브레이션.
//   - foil/deboss 는 면적(50×30=1,500mm² 기준)에 추가 비례 → areaBaselineMm2 로 스케일.
//   - 최종 권위는 자동발주 시 성원 calcuEstimate. 표시가는 공식 1차근사.
interface FinishingQtyFormula {
  /** 셋업비 성격 상수항(KRW) */
  intercept: number
  /** 매당 단가(KRW/매) */
  perUnit: number
  /** foil/deboss: 캘리브레이션 기준 면적(mm²). 지정 시 areaMm2 비례 스케일. */
  areaBaselineMm2?: number
}

export const FINISHING_QTY_FORMULA: Record<string, FinishingQtyFormula> = {
  foil_stamp: { intercept: 4525, perUnit: 35.58, areaBaselineMm2: AREA_PRICE_BASE_MM2 },   // OMO-3520 5점 실측(R²≈1)
  deboss_emboss: { intercept: 7000, perUnit: 28.8, areaBaselineMm2: AREA_PRICE_BASE_MM2 }, // OMO-3511 형압
  die_cut: { intercept: 15226, perUnit: 18.87 },     // 슬로프 OMO-3511, 절편=실측 200매 19,000 캘리브
  drilled_hole: { intercept: 1814, perUnit: 3.43 },  // 절편=실측 200매 2,500 캘리브
  epoxy: { intercept: 0, perUnit: 45 },              // 실측 200매 9,000 = 45·매 정확(전면)
  score_crease: { intercept: 4256, perUnit: 6.82 },  // 오시 OMO-3511
  perforation: { intercept: 4256, perUnit: 6.82 },   // 미싱 OMO-3511
  round_corner: { intercept: 1246, perUnit: 4.6 },   // 귀도리 OMO-3511
}

/**
 * 후가공 도매 surcharge(KRW)를 반환. 매핑되지 않은 후가공은 0(고객가 미반영).
 * @param value      finishing value (예: 'foil_stamp')
 * @param areaMm2    박/형압 면적(mm²). 미지정 시 기본 면적(50×30) 사용.
 * @param quantity   발주 수량(매). 지정 시 수량의존 공식 사용(OMO-3520). 미지정 시 정액/면적(하위호환).
 */
export function finishingSurchargeKrw(value: string, areaMm2?: number, quantity?: number): number {
  // OMO-3520: 수량이 주어지면 수량의존 공식 우선(보드 지시 — 수량 반영).
  if (quantity != null && Number.isFinite(quantity) && quantity > 0) {
    const f = FINISHING_QTY_FORMULA[value]
    if (f) {
      let krw = f.intercept + f.perUnit * quantity
      if (f.areaBaselineMm2 && areaMm2 && areaMm2 > 0) {
        krw *= areaMm2 / f.areaBaselineMm2 // foil/deboss 면적 스케일
      }
      return Math.round(krw)
    }
    // 공식 미등록 finishing 은 정액 폴백(아래)
  }
  const def = FINISHING_SURCHARGE[value]
  if (!def) return 0
  if (def.areaPriced) {
    const area = areaMm2 && areaMm2 > 0 ? areaMm2 : AREA_PRICE_BASE_MM2
    return Math.round((def.ratePerMm2 ?? 0) * area)
  }
  return def.flatKrw ?? 0
}

// OMO-2667: 후가공 직렬화 키 — option_type 화이트리스트와 별개로 /order·/design 진입 시
// 별도 복원·저장해야 하는 키들. ProductConfigurator.finishingParams 가 내보내는 키와 일치.
//   - finishing: 콤마구분 value 목록(예 "foil_stamp,die_cut") — expandFinishingToSwadpiaFields 소비
//   - bak_*/ap_* size: 박/형압 면적(mm). 결제 surcharge 면적비례 + 자동발주 면적단가에 사용.
export const FINISHING_PASSTHROUGH_KEYS = [
  'finishing',
  // OMO-3257: 박은 최대 3 레이어(면적 합산). 레이어별 면적 키를 모두 통과·제외 대상에 포함.
  'bak_x_size_1',
  'bak_y_size_1',
  'bak_x_size_2',
  'bak_y_size_2',
  'bak_x_size_3',
  'bak_y_size_3',
  'ap_x_size_1',
  'ap_y_size_1',
] as const

/** 면적 키 → 해당 면적비례 후가공 value. (server surcharge 재계산용) */
const AREA_KEYS_BY_FINISHING: Record<string, { x: string; y: string }> = {
  foil_stamp: { x: 'bak_x_size_1', y: 'bak_y_size_1' },
  deboss_emboss: { x: 'ap_x_size_1', y: 'ap_y_size_1' },
}

/**
 * OMO-2667: selected_options(직렬화된 `finishing` + 면적키)에서 후가공 surcharge 총합(KRW)을
 * 서버 권위로 재계산한다. 클라이언트 표시가를 신뢰하지 않고 결제·SSR 양쪽에서 동일 로직으로 산출.
 *
 *  - `finishing` 콤마분해 후 각 value 의 finishingSurchargeKrw 를 합산.
 *  - 면적비례 후가공(박/형압)은 선택된 면적키(bak_x_size_1 등)로 areaMm2 산출, 없으면 기본면적.
 *  - `finishing` 키가 없으면 0(후가공 미선택 — 회귀 없음).
 */
export function finishingSurchargeKrwFromOptions(
  selectedOptions: Record<string, string>,
  quantity?: number,
): number {
  const raw = selectedOptions.finishing
  if (!raw) return 0
  // OMO-3520: 수량 인자 우선, 없으면 selectedOptions.paper_qty/quantity 에서 파생(수량 반영).
  const qty = quantity ?? (() => {
    const q = Number(selectedOptions.paper_qty ?? selectedOptions.quantity)
    return Number.isFinite(q) && q > 0 ? q : undefined
  })()
  let total = 0
  for (const value of raw.split(',').map((v) => v.trim()).filter(Boolean)) {
    // OMO-3257: 박(foil)은 최대 3 레이어 면적 합산 — 레이어별 surcharge 를 각각 가산한다.
    // (성원 setPPBakAmtSum 과 동일하게 레이어 면적 단가를 합산하는 1차 근사. 최종
    //  금액은 자동발주 모달의 성원 calcuEstimate 응답 bak_amt 가 권위.)
    if (value === 'foil_stamp') {
      const layers = parseFoilLayersFromOptions(selectedOptions)
      if (layers.length === 0) {
        total += finishingSurchargeKrw(value, undefined, qty) // 면적 미지정 → 기본면적 1회
      } else {
        for (const l of layers) {
          const area = l.x_size > 0 && l.y_size > 0 ? l.x_size * l.y_size : undefined
          total += finishingSurchargeKrw(value, area, qty)
        }
      }
      continue
    }
    let areaMm2: number | undefined
    const areaKeys = AREA_KEYS_BY_FINISHING[value]
    if (areaKeys) {
      const w = Number(selectedOptions[areaKeys.x])
      const h = Number(selectedOptions[areaKeys.y])
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) areaMm2 = w * h
    }
    total += finishingSurchargeKrw(value, areaMm2, qty)
  }
  return total
}

/** 후가공/면적 직렬화 키 집합(정확일치 가격합산에서 제외 대상). */
export const FINISHING_KEY_SET: ReadonlySet<string> = new Set<string>(FINISHING_PASSTHROUGH_KEYS)

/**
 * OMO-2673: 주문 extra surcharge(KRW) 배열을 단일 권위로 산정한다.
 *
 * 마이그레이션(20260608000020)이 option_type='finishing' 행을 non-zero extra_price_krw 로
 * 시드하므로, 정확일치(option_type+value) 합산에 후가공 키를 포함하면 단일 후가공이
 * (시드 행 단가 + finishingSurchargeKrwFromOptions) 로 **2배 청구**된다. 후가공 가격은
 * finishingSurchargeKrwFromOptions 만 권위로 삼고 정확일치 루프에서는 제외한다.
 *
 *  - 비후가공 옵션: 기존 정확일치(option_type+value) → extra_price_krw 합산.
 *  - 후가공: finishingSurchargeKrwFromOptions(다중·면적 반영) 1회만 가산.
 *  - 후가공 미선택: surcharge=0 → 회귀 없음.
 */
export function buildOrderExtraPricesKrw(
  selectedOptions: Record<string, string>,
  productOptions: { option_type: string; value: string; extra_price_krw: number }[],
): number[] {
  const base = Object.entries(selectedOptions)
    .filter(([type]) => !FINISHING_KEY_SET.has(type))
    .map(([type, value]) => {
      const opt = productOptions.find((o) => o.option_type === type && o.value === value)
      return opt?.extra_price_krw ?? 0
    })
  const finishingSurchargeKrw = finishingSurchargeKrwFromOptions(selectedOptions)
  return finishingSurchargeKrw > 0 ? [...base, finishingSurchargeKrw] : base
}
