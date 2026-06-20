// OMO-3567: 명함(CNC/GNC) 후가공 세부옵션 단가 매트릭스 엔진.
//
// 데이터 원천(결정론): OMO-3566 이 성원 swadpia CNC1000/GNC1001 라이브에서 hidden {type}_amt 를
//   직독해 표집한 538-point 그리드(±0). 벤더링: src/data/finishing-card-matrix.json
//   (= scripts/test-artifacts/omo3566/finishing-samples-{bak,ap,domusong}.json 통합).
//
// 현행 finishing-surcharge.ts 의 단일 대표값(박/형압=면적선형, 수량 무시; 도무송=정액)을
//   **세부옵션 축**(박: 종류×면×면적×수량 / 형압: 면적×수량 / 도무송: 모양×개수×수량)으로
//   승격하는 룩업이다. 핵심 이득: 수량 의존성 반영(현행 1,000매 셋업값 정액 → 고수량 과소청구 제거).
//
// ⚠️ DORMANT — 라이브 가격경로는 finishing-surcharge.ts 의 FINISHING_MATRIX_ROUTING 플래그(기본 OFF)로
//   라우팅된다. 활성화(고객 표시가/청구가 변경)는 **보드 가격 승인 게이트**(OMO-3511 a344e1b4).
//
// 범위 한계(정직 기록): 본 그리드는 **명함(CNC1000)** 측정값이다. 타 카테고리(CST/CLF/CPR…)는
//   폼·가격함수가 달라(OMO-3561/3563/3565) finishing-surcharge-matrix.ts 의 카테고리별 클로즈드폼을
//   쓴다. 면적은 5개 샘플 버킷(10x10·20x20·30x20·50x30·60x40)으로, 입력 면적은 최근접 버킷으로 스냅한다
//   (성원 박/형압 면적은 연속선형이 아니라 계단형 — OMO-3511 RE). 수량은 샘플 브래킷 내 선형보간,
//   범위 밖은 per-축 선형모델(최소제곱 base+rate)로 외삽한다.

import matrixData from '@/data/finishing-card-matrix.json'

type QtyMap = Record<string, number>
interface LinearModel {
  base: number
  rate: number
}

interface BakData {
  matrix: Record<string, Record<string, Record<string, QtyMap>>> // type → side → areaKey → {qty: KRW}
  qtyModel_50x30: Record<string, LinearModel> // `${type}.${side}` → model (50x30 기준)
}
interface AreaData {
  matrix: Record<string, QtyMap> // areaKey → {qty: KRW}
  qtyModel: Record<string, LinearModel> // areaKey → model
}
interface DomusongData {
  matrix: Record<string, Record<string, QtyMap>> // shape → `n${num}` → {qty: KRW}
  qtyModel: Record<string, LinearModel> // `${shape}.n${num}` → model
}

const BAK = (matrixData as { bak: BakData }).bak
const AP = (matrixData as { ap: AreaData }).ap
const DOMUSONG = (matrixData as { domusong: DomusongData }).domusong

/** 기본 세부옵션 (UI 미선택 시 — 성원 폼 기본값과 일치, swadpia-finishing-fields.ts). */
export const CARD_FOIL_DEFAULT_TYPE = 'BKT02' // 금박(유광)
export const CARD_FOIL_DEFAULT_SIDE = 'BKD10' // 전면
export const CARD_DOMUSONG_DEFAULT_SHAPE = 'DMT51' // 라운드/사각/원
export const CARD_DOMUSONG_DEFAULT_NUM = 1

/** 박 기준 면적(mm). 면적 미지정 시 사용(로고 영역 가정, finishing-surcharge.ts 와 동일). */
const REF_AREA_MM = { width: 50, height: 30 } as const
const REF_AREA_KEY = '50x30'

/** "WxH" areaKey → 면적(mm²). */
function areaKeyToMm2(key: string): number {
  const [w, h] = key.split('x').map(Number)
  return (w || 0) * (h || 0)
}

/** 입력 면적(mm²)을 샘플된 areaKey 중 면적 최근접 버킷으로 스냅. */
function snapAreaKey(available: string[], areaMm2: number): string {
  if (available.includes(REF_AREA_KEY) && (!areaMm2 || areaMm2 <= 0)) return REF_AREA_KEY
  let best = available[0]
  let bestDelta = Infinity
  for (const k of available) {
    const delta = Math.abs(areaKeyToMm2(k) - areaMm2)
    if (delta < bestDelta) {
      bestDelta = delta
      best = k
    }
  }
  return best
}

/**
 * 수량 룩업/보간: 샘플 포인트 내부는 인접 브래킷 선형보간, 외부는 선형모델 외삽(없으면 인접 2점 외삽).
 */
function interpQty(points: QtyMap, quantity: number, model?: LinearModel): number {
  const qtys = Object.keys(points).map(Number).filter((q) => Number.isFinite(q)).sort((a, b) => a - b)
  if (qtys.length === 0) return 0
  // 정확 일치
  if (points[String(quantity)] != null) return points[String(quantity)]
  const lo = qtys[0]
  const hi = qtys[qtys.length - 1]
  if (quantity <= lo || quantity >= hi) {
    if (model) return Math.max(0, Math.round(model.base + model.rate * quantity))
    // 모델 없으면 인접 2점으로 선형 외삽
    if (qtys.length >= 2) {
      const [a, b] = quantity <= lo ? [qtys[0], qtys[1]] : [qtys[qtys.length - 2], qtys[qtys.length - 1]]
      const ya = points[String(a)]
      const yb = points[String(b)]
      const slope = (yb - ya) / (b - a)
      return Math.max(0, Math.round(ya + slope * (quantity - a)))
    }
    return points[String(qtys[0])]
  }
  // 내부 선형보간
  for (let i = 0; i < qtys.length - 1; i++) {
    const a = qtys[i]
    const b = qtys[i + 1]
    if (quantity >= a && quantity <= b) {
      const ya = points[String(a)]
      const yb = points[String(b)]
      return Math.round(ya + ((yb - ya) * (quantity - a)) / (b - a))
    }
  }
  return points[String(hi)]
}

export interface CardFoilParams {
  /** 발주 매수(필수 — 수량 미지정 시 0) */
  quantity: number
  /** 박 면적(mm²). 미지정 시 기준 50×30. */
  areaMm2?: number
  /** 박 종류코드 BKT0x (미지정 시 BKT02 금박유광) */
  bakType?: string
  /** 박 면 BKD10(전면)/BKD20(후면)/BKD30(양면) (미지정 시 BKD10). BKD20=BKD10 동가. */
  side?: string
}

/**
 * 명함 박(foil) wholesale KRW — 종류×면×면적×수량. 매핑 누락 종류/면은 BKT02/BKD10 기준으로 폴백.
 */
export function cardFoilWholesaleKrw(p: CardFoilParams): number {
  const { quantity } = p
  if (!quantity || quantity <= 0) return 0
  const bakType = p.bakType && BAK.matrix[p.bakType] ? p.bakType : CARD_FOIL_DEFAULT_TYPE
  // BKD20(후면) = BKD10(전면) 동가 (OMO-3566). 매트릭스 측은 BKD10/BKD30 만 표집.
  let side = p.side === 'BKD30' ? 'BKD30' : 'BKD10'
  const typeNode = BAK.matrix[bakType] ?? BAK.matrix[CARD_FOIL_DEFAULT_TYPE]
  if (!typeNode[side]) side = 'BKD10'
  const sideNode = typeNode[side] ?? typeNode.BKD10
  if (!sideNode) return 0
  const areaMm2 = p.areaMm2 && p.areaMm2 > 0 ? p.areaMm2 : REF_AREA_MM.width * REF_AREA_MM.height
  const areaKey = snapAreaKey(Object.keys(sideNode), areaMm2)
  const points = sideNode[areaKey]
  const model = areaKey === REF_AREA_KEY ? BAK.qtyModel_50x30[`${bakType}.${side}`] : undefined
  return interpQty(points, quantity, model)
}

export interface CardEmbossParams {
  /** 발주 매수 */
  quantity: number
  /** 형압 면적(mm²). 미지정 시 기준 50×30. */
  areaMm2?: number
}

/** 명함 형압(deboss/emboss) wholesale KRW — 면적×수량. */
export function cardEmbossWholesaleKrw(p: CardEmbossParams): number {
  const { quantity } = p
  if (!quantity || quantity <= 0) return 0
  const areaMm2 = p.areaMm2 && p.areaMm2 > 0 ? p.areaMm2 : REF_AREA_MM.width * REF_AREA_MM.height
  const areaKey = snapAreaKey(Object.keys(AP.matrix), areaMm2)
  return interpQty(AP.matrix[areaKey], quantity, AP.qtyModel[areaKey])
}

export interface CardDieCutParams {
  /** 발주 매수 */
  quantity: number
  /** 도무송 모양 DMT51~55 (미지정 시 DMT51) */
  shape?: string
  /** 도무송 개수 1~4 (미지정 시 1) */
  num?: number
}

/** 명함 도무송(die_cut) wholesale KRW — 모양×개수×수량. */
export function cardDieCutWholesaleKrw(p: CardDieCutParams): number {
  const { quantity } = p
  if (!quantity || quantity <= 0) return 0
  const shape = p.shape && DOMUSONG.matrix[p.shape] ? p.shape : CARD_DOMUSONG_DEFAULT_SHAPE
  const numClamped = Math.min(4, Math.max(1, Math.round(p.num ?? CARD_DOMUSONG_DEFAULT_NUM)))
  const shapeNode = DOMUSONG.matrix[shape] ?? DOMUSONG.matrix[CARD_DOMUSONG_DEFAULT_SHAPE]
  const numKey = `n${numClamped}`
  const points = shapeNode[numKey] ?? shapeNode.n1
  const model = DOMUSONG.qtyModel[`${shape}.${numKey}`]
  return interpQty(points, quantity, model)
}

/** 매트릭스가 커버하는 후가공 value 집합(명함). 그 외는 호출부가 기존 경로로 폴백. */
export const CARD_MATRIX_FINISHINGS = new Set(['foil_stamp', 'deboss_emboss', 'die_cut'])

export interface CardFinishingDetail {
  areaMm2?: number
  bakType?: string
  side?: string
  shape?: string
  num?: number
}

/**
 * 후가공 value + 세부옵션 + 수량 → wholesale KRW. 매트릭스 미커버 value 는 0(호출부 폴백).
 */
export function cardFinishingWholesaleKrw(
  value: string,
  quantity: number,
  detail: CardFinishingDetail = {},
): number {
  switch (value) {
    case 'foil_stamp':
      return cardFoilWholesaleKrw({ quantity, areaMm2: detail.areaMm2, bakType: detail.bakType, side: detail.side })
    case 'deboss_emboss':
      return cardEmbossWholesaleKrw({ quantity, areaMm2: detail.areaMm2 })
    case 'die_cut':
      return cardDieCutWholesaleKrw({ quantity, shape: detail.shape, num: detail.num })
    default:
      return 0
  }
}
