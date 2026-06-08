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

/**
 * 후가공 도매 surcharge(KRW)를 반환. 매핑되지 않은 후가공은 0(고객가 미반영).
 * @param value      finishing value (예: 'foil_stamp')
 * @param areaMm2    박/형압 면적(mm²). 미지정 시 기본 면적(50×30) 사용.
 */
export function finishingSurchargeKrw(value: string, areaMm2?: number): number {
  const def = FINISHING_SURCHARGE[value]
  if (!def) return 0
  if (def.areaPriced) {
    const area = areaMm2 && areaMm2 > 0 ? areaMm2 : AREA_PRICE_BASE_MM2
    return Math.round((def.ratePerMm2 ?? 0) * area)
  }
  return def.flatKrw ?? 0
}

// ── OMO-2667: 소비측(주문/결제/자동발주) 배선용 공유 헬퍼 ──────────────────
// 구성기는 후가공을 집계키 finishing="foil_stamp,die_cut" + 면적키 bak_*/ap_* 로
// 직렬화한다. 이 키들은 print_product_options.option_type 에 없으므로 /order·/design
// 진입 시 별도 패스스루가 필요하고, 결제 서버는 정확일치가 아니라 아래 헬퍼로 surcharge 를
// 재계산해야 한다(다중선택 0청구·면적 무시 회귀 방지).

/** /order·/design URL 및 selected_options 에서 별도 복원해야 하는 후가공 키 화이트리스트. */
export const FINISHING_PASSTHROUGH_KEYS = [
  'finishing',
  'bak_x_size_1',
  'bak_y_size_1',
  'ap_x_size_1',
  'ap_y_size_1',
] as const

/** 집계키 finishing="foil_stamp,die_cut" → 개별 value 배열. */
export function parseFinishingValues(options: Record<string, string>): string[] {
  const raw = options['finishing']
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * selected_options 전체에서 후가공 surcharge 합계(도매 KRW)를 계산.
 * 구성기 finishingSurchargeUsd 와 동일 규칙: 면적형(박/형압)은 bak_ / ap_ 입력 면적을
 * 반영하고, 정액형(타공/도무송)은 flat 을 사용. 면적키 미존재 시 기본 면적(50×30).
 */
export function finishingSurchargeKrwFromOptions(options: Record<string, string>): number {
  let total = 0
  for (const v of parseFinishingValues(options)) {
    let areaMm2: number | undefined
    if (v === 'foil_stamp') {
      const w = Number(options['bak_x_size_1'])
      const h = Number(options['bak_y_size_1'])
      if (w > 0 && h > 0) areaMm2 = w * h
    } else if (v === 'deboss_emboss') {
      const w = Number(options['ap_x_size_1'])
      const h = Number(options['ap_y_size_1'])
      if (w > 0 && h > 0) areaMm2 = w * h
    }
    total += finishingSurchargeKrw(v, areaMm2)
  }
  return total
}
