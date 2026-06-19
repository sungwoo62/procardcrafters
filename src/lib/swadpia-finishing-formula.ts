// OMO-3512: 성원 후가공 단가 결정론 RE — 카테고리별 클라이언트 JS(postpress_class_*)
// 직독으로 역설계한 단가 함수의 TS 구현.
//
// ⚠️ DORMANT / 레퍼런스 전용:
//   본 모듈은 라이브 고객가 경로에 연결돼 있지 않다(import 0). 적재·고객가 반영은
//   부모 OMO-3511 과 동일한 **보드 가격 승인 게이트** 대상이다. 자동발주 시 최종
//   권위는 여전히 성원 폼의 calcuEstimate(런타임) 다.
//
// 출처(RAW): scripts/test-artifacts/omo3512/raw-unpacked/postpress_class_*.unpacked.js
//   - 넘버링(NBT/NBN): postpress_class_CNC1000 calcuNumberingPrice / calcuNumberingPriceUnit
//   - 넘버링(NCR 상지/중지/하지): postpress_class_CNR1000
//   - 박 멀티레이어 합산: product_class_CNC1000 setPPBakAmtSum
//   - 보유동판 면제: 각 카테고리 calcuBakPrice 의 BKS20 분기
// 정리표: scripts/test-artifacts/omo3512/FINISHING-FORMULA-RE.md

/* ──────────────────────────────────────────────────────────────────────────
 * ① 넘버링 — 명함류 NBT/NBN 모델 (CNC1000)
 * ────────────────────────────────────────────────────────────────────────── */

export type NumberingType = 'NBT10' | 'NBT20' // 일반 / 난수
export type NumberingKind = 'NBN11' | 'NBN12' | 'NBN13' | 'NBN14' | 'NBN21' | 'NBN23'

/** 넘버링이 불가능한(amt=0) 용지코드 — CNC1000 calcuNumberingPrice 게이트. */
export const NUMBERING_BLOCKED_PAPERS = new Set<string>([
  'SNW300W00', // 스노우지 300g
  'DNT250GP0', // 다이니티 골드펄 250g
  'UPP250FB0', // 유포지 FEB 250g
])
// SNW250W00 은 "무광코팅 선택 시"에만 차단(matteCoated 인자로 분기).

export interface NumberingNbtInput {
  type: NumberingType
  kind: NumberingKind
  /** 재단 사이즈(mm) */
  cutXSize: number
  cutYSize: number
  /** 인쇄 매수(장) */
  paperQty: number
  /** 동일 주문 내 종(件) 수. 단건 = 1 */
  orderCount: number
  categoryCode?: string
  paperCode?: string
  matteCoated?: boolean
}

/** calcuNumberingPriceUnit (CNC1000) — 면적·매수 의존 unit. */
export function numberingPriceUnitNbt(i: NumberingNbtInput): number {
  const isRandom = i.type === 'NBT20'
  const SIZE_RATE = isRandom ? (i.categoryCode === 'CNC4000' ? 5 : 15) : 20
  const PAPER_QTY_MIN_RATE = isRandom ? 60000 : 40000
  const PAPER_QTY_MAX_RATE = isRandom ? 100000 : 80000

  const sizeRate = (i.cutXSize + i.cutYSize) / SIZE_RATE
  const q1 = Math.min(i.paperQty, 20000)
  const rate1 = Math.max(1 - q1 / PAPER_QTY_MIN_RATE, 0.65)
  const part1 = sizeRate * q1 * 1.5 * rate1
  const q2 = Math.max(i.paperQty - 20000, 0)
  const rate2 = Math.max(1 - q2 / PAPER_QTY_MAX_RATE, 0.65)
  const part2 = sizeRate * q2 * 0.4 * rate2

  // numbering_add_price: SZT20 명함/CVS류 + NBT10 + cut 91~199mm → +5,000 (대표 분기만 반영)
  let addPrice = 0
  const cutMax = Math.max(i.cutXSize, i.cutYSize)
  const addCats = ['CNC1000', 'CNC2000', 'CNC4000', 'CNC6000', 'CVS1000', 'CVS2000', 'CVS3000', 'CVS6000']
  if (i.type === 'NBT10' && i.categoryCode && addCats.includes(i.categoryCode) && cutMax > 91 && cutMax <= 199) {
    addPrice = 5000
  }
  return part1 + part2 + addPrice
}

/**
 * 넘버링 최종 단가(KRW, 성원 wholesale) — 명함류 NBT/NBN.
 * 반환 0 = 용지 게이트로 넘버링 불가.
 */
export function numberingPriceNbt(i: NumberingNbtInput): number {
  if (i.paperCode && NUMBERING_BLOCKED_PAPERS.has(i.paperCode)) return 0
  if (i.matteCoated && i.paperCode === 'SNW250W00') return 0

  const unit = numberingPriceUnitNbt(i)
  const typeRate = i.type === 'NBT10' ? 38000 : 70000
  // 6자리 1개(NBN11/13/21/23) = 1, 2개(NBN12/14) = 1.2
  const single = new Set(['NBN11', 'NBN13', 'NBN21', 'NBN23'])
  const kindRate = single.has(i.kind) ? 1 : 1.2

  const price = Math.ceil(Math.max(kindRate * unit, typeRate) / 1000) * 1000 * i.orderCount
  return price
}

/* ──────────────────────────────────────────────────────────────────────────
 * ① 넘버링 — 양식/NCR 모델 (CNR1000, 상지/중지/하지)
 * ────────────────────────────────────────────────────────────────────────── */

export interface NumberingNcrInput {
  /** 위치 합산 unit (상지/중지/하지 각 1, 통합 2/3/4) — settingNumberingType */
  typeUnit: number
  cutXSize: number
  cutYSize: number
  /** paper_price_1 (성원 용지 단가 인덱스) */
  paperPrice1: number
  bundleQty: number
  bindingQty: number
  /** 자리수 1개=1, 2개=1.2 */
  doubleDigit: boolean
}

/** 넘버링 단가(KRW) — NCR/양식. 바닥 47,000. */
export function numberingPriceNcr(i: NumberingNcrInput): number {
  const sizeRate = Math.max(i.cutXSize, i.cutYSize) * 0.035
  const paperRate = Math.max(1 - i.paperPrice1 / 20, 0.7) * 1.11
  const extra = i.doubleDigit ? 1.2 : 1
  let price =
    (sizeRate * (i.bundleQty * i.bindingQty * i.typeUnit) + i.typeUnit * 15000) * paperRate * extra
  price = Math.ceil(price / 1000) * 1000
  return Math.max(price, 47000)
}

/* ──────────────────────────────────────────────────────────────────────────
 * ③ 박/형압 보유동판(BKS20/APS20) setup 면제 — 전 카테고리 공통
 * ────────────────────────────────────────────────────────────────────────── */

export type BakSection = 'BKS10' | 'BKS20' // 신규 / 보유동판

export interface DongpanInput {
  section: BakSection
  bakXSize: number
  bakYSize: number
  /** 인쇄 매수 — CST 동판 수량 가산용 */
  paperQty?: number
}

/** 동판(setup)비. 보유동판(BKS20)이면 항상 0 (= setup 면제). */
export function bakDongpanPriceCnc(i: DongpanInput): number {
  if (i.section === 'BKS20') return 0
  const price1 = Math.max(i.bakXSize, 30) * Math.max(i.bakYSize, 30) * 1.6 + 1100
  const dongpan = Math.max(price1, 3000)
  return Math.ceil(dongpan / 100) * 100
}

/** 스티커(CST1000) 동판비 — 보유동판 면제 + 매수 구간 가산. */
export function bakDongpanPriceCst(i: DongpanInput): number {
  if (i.section === 'BKS20') return 0
  const qty = i.paperQty ?? 1000
  const qtyAdd = Math.max(Math.floor(qty / 1000 - 1), 0)
  const price1 = Math.max((i.bakXSize + 5) * (i.bakYSize + 5) * 1.6, 3500) + 3000 * qtyAdd
  return Math.ceil(price1 * 0.001) * 1000
}

/* ──────────────────────────────────────────────────────────────────────────
 * ② 박 멀티레이어 합산 — product_class setPPBakAmtSum
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 박 레이어 합산(setPPBakAmtSum): bak_amt = bak_amt_1 + bak_amt_2 + bak_amt_3.
 * 빈/미생성 레이어는 0. 형압(ap)·뒷박(dbak)도 동일 패턴.
 */
export function bakAmtSum(layerAmts: ReadonlyArray<number>): number {
  return layerAmts.slice(0, 3).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
}
