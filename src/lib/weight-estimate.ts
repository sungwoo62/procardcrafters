// OMO-3190: 수량 기반 배송 예상 무게 산출(weight estimation).
//
// 배경
//   배송비가 수량에 무관하게 일괄(고정 unit_weight_g)로만 계산되어, 수량이 늘어도
//   FedEx 견적 무게가 그대로였다. 보드 지시: 종이 평량(gsm) + 수량 → 종이 부피/무게,
//   + 박스 무게까지 더한 "제품 총 무게"를 산출해 FedEx API 운임을 변동시킨다.
//
// 산식(자체 산출 · OMO-2975, 타사 복제 아님)
//   1) 1매 무게(g)  = gsm × 재단면적(m²)            // 면적 = width_mm × height_mm / 1e6
//   2) 종이 무게(g) = 1매 무게 × 수량(부)
//   3) 적재 높이(mm) = 수량 × 1매 두께(caliper)      // caliper ≈ gsm / PAPER_DENSITY_GSM_PER_MM
//   4) 박스 선택    = 종이 무게/적재높이를 담을 수 있는 최소 박스 tier
//   5) 총 무게(kg)  = (종이 무게 + 박스 tare) / 1000
//
// 모든 상수는 일반적인 코팅지 기준의 안전 근사이며, 박스 tier 표는 보드/운영이
// 실측으로 보정 가능하도록 한 곳(BOX_TIERS)에 모아둔다.

/** 코팅지 1매 두께 근사: gsm 1당 약 1µm (= 1000gsm 가 약 1mm). 두꺼운 카드지 보수 근사. */
const PAPER_DENSITY_GSM_PER_MM = 1000

/** 평량을 읽지 못했을 때의 안전 기본값(중간 두께 코팅지). */
export const DEFAULT_GSM = 200

/** 재단 치수를 읽지 못했을 때의 안전 기본 면적(국제 명함 85×55mm). */
const DEFAULT_SHEET_AREA_M2 = (85 * 55) / 1_000_000

export interface BoxTier {
  /** tier 식별 라벨(운영 가독용). */
  label: string
  /** 이 박스가 담을 수 있는 최대 종이 무게(g). 이 값 이하면 채택 후보. */
  maxPaperWeightG: number
  /** 박스 자체 무게(g) — 총 무게에 가산. */
  tareG: number
  /** 박스 내부 치수(mm) — 참고/디버그용(부피 산출 근거). */
  innerDims: { l: number; w: number; h: number }
}

/**
 * 박스 tier 표(작은 것 → 큰 것). 일반 소형 인쇄물 발송 기준의 보수적 근사.
 * 운영이 실측 박스/완충재로 tareG·치수를 보정한다.
 */
export const BOX_TIERS: BoxTier[] = [
  { label: 'mailer-S', maxPaperWeightG: 300,    tareG: 40,   innerDims: { l: 160, w: 110, h: 30 } },
  { label: 'box-S',    maxPaperWeightG: 1_000,  tareG: 120,  innerDims: { l: 220, w: 160, h: 60 } },
  { label: 'box-M',    maxPaperWeightG: 3_000,  tareG: 260,  innerDims: { l: 300, w: 220, h: 120 } },
  { label: 'box-L',    maxPaperWeightG: 7_000,  tareG: 450,  innerDims: { l: 400, w: 300, h: 200 } },
  { label: 'box-XL',   maxPaperWeightG: 15_000, tareG: 800,  innerDims: { l: 500, w: 400, h: 300 } },
]

/** 최대 tier 초과분에 대한 박스 무게 가산(종이 1kg당 추가 박스/완충 무게 g). */
const OVERFLOW_TARE_PER_KG_G = 110

const VALID_GSM = (g: number) => g >= 30 && g <= 1200

/**
 * "350g" / "Snow 300gsm" / "스노우지 250g" / "snow_250" 등 종이 옵션 텍스트에서 평량(gsm) 추출.
 * 1) "g"/"gsm" 가 붙은 숫자를 우선 신뢰. 2) 없으면 옵션 값에 박힌 단독 숫자(예 snow_250)를 fallback.
 * 둘 다 없으면 null.
 */
export function extractGsm(...texts: (string | null | undefined)[]): number | null {
  // 1) g/gsm 앵커 우선 (가장 신뢰도 높음)
  for (const t of texts) {
    if (!t) continue
    const m = String(t).match(/(\d{2,4})\s*g(?:sm)?\b/i)
    if (m && VALID_GSM(Number(m[1]))) return Number(m[1])
  }
  // 2) 옵션 값/코드에 박힌 단독 숫자 (snow_250, art150) — 도메인 한정 fallback
  for (const t of texts) {
    if (!t) continue
    const m = String(t).match(/(\d{2,4})/)
    if (m && VALID_GSM(Number(m[1]))) return Number(m[1])
  }
  return null
}

/** 1매 무게(g) = gsm × 면적(m²). */
export function sheetWeightG(gsm: number, sheetAreaM2: number): number {
  return gsm * sheetAreaM2
}

/** 종이 무게(g)에 맞는 박스 tier 선택 + 박스 tare(g) 반환. */
export function pickBox(paperWeightG: number): { tier: BoxTier | null; tareG: number } {
  const tier = BOX_TIERS.find((b) => paperWeightG <= b.maxPaperWeightG)
  if (tier) return { tier, tareG: tier.tareG }
  // 최대 tier 초과: 가장 큰 박스 tare + 초과 무게 비례 가산.
  const largest = BOX_TIERS[BOX_TIERS.length - 1]
  const overflowKg = (paperWeightG - largest.maxPaperWeightG) / 1000
  return { tier: largest, tareG: largest.tareG + Math.ceil(overflowKg) * OVERFLOW_TARE_PER_KG_G }
}

export interface PaperWeightInput {
  /** 평량(gsm). 없으면 DEFAULT_GSM. */
  gsm?: number | null
  /** 재단 가로(mm). */
  sheetWidthMm?: number | null
  /** 재단 세로(mm). */
  sheetHeightMm?: number | null
  /** 인쇄 매수(부). */
  quantity: number
}

export interface WeightBreakdown {
  /** 종이 무게(g). */
  paperWeightG: number
  /** 박스 tare(g). */
  boxTareG: number
  /** 총 무게(kg) = (paper + box) / 1000. */
  totalKg: number
  /** 적재 높이(mm) — 박스 부피 근거(참고). */
  stackHeightMm: number
  /** 선택된 박스 라벨(null = overflow 기준 최대 박스). */
  boxLabel: string | null
  /** 산출에 사용된 gsm. */
  gsmUsed: number
  /** 산출에 사용된 1매 면적(m²). */
  sheetAreaM2: number
}

/** 단일 품목의 종이+박스 무게 분해 산출. */
export function estimateItemWeight(input: PaperWeightInput): WeightBreakdown {
  const gsm = input.gsm && input.gsm > 0 ? input.gsm : DEFAULT_GSM
  const wMm = input.sheetWidthMm && input.sheetWidthMm > 0 ? input.sheetWidthMm : null
  const hMm = input.sheetHeightMm && input.sheetHeightMm > 0 ? input.sheetHeightMm : null
  const areaM2 = wMm && hMm ? (wMm * hMm) / 1_000_000 : DEFAULT_SHEET_AREA_M2
  const qty = input.quantity > 0 ? input.quantity : 1

  const perSheetG = sheetWeightG(gsm, areaM2)
  const paperWeightG = perSheetG * qty
  const caliperMm = gsm / PAPER_DENSITY_GSM_PER_MM
  const stackHeightMm = caliperMm * qty
  const { tier, tareG } = pickBox(paperWeightG)

  return {
    paperWeightG: Math.round(paperWeightG * 100) / 100,
    boxTareG: tareG,
    totalKg: Math.round(((paperWeightG + tareG) / 1000) * 1000) / 1000,
    stackHeightMm: Math.round(stackHeightMm * 100) / 100,
    boxLabel: tier?.label ?? null,
    gsmUsed: gsm,
    sheetAreaM2: Math.round(areaM2 * 1_000_000) / 1_000_000,
  }
}
