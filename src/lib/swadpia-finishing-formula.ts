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
 * ④ 박 단가 — 카테고리별 함수 (OMO-3534: 단일 ratePerMm2 → 카테고리 함수 승격)
 *
 * 출처(RAW): postpress_CNC1000.unpacked.js getBakPriceUnit(1688)/calcuBakPrice(1474).
 * 런타임 의존값 ppBakJsonOBJ.pp_bak_info[type=='material_unit'][bak_type] =
 *   { material_unit2, extra_rate, chk_size_low, chk_size_high } 는
 *   scripts/omo3534-bak-runtime-sample.mjs 로 READ-ONLY 표집(고정 적재).
 * 검증: scripts/omo3534-verify-formula.mjs — TS 재현 = 성원 hidden bak_amt 4/4 EXACT.
 *   (BKT01 20,200 / BKT06 22,800 / BKT18 29,000 / BKT01 양면 37,200; cut 90×50, qty 500, oc 1)
 * 정리: scripts/test-artifacts/omo3534/FINDINGS.md
 *
 * ⚠️ DORMANT: 본 함수는 정밀 RE 적재값이다. 라이브 foil_stamp surcharge 의 기본 경로
 *   교체(면적 비선형 형상 반영)는 보드 가격 라우팅 게이트 대상. CNC 기본 픽스처(BKT01 50×30,
 *   90×50)에선 현 ratePerMm2 와 정확히 22,300 으로 수렴 → 기본 주문 parity 이동 ≈0.
 * ────────────────────────────────────────────────────────────────────────── */

/** 박종(bak_type) → 런타임 표집 단가 파라미터. */
export interface BakMaterialUnit {
  material_unit2: number
  extra_rate: number
  chk_size_low: number
  chk_size_high: number
}

/**
 * CNC1000 박 material_unit2 (런타임 표집, omo3534). 미표집 bak_type 은 일반박(26,000) 폴백.
 * 전 bak_type 공통: extra_rate=2, chk_size_low=640, chk_size_high=60000.
 */
export const BAK_MATERIAL_UNIT_CNC: Readonly<Record<string, number>> = {
  BKT01: 26000, BKT02: 26000, BKT03: 26000, BKT04: 26000, BKT05: 26000,
  BKT06: 30000, BKT07: 70000, BKT08: 35000, BKT09: 26000, BKT10: 26000,
  BKT11: 70000, BKT12: 70000, BKT13: 70000, BKT16: 26000, BKT17: 26000,
  BKT18: 80000,
}

const CNC_BAK_DEFAULTS = { extra_rate: 2, chk_size_low: 640, chk_size_high: 60000 } as const

/** CNC1000 bak_type 의 표집 파라미터 조회(미표집 → 일반박 26,000 폴백). */
export function bakMaterialUnitCnc(bakType: string): BakMaterialUnit {
  const material_unit2 = BAK_MATERIAL_UNIT_CNC[bakType] ?? BAK_MATERIAL_UNIT_CNC.BKT01
  return { material_unit2, ...CNC_BAK_DEFAULTS }
}

export type BakSide = 'BKD10' | 'BKD30' // 단면 / 양면

export interface BakPriceCncInput {
  bakType: string
  /** 박 영역(mm) */
  bakXSize: number
  bakYSize: number
  /** 재단 사이즈(mm) */
  cutXSize: number
  cutYSize: number
  /** 인쇄 매수(장) */
  paperQty: number
  /** 동일 주문 내 종(件) 수. 단건 = 1 */
  orderCount: number
  bakSide: BakSide
  section: BakSection
}

/** CNC1000 getBakPaperMaxPrice — cut 최대변(mm) 구간 바닥값. */
function bakPaperMaxPriceCnc(cutSizeMax: number): number {
  if (cutSizeMax < 100) return 3000
  if (cutSizeMax < 120) return 5000
  if (cutSizeMax < 150) return 8000
  if (cutSizeMax < 200) return 10000
  if (cutSizeMax < 250) return 12000
  if (cutSizeMax < 300) return 14000
  if (cutSizeMax < 350) return 16000
  if (cutSizeMax < 400) return 25000
  if (cutSizeMax < 500) return 30000
  if (cutSizeMax < 600) return 35000
  return 40000
}

/** CNC1000 getBakPaperWorkAddPrice — cut 최대변≥100mm 대형 가산(보간표). */
function bakPaperWorkAddPriceCnc(cutXSize: number, cutYSize: number, paperQty: number): number {
  const cutMax = Math.max(cutXSize, cutYSize)
  if (cutMax < 100) return 0
  const R34 = 4000, R36 = 5000, R37 = 5000, R39 = 17000, R40 = 17000, R42 = 50000
  const Q34 = 101, Q36 = 170, Q37 = 171, Q39 = 300, Q40 = 301, Q42 = 600
  let paperMaxAdd = 0
  if (cutMax < Q34) paperMaxAdd = 0
  else if (cutMax === Q34) paperMaxAdd = R34
  else if (cutMax <= 169) paperMaxAdd = R34 - ((R34 - R36) / (Q36 - Q34)) * (cutMax - Q34)
  else if (cutMax === Q36) paperMaxAdd = R36
  else if (cutMax === Q37) paperMaxAdd = R37
  else if (cutMax <= 299) paperMaxAdd = R37 - ((R37 - R39) / (Q39 - Q37)) * (cutMax - Q37)
  else if (cutMax === Q39) paperMaxAdd = R39
  else if (cutMax === Q40) paperMaxAdd = R40
  else if (cutMax <= 599) paperMaxAdd = R40 - ((R40 - R42) / (Q42 - Q40)) * (cutMax - Q40)
  else if (cutMax <= Q42) paperMaxAdd = R42
  const m8a = ((cutXSize * cutYSize) / 5) * paperQty / 1700
  let m8b = 1
  if (paperQty >= 3000 && cutMax >= 120) m8b = ((cutXSize * cutYSize) / 3) * paperQty / 3300 - 10000
  return Math.trunc(paperMaxAdd + m8a - m8b)
}

/**
 * CNC1000 getBakPriceUnit — 박 단가 unit(동판 제외). work+film+면적가산, paper_max 바닥.
 */
export function bakPriceUnitCnc(i: BakPriceCncInput): number {
  const { material_unit2, extra_rate, chk_size_low, chk_size_high } = bakMaterialUnitCnc(i.bakType)
  const cutMax = Math.max(i.cutXSize, i.cutYSize)
  const cutMin = Math.min(i.cutXSize, i.cutYSize)
  const bakWorkPrice = (i.cutXSize + i.cutYSize) / 20 + 11
  const paperMaxPrice = bakPaperMaxPriceCnc(cutMax)
  const paperAddPrice = bakPaperWorkAddPriceCnc(i.cutXSize, i.cutYSize, i.paperQty)
  const bakXMax = Math.max(i.bakXSize, 30)
  const bakYMax = Math.max(i.bakYSize, 30)
  const sizeExtraUnit = cutMax >= 150 || cutMin >= 100 ? 2000 : 0
  let filmPrice =
    (material_unit2 / (chk_size_low * chk_size_high)) * (bakXMax + 15) * (bakYMax + 15) * extra_rate
  filmPrice = Math.round(filmPrice * 100) / 100
  let unit = Math.max(bakWorkPrice * i.paperQty + filmPrice * i.paperQty + sizeExtraUnit, paperMaxPrice)
  unit += paperAddPrice + 600
  return unit
}

/** CNC1000 getBakExtraUnit — 박 영역 구간별 extra 계수/바닥(order_count 의존). */
function bakExtraUnitCnc(
  cutXSize: number,
  cutYSize: number,
  bakXSize: number,
  bakYSize: number,
  orderCount: number,
): { extraUnit: number; extraMin: number; extraUnit3: number; extraUnit4: number } {
  const xyMax = Math.max(Math.max(bakXSize, 30), Math.max(bakYSize, 30))
  // [하한mm, extra_unit, extra_min]
  const bands: ReadonlyArray<readonly [number, number, number]> = [
    [30, 1.04, 3300], [35, 1.08, 3600], [40, 1.12, 3900], [45, 1.16, 4200],
    [50, 1.20, 4500], [55, 1.24, 4800], [60, 1.28, 6000], [65, 1.32, 6500],
    [70, 1.36, 8000], [75, 1.40, 1000], [80, 1.40, 1300], [85, 1.40, 14000],
    [90, 1.40, 15000], [95, 1.40, 18000], [100, 1.40, 20000],
  ]
  let extraUnit = 1
  let extraMin = 3000
  if (xyMax >= 30) {
    for (const [lo, u, m] of bands) {
      if (xyMax >= lo) { extraUnit = u; extraMin = m }
    }
  }
  let extraUnit3 = 500
  let extraUnit4 = 1.1
  if ((cutXSize === 90 && cutYSize === 50) || (cutXSize === 50 && cutYSize === 90)) {
    extraUnit3 = 0
    extraUnit4 = 1
  }
  extraMin = Math.ceil((extraMin * Math.max(orderCount * 0.7, 1)) / 100) * 100
  return { extraUnit, extraMin, extraUnit3, extraUnit4 }
}

/**
 * CNC1000 calcuBakPrice — 박 최종가(KRW, 성원 wholesale). unit·dongpan 분리 반환.
 * 동판(setup)은 보유동판(BKS20)이면 0(= surcharge-side 면제, OMO-3534 #4).
 */
export function bakPriceCnc(i: BakPriceCncInput): { bakPrice: number; unit: number; dongpan: number } {
  let unit = bakPriceUnitCnc(i)
  let dongpan = bakDongpanPriceCnc({ section: i.section, bakXSize: i.bakXSize, bakYSize: i.bakYSize })
  unit = unit * i.orderCount * 1.35
  if (i.bakSide === 'BKD30') unit *= 2
  const { extraUnit, extraMin, extraUnit3, extraUnit4 } = bakExtraUnitCnc(
    i.cutXSize, i.cutYSize, i.bakXSize, i.bakYSize, i.orderCount,
  )
  unit = unit * extraUnit4 * extraUnit
  unit = Math.ceil(unit / 100) * 100
  unit = Math.max(unit + extraUnit3, extraMin)
  if (Math.max(i.cutXSize, i.cutYSize) >= 100) unit = Math.max(unit, 18500)
  dongpan = Math.ceil(dongpan / 100) * 100
  return { bakPrice: unit + dongpan, unit, dongpan }
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
