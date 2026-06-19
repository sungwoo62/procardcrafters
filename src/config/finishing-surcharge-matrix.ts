// OMO-3511: 성원 후가공 가격공식 면밀 RE 결과 — 공식기반(수량의존) surcharge 매트릭스.
//
// ⚠️ DORMANT(휴면) — 라이브 가격경로 미연결. 본 모듈은 OMO-3411(박) RE 와 동일방식으로
//   역설계한 성원 실단가 공식을 코드화한 "적재안"이다. 활성화(현행 finishing-surcharge.ts
//   정액 모델 → 본 매트릭스 라우팅 전환)는 **보드 가격 승인 게이트**다. import 하지 말 것.
//
// 데이터 원천(결정론): scripts/test-artifacts/omo3511/finishing-sweep.json (2026-06-19 라이브 측정,
//   CNC1000 GNC1001 명함, hidden {type}_amt 직독). 분석: scripts/test-artifacts/omo3511/FINISHING-RE.md.
//
// 핵심(보드 보고): 현행 정액 surcharge 는 저수량 캘리브레이션값이라 고수량에서 대규모 과소청구(손해).
//   성원 단가는 전 종목 **매수 선형**(amt ≈ base + rate·매). 박/형압은 추가로 **면적 계단 × 매수**.
//
// 범위 한계: 본 단가는 **명함(CNC1000)** 측정값. 타 카테고리(CST/CLF/CPR…)는 폼이 달라 재측정 필요.

export interface QtyLinearModel {
  /** 절편(KRW) — 셋업비 성격 */
  base: number
  /** 매당 단가(KRW/매) */
  rate: number
}

export interface FinishingFormula {
  value: string
  label_ko: string
  /** 측정 브래킷 {매수: wholesale KRW} (기본옵션 기준, 보간/외삽의 권위 포인트) */
  qtyPoints: Record<number, number>
  /** 브래킷 보간/외삽용 선형 모델(최소제곱 적합) */
  qtyModel: QtyLinearModel
  /** 면적 의존 여부(박/형압) — true 면 areaMm2 배수 적용 */
  areaPriced?: boolean
  note?: string
}

/** 측정 브래킷 사이는 선형보간, 밖은 qtyModel 로 외삽해 wholesale KRW 산출. */
export function qtyInterpolate(f: FinishingFormula, quantity: number): number {
  const pts = Object.keys(f.qtyPoints).map(Number).sort((a, b) => a - b)
  if (pts.length === 0) return 0
  if (quantity <= pts[0] || quantity >= pts[pts.length - 1]) {
    // 측정 범위 밖 → 선형모델 외삽(음수 방지)
    return Math.max(0, Math.round(f.qtyModel.base + f.qtyModel.rate * quantity))
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const lo = pts[i], hi = pts[i + 1]
    if (quantity >= lo && quantity <= hi) {
      const yl = f.qtyPoints[lo], yh = f.qtyPoints[hi]
      return Math.round(yl + ((yh - yl) * (quantity - lo)) / (hi - lo))
    }
  }
  return f.qtyPoints[pts[pts.length - 1]]
}

// ─── 측정 브래킷 + 선형모델 (CNC1000, 2026-06-19) ────────────────────────────

export const FINISHING_FORMULA: Record<string, FinishingFormula> = {
  round_corner: {
    value: 'round_corner', label_ko: '귀도리',
    qtyPoints: { 500: 3000, 1000: 5900, 2000: 11200, 5000: 24000 },
    qtyModel: { base: 1246, rate: 4.6 },
    note: '모서리수(1~4)·반경(4/6mm) 가격무관. 수량만 의존.',
  },
  epoxy: {
    value: 'epoxy', label_ko: '에폭시',
    qtyPoints: { 500: 22500, 1000: 45000, 2000: 90000, 5000: 225000 },
    qtyModel: { base: 0, rate: 45 },
    note: '원점통과 완전선형 45·매. 양면(EPT30)=2×(=90·매).',
  },
  score_crease: {
    value: 'score_crease', label_ko: '오시',
    qtyPoints: { 500: 7000, 1000: 11000, 2000: 19000, 5000: 38000 },
    qtyModel: { base: 4256, rate: 6.82 },
    note: '줄수(1/2/3/십자) 가격무관. 세로방향(OMD20)=가로−2,000.',
  },
  perforation: {
    value: 'perforation', label_ko: '미싱',
    qtyPoints: { 500: 7000, 1000: 11000, 2000: 19000, 5000: 38000 },
    qtyModel: { base: 4256, rate: 6.82 },
    note: '오시와 동일 단가. 줄수 가격무관.',
  },
  die_cut: {
    value: 'die_cut', label_ko: '도무송',
    qtyPoints: { 500: 21500, 1000: 30000, 2000: 49000, 5000: 106000 },
    qtyModel: { base: 11533, rate: 18.87 },
    note: '개당 ~+12,400(num). 사물모양(DMT53) +17,900. 전체=부분.',
  },
  drilled_hole: {
    value: 'drilled_hole', label_ko: '타공',
    qtyPoints: { 500: 3800, 1000: 6100, 2000: 10100, 5000: 19500 },
    qtyModel: { base: 2593, rate: 3.43 },
    note: '개당 ~+2,200(num). 크기(3~8mm) 가격무관.',
  },
  foil_stamp: {
    value: 'foil_stamp', label_ko: '박', areaPriced: true,
    qtyPoints: { 500: 22300, 1000: 40100, 2000: 75700, 5000: 182400 },
    qtyModel: { base: 4525, rate: 35.58 },
    note: '면적 50×30mm 기준. 면적=계단+floor(≤600mm²→18,500). 양면 ≈1.84×, 홀로그램 +5,400. 면적×매수 이중의존.',
  },
  deboss_emboss: {
    value: 'deboss_emboss', label_ko: '형압', areaPriced: true,
    qtyPoints: { 500: 21400, 1000: 35800, 2000: 64600, 5000: 151000 },
    qtyModel: { base: 7000, rate: 28.8 },
    note: '면적 50×30mm 기준. 박과 동형(면적×매수). section/type 가격무관.',
  },
  // 넘버링: 명함 GNC1001 차단(용지 게이트)으로 실단가 미측정 → 0 유지. 넘버링 허용 상품 측정 필요(자식이슈).
  numbering: {
    value: 'numbering', label_ko: '넘버링',
    qtyPoints: {},
    qtyModel: { base: 0, rate: 0 },
    note: '명함 차단=0. 넘버링 허용 상품에서 별도 측정 필요(OMO-3511 follow-up).',
  },
}

/** 옵션 배수/가산(기본옵션 대비). 활성화 시 surcharge 에 곱/가산. */
export const FINISHING_OPTION_MODIFIERS = {
  epoxy: { sideDouble: 2 }, // 양면 ×2
  score_crease: { verticalDelta: -2000 }, // 세로방향 −2,000
  die_cut: { perExtraUnit: 12400, shapeObjectDelta: 17900 },
  drilled_hole: { perExtraUnit: 2200 },
  foil_stamp: { sideDoubleMultiplier: 1.84, hologramDelta: 5400, mukDelta: 500 },
} as const

/**
 * 공식기반 후가공 wholesale KRW (DORMANT). 현행 finishingSurchargeKrw(정액) 대체 후보.
 * @param value    finishing value
 * @param quantity 발주 매수(필수 — 수량 미지정 시 성원 단가 산출 불가; 0 반환)
 */
export function finishingWholesaleKrwFormula(value: string, quantity: number): number {
  const f = FINISHING_FORMULA[value]
  if (!f || !quantity || quantity <= 0) return 0
  return qtyInterpolate(f, quantity)
}
