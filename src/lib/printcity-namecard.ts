// OMO-3414: printcity(dtp21) 명함 전수 census ↔ 우리(procardcrafters) ↔ 성원(swadpia) 분석.
//
// 데이터 소스(단일): src/data/printcity-namecard-census.json
//   = scripts/omo3414-printcity-namecard-census.mjs 가 price-api.dtp21.com/v2 공개 GET 으로
//     직독한 명함 17제품 compact census(가격 JSON 직독, OCR/LLM 미사용, 읽기전용).
//
// 본 모듈은 census 위에서 (a) 우리↔printcity 맵핑/커버리지, (b) printcity↔성원 가격차를 파생한다.
// 성원 가격은 화면 추론 금지 원칙에 따라 라이브 표집/검증된 앵커(finishing-surcharge.ts,
// swadpia-base-price.ts 주석 근거)만 상수로 인용하고, 미표집 구간은 gap 으로 명시한다.
import census from '@/data/printcity-namecard-census.json'
import { FINISHING_DEFAULT_AREA_MM } from '@/config/finishing-surcharge'

export interface FoilColor {
  code: string
  title: string
}
export interface PrintcityProduct {
  id: string
  nameKO: string
  nameEN: string
  category2nd?: string
  category3rd?: string
  categoryCode?: string
  priceType: string
  saleStatus?: boolean
  hasFoil: boolean
  foilKind?: string | null
  foilColors: FoilColor[]
  counts: { material: number; size: number; color: number; coating: number; combos: number }
  axes: {
    coating: FoilColor[]
    material: FoilColor[]
    color: FoilColor[]
    size: FoilColor[]
    foil: FoilColor[]
    other: { name: string; kindCode: string; options: FoilColor[] }[]
  }
  quantities: number[]
  baseByQty: Record<string, number>
  foilTable: { repPaper?: string; repPrint: string; byColor: Record<string, Record<string, number>> } | null
}
export interface PrintcityCensus {
  issue: string
  source: string
  method: string
  note: string
  capturedAt: string
  category: string
  productCount: number
  products: PrintcityProduct[]
}

export const CENSUS = census as unknown as PrintcityCensus

// ── 우리(procardcrafters) 명함 제품 (product-nav 'cards' 그룹) ───────────────
export interface OurCardSlug {
  slug: string
  label: string
}
export const OUR_CARD_SLUGS: OurCardSlug[] = [
  { slug: 'business-cards', label: 'Business Cards' },
  { slug: 'premium-business-cards', label: 'Premium Business Cards' },
  { slug: 'premium-foil-cards', label: 'Foil Cards' },
  { slug: 'letterpress-business-cards', label: 'Letterpress Cards' },
  { slug: 'pearl-business-cards', label: 'Pearl Cards' },
  { slug: 'uv-business-cards', label: 'UV Cards' },
  { slug: 'transparent-business-cards', label: 'Transparent Cards' },
  { slug: 'metallic-business-cards', label: 'Metallic Cards' },
]

// ── printcity 제품 → 우리 slug 맵핑(전문가 큐레이션, category3rd/제품성격 기준) ──
// null = 우리 카탈로그에 대응 없음(printcity 측 갭).
export interface ProductMapping {
  printcityId: string
  printcityName: string
  category3rd?: string
  ourSlug: string | null
  note: string
}
export const PRODUCT_MAPPING: ProductMapping[] = [
  { printcityId: '61de7e13a36b0ec358946de3', printcityName: '일반지 명함', category3rd: 'MP_GNC', ourSlug: 'business-cards', note: '표준 명함(스노우/아트지) ↔ 우리 일반 명함' },
  { printcityId: '63e4abde3374d8d1dc54458d', printcityName: '통합 명함', category3rd: 'MP_UNC', ourSlug: 'business-cards', note: '통합(용지 다종) 표준 명함 ↔ 일반 명함' },
  { printcityId: '61d7e6ff4618a211d2069c9a', printcityName: '수입지 명함', category3rd: 'MP_INC', ourSlug: 'premium-business-cards', note: '수입지(프리미엄 용지) ↔ 프리미엄 명함' },
  { printcityId: '6879cc61a67a79397627ad3c', printcityName: '특가 수입지 명함', category3rd: 'MP_INC', ourSlug: 'premium-business-cards', note: '특가 수입지 ↔ 프리미엄 명함(가격대 별도)' },
  { printcityId: '61db8d7fb2fd4166089fa04d', printcityName: 'VIP 명함', category3rd: 'MP_VNC', ourSlug: 'premium-business-cards', note: 'VIP(고급 용지·8사이즈) ↔ 프리미엄 명함' },
  { printcityId: '63db173890953943cfdafc94', printcityName: '엣지명함', category3rd: 'MP_EDG', ourSlug: 'premium-foil-cards', note: '엣지박(12색) ↔ 박 카드(foil cards)' },
  { printcityId: '61ef5b679b270074d7f1e369', printcityName: '부분코팅 명함', category3rd: 'MP_PNC', ourSlug: 'uv-business-cards', note: '부분코팅(스팟UV) ↔ UV 카드' },
  { printcityId: '61e52abfabaed95eaaf08cb0', printcityName: '에폭엠보 명함', category3rd: 'MP_ENC', ourSlug: 'premium-foil-cards', note: '에폭/엠보(형압) ↔ 박·형압 카드' },
  { printcityId: '61de95b8241774a67e60074f', printcityName: '옵셋 카드명함', category3rd: 'MP_MNC', ourSlug: 'premium-business-cards', note: '두꺼운 카드명함 ↔ 프리미엄 명함' },
  { printcityId: '61de9be4241774a67e601af8', printcityName: 'PET카드 명함', category3rd: 'MP_PEC', ourSlug: 'transparent-business-cards', note: 'PET(투명/반투명) ↔ 투명 명함' },
  { printcityId: '61dfcbbe542d106e1224f76f', printcityName: '점자명함', category3rd: 'MP_ZNC', ourSlug: null, note: '점자(UV 돌출) — 우리 카탈로그 미보유(갭)' },
  { printcityId: '61dfda7fc03d48fd50efdc83', printcityName: '포토카드', category3rd: 'MP_PCD', ourSlug: null, note: '포토카드 — 명함 외 굿즈성(갭)' },
  { printcityId: '677cf067604e619a80edfa32', printcityName: '옵셋 피켓', category3rd: 'MP_OPK', ourSlug: null, note: '피켓(응원) — 명함 아님(카탈로그 분류 혼입)' },
  { printcityId: '6a05875bd6dd07b8536a14f8', printcityName: '수입지 명함(이벤트)', category3rd: 'MP_INC', ourSlug: 'premium-business-cards', note: '이벤트 단일조합 — 프리미엄 명함' },
  { printcityId: '690d5723122978358a481644', printcityName: '일반지 명함(이벤트)', category3rd: 'MP_GNC', ourSlug: 'business-cards', note: '이벤트 단일조합 — 일반 명함' },
  { printcityId: '68d384a31b09594495f4c1b9', printcityName: '통합 명함(draft)', category3rd: 'MP_UNC', ourSlug: 'business-cards', note: '가격표 미적재(draft) — 맵핑만' },
  { printcityId: '68ba716b4f93d8608081affd', printcityName: '수입지 명함(draft)', category3rd: 'MP_INC', ourSlug: 'premium-business-cards', note: '가격표 미적재(draft) — 맵핑만' },
]

export interface ProductMappingRow extends ProductMapping {
  ourLabel: string | null
  mapped: boolean
  hasFoil: boolean
  combos: number
  baseSampleQty?: number
  baseSampleKrw?: number
}

export function buildProductMappingRows(): ProductMappingRow[] {
  const byId = new Map(CENSUS.products.map((p) => [p.id, p]))
  return PRODUCT_MAPPING.map((m) => {
    const p = byId.get(m.printcityId)
    const our = m.ourSlug ? OUR_CARD_SLUGS.find((s) => s.slug === m.ourSlug) : null
    // 대표 base 샘플: 200매 우선, 없으면 최소 수량
    let sampleQty: number | undefined
    let sampleKrw: number | undefined
    if (p) {
      const b = p.baseByQty || {}
      const keys = Object.keys(b).map(Number).sort((a, z) => a - z)
      const q = keys.includes(200) ? 200 : keys[0]
      if (q != null) { sampleQty = q; sampleKrw = b[String(q)] }
    }
    return {
      ...m,
      ourLabel: our?.label ?? null,
      mapped: m.ourSlug != null,
      hasFoil: p?.hasFoil ?? false,
      combos: p?.counts.combos ?? 0,
      baseSampleQty: sampleQty,
      baseSampleKrw: sampleKrw,
    }
  })
}

export function productCoverage() {
  const rows = buildProductMappingRows()
  const mapped = rows.filter((r) => r.mapped).length
  const gaps = rows.filter((r) => !r.mapped)
  const priced = rows.filter((r) => r.combos > 0).length
  return { total: rows.length, mapped, unmapped: rows.length - mapped, priced, gaps }
}

// ── printcity 엣지박 색상 ↔ 우리 finishing/별색 ↔ 성원 BKT 맵핑 ─────────────
// 성원 BKT 종류(OMO-3411 doc): BKT01~16. printcity 엣지박 12색. 우리 finishing=foil_stamp(별색).
export interface FoilColorMapping {
  printcityCode: string
  printcityTitle: string
  ourFinishing: string // foil_stamp / deboss_emboss / 별색
  swadpiaHint: string // 성원 박 종류 추정
  verified: '✅' | '⏳' | '⚠️'
}
export const FOIL_COLOR_MAPPING: FoilColorMapping[] = [
  { printcityCode: 'BKK:GOLD-GS', printcityTitle: '금박-유광', ourFinishing: 'foil_stamp', swadpiaHint: '금박(BKT 금)', verified: '✅' },
  { printcityCode: 'BKK:GOLD-MT', printcityTitle: '금박-무광', ourFinishing: 'foil_stamp', swadpiaHint: '무광금박', verified: '✅' },
  { printcityCode: 'BKK:SILVER-GS', printcityTitle: '은박-유광', ourFinishing: 'foil_stamp', swadpiaHint: '은박(BKT 은)', verified: '✅' },
  { printcityCode: 'BKK:SILVER-MT', printcityTitle: '은박-무광', ourFinishing: 'foil_stamp', swadpiaHint: '무광은박', verified: '✅' },
  { printcityCode: 'BKK:REDGOLD', printcityTitle: '로즈골드박-유광', ourFinishing: 'foil_stamp', swadpiaHint: '로즈골드박', verified: '⏳' },
  { printcityCode: 'BKK:STARHOLOGRAM', printcityTitle: '스타홀로그램박', ourFinishing: 'foil_stamp', swadpiaHint: '홀로그램박', verified: '⏳' },
  { printcityCode: 'BKK:HOLOGRAM1', printcityTitle: '홀로그램박', ourFinishing: 'foil_stamp', swadpiaHint: '홀로그램박', verified: '⏳' },
  { printcityCode: 'BKK:BLACK-MT', printcityTitle: '먹박-무광', ourFinishing: 'foil_stamp', swadpiaHint: '먹박(BKT 먹)', verified: '✅' },
  { printcityCode: 'BKK:RED', printcityTitle: '적박-유광', ourFinishing: 'foil_stamp', swadpiaHint: '적박(BKT 적)', verified: '✅' },
  { printcityCode: 'BKK:BLUE', printcityTitle: '청박-유광', ourFinishing: 'foil_stamp', swadpiaHint: '청박(BKT 청)', verified: '✅' },
  { printcityCode: 'BKK:ORANGE', printcityTitle: '오렌지박', ourFinishing: 'foil_stamp', swadpiaHint: '특수색박', verified: '⚠️' },
  { printcityCode: 'BKK:COPPER', printcityTitle: '코퍼박', ourFinishing: 'foil_stamp', swadpiaHint: '특수색박', verified: '⚠️' },
]

// ── 총액·부가세(VAT) ─────────────────────────────────────────────────────────
// printcity price-api 의 productTypes[].price[].value 는 부가세 별도 공급가(한국 B2B 인쇄 관행).
// API 에 vat/tax 필드 부재(전수 확인) → 공급가로 간주하고 부가세 10% 별산.
// 이 가정은 item ③ 로그인 dry-run(장바구니 합계 라인)에서 최종 확인한다.
export const VAT_RATE = 0.1
export interface MoneyWithVat {
  supply: number // 공급가(부가세 별도) = printcity 직독가
  vat: number // 부가세 10%
  total: number // 합계(총액)
}
export function withVat(supplyKrw: number): MoneyWithVat {
  const vat = Math.round(supplyKrw * VAT_RATE)
  return { supply: supplyKrw, vat, total: supplyKrw + vat }
}

// ── 옵션 맵핑 가능 상태 (board ① "그 옵션들이 맵핑 가능한 상태인지 확인") ────────
// census 전 명함 제품의 옵션축(용지/사이즈/도수/코팅/박)을 전수 수집 → 우리 카탈로그
// 대응 가능여부를 축별로 판정. 큐레이션 규칙(키워드) 기반, 미검증은 ⚠️로 정직히 표기.
export type AxisStatus = '✅' | '⚠️' | '❌'
export interface OptionAxisCoverage {
  axis: string
  distinctOptions: number
  mappable: number
  partial: number
  gap: number
  status: AxisStatus
  examples: { title: string; verdict: AxisStatus; ours: string }[]
  note: string
}

function classifyMaterial(t: string): { v: AxisStatus; ours: string } {
  if (/스노우|아트지|아트|모조|백상|켄트|랑데부|일반/.test(t)) return { v: '✅', ours: '표준 용지(스노우/아트 계열)' }
  if (/수입|반누보|몽블랑|매쉬|마쉬|띤또|팝셋|컬러플랜|아코|비비드/.test(t)) return { v: '⚠️', ours: '프리미엄 명함(수입지) — 용지 1:1 큐레이션 필요' }
  if (/PET|투명|펄|메탈|크라프트/.test(t)) return { v: '⚠️', ours: '특수소재 카드(투명/펄/메탈) — 대응 제품 있음, 등급 확인' }
  return { v: '⚠️', ours: '용지 등급 개별 확인' }
}
function classifySize(t: string): { v: AxisStatus; ours: string } {
  if (/별사이즈|자유|커스텀/.test(t)) return { v: '⚠️', ours: '커스텀 사이즈(에디터 자유치수) — 가격축 별도' }
  if (/90.?50|89.?51|91.?55|86.?5[02]|85.?4[59]|85.?55/.test(t)) return { v: '✅', ours: '표준 명함 규격(에디터 지원)' }
  return { v: '✅', ours: '명함 표준 규격대' }
}
function classifyColor(t: string): { v: AxisStatus; ours: string } {
  if (/단면|4도|편면/.test(t)) return { v: '✅', ours: '단면 풀컬러(4/0)' }
  if (/양면|8도/.test(t)) return { v: '✅', ours: '양면 풀컬러(4/4)' }
  return { v: '✅', ours: '풀컬러 인쇄' }
}
function classifyCoating(t: string): { v: AxisStatus; ours: string } {
  if (/없음|무코팅/.test(t)) return { v: '✅', ours: '무코팅' }
  if (/무광/.test(t)) return { v: '✅', ours: '무광 코팅(matte)' }
  if (/유광/.test(t)) return { v: '✅', ours: '유광 코팅(gloss)' }
  if (/홀로그램|벨벳|벨베/.test(t)) return { v: '⚠️', ours: '특수 코팅(홀로그램/벨벳) — 대응 제한, 별도 검토' }
  return { v: '⚠️', ours: '코팅 종류 개별 확인' }
}

function aggregateAxis(
  axisName: string,
  pick: (p: PrintcityProduct) => FoilColor[],
  classify: (t: string) => { v: AxisStatus; ours: string },
): OptionAxisCoverage {
  const seen = new Map<string, AxisStatus>()
  const examples: OptionAxisCoverage['examples'] = []
  for (const p of CENSUS.products) {
    for (const o of pick(p) || []) {
      if (seen.has(o.title)) continue
      const c = classify(o.title)
      seen.set(o.title, c.v)
      if (examples.length < 6) examples.push({ title: o.title, verdict: c.v, ours: c.ours })
    }
  }
  const vals = [...seen.values()]
  const mappable = vals.filter((v) => v === '✅').length
  const partial = vals.filter((v) => v === '⚠️').length
  const gap = vals.filter((v) => v === '❌').length
  const status: AxisStatus = gap > 0 ? '❌' : partial > mappable ? '⚠️' : '✅'
  return {
    axis: axisName,
    distinctOptions: seen.size,
    mappable,
    partial,
    gap,
    status,
    examples,
    note: status === '✅' ? '대부분 1:1 맵핑' : '일부 옵션 큐레이션/검토 필요',
  }
}

export function buildOptionMappability(): OptionAxisCoverage[] {
  return [
    aggregateAxis('용지(material)', (p) => p.axes.material, classifyMaterial),
    aggregateAxis('사이즈(size)', (p) => p.axes.size, classifySize),
    aggregateAxis('도수(color)', (p) => p.axes.color, classifyColor),
    aggregateAxis('코팅(coating)', (p) => p.axes.coating, classifyCoating),
    aggregateAxis('박(foil/엣지박)', (p) => p.axes.foil, (t) => ({ v: '✅' as AxisStatus, ours: 'foil_stamp(별색) — 색상 맵핑표 보유' })),
  ]
}

// ── 성원(swadpia) 가격 앵커 (라이브 표집/검증 — 화면 추론 아님) ───────────────
// 출처: OMO-2647 라이브(CNC1000 명함 1,000매 로그인 검증) + swadpia-base-price.ts 주석.
//  - base namecard CNC1000 q200 = 4,000 KRW (도매/wholesale). swadpia-base-price.ts L166 주석 근거.
//  - 박(foil_stamp) surcharge = 22,300 KRW @ 1,500㎟ (50×30mm), 1,000매 셋업비 성격. 분리형.
export const SWADPIA_ANCHORS = {
  baseNamecardWholesaleKrw: { qty: 200, krw: 4000, source: 'swadpia-base-price.ts L166 주석(CNC1000 q200=4000 SNW300W00)' },
  foilSurchargeKrw: { krw: 22300, areaMm2: FINISHING_DEFAULT_AREA_MM.width * FINISHING_DEFAULT_AREA_MM.height, source: 'OMO-2647 라이브(finishing-surcharge.ts)' },
  foilModel: '분리형 surcharge(base + 박단가). 박단가 ≈ 14.87 KRW/㎟ 선형근사(1차).',
} as const

// ── 가격차 분석: base(no-foil) printcity vs 성원 ──────────────────────────────
export interface BaseDiffRow {
  printcityName: string
  qty: number
  printcityKrw: number // 공급가(부가세 별도)
  printcityVat: number // 부가세 10%
  printcityTotal: number // 합계(총액)
  swadpiaKrw: number
  diffKrw: number
  diffPct: number
  note: string
}
export function buildBaseDiff(): BaseDiffRow[] {
  // 성원 앵커는 q200=4,000 단일점만 검증. 동일 수량(200매) base 비교.
  const swadpia = SWADPIA_ANCHORS.baseNamecardWholesaleKrw
  const targets = ['일반지 명함', '통합 명함', '수입지 명함', 'VIP 명함']
  const rows: BaseDiffRow[] = []
  for (const name of targets) {
    // 동명 다수 → 가격표 가장 풍부한(combos 최다) 제품 선택
    const cands = CENSUS.products.filter((p) => p.nameKO === name && p.counts.combos > 0)
    if (!cands.length) continue
    const p = cands.sort((a, z) => z.counts.combos - a.counts.combos)[0]
    const krw = p.baseByQty[String(swadpia.qty)]
    if (krw == null) continue
    const diff = krw - swadpia.krw
    const m = withVat(krw)
    rows.push({
      printcityName: name,
      qty: swadpia.qty,
      printcityKrw: krw,
      printcityVat: m.vat,
      printcityTotal: m.total,
      swadpiaKrw: swadpia.krw,
      diffKrw: diff,
      diffPct: Math.round((diff / swadpia.krw) * 1000) / 10,
      note: name.includes('수입지') || name.includes('VIP') ? '프리미엄 용지(↔성원 표준앵커, 등급차 존재)' : '표준 용지',
    })
  }
  return rows
}

// ── 가격차 분석: 박(foil) — printcity 번들 완성가 vs 성원 분리형 surcharge ──────
export interface FoilDiffRow {
  printcityColor: string
  qty: number
  printcityTotalKrw: number // 박 포함 완성가(엣지명함)
  printcityFoilPremiumKrw: number // printcity 표준 base 대비 박 프리미엄
  swadpiaEstTotalKrw: number // 성원 추정 총액 = base + surcharge (앵커 기반)
  diffKrw: number
  diffPct: number
}
// printcity 표준 명함 base(동수량) — 박 프리미엄 분리 추정용
function printcityStandardBase(qty: number): number | null {
  const std = CENSUS.products
    .filter((p) => p.nameKO === '일반지 명함' && p.counts.combos > 0)
    .sort((a, z) => z.counts.combos - a.counts.combos)[0]
  const v = std?.baseByQty[String(qty)]
  return v ?? null
}
export function buildFoilDiff(qtys: number[] = [100, 200, 1000]): FoilDiffRow[] {
  const edge = CENSUS.products.find((p) => p.hasFoil && p.foilTable)
  if (!edge || !edge.foilTable) return []
  const rows: FoilDiffRow[] = []
  // 대표 색상: 금박-유광(표준박) 기준
  const repColor = 'BKK:GOLD-GS'
  const curve = edge.foilTable.byColor[repColor]
  const colorTitle = edge.foilColors.find((c) => c.code === repColor)?.title ?? repColor
  for (const q of qtys) {
    const total = curve?.[String(q)]
    if (!total) continue
    const stdBase = printcityStandardBase(q)
    const foilPremium = stdBase != null ? total - stdBase : NaN
    // 성원 추정 총액: base(q200 앵커 단일점만 검증 → 그 외 수량은 앵커 비례 추정 금지, 200매만 산정)
    let swadpiaEst = NaN
    if (q === SWADPIA_ANCHORS.baseNamecardWholesaleKrw.qty) {
      swadpiaEst = SWADPIA_ANCHORS.baseNamecardWholesaleKrw.krw + SWADPIA_ANCHORS.foilSurchargeKrw.krw
    }
    const diff = total - swadpiaEst
    rows.push({
      printcityColor: colorTitle,
      qty: q,
      printcityTotalKrw: total,
      printcityFoilPremiumKrw: Math.round(foilPremium),
      swadpiaEstTotalKrw: Math.round(swadpiaEst),
      diffKrw: Math.round(diff),
      diffPct: Number.isFinite(diff) ? Math.round((diff / swadpiaEst) * 1000) / 10 : NaN,
    })
  }
  return rows
}

// ── 전체 카탈로그 census (board ④ "프린트시티 전체 제품군 크롤링 리스트업") ────────
// 소스: src/data/printcity-catalog-census.json
//   = scripts/omo3414-printcity-full-catalog-census.mjs 가 product?all=true&page=N 으로
//     전수(171제품/25카테고리) 직독한 경량 카탈로그(메타: id/카테고리/제품명/가격결정타입).
import catalogCensus from '@/data/printcity-catalog-census.json'

export interface CatalogProduct {
  id: string
  nameKO: string | null
  nameEN: string | null
  cat2: string | null
  cat3: string | null
  priceType: string | null
}
export interface CatalogCategory {
  cat1: string
  count: number
  priceTypes: Record<string, number>
  sub: { name: string; count: number }[]
  products: CatalogProduct[]
}
export interface CatalogCensus {
  source: string
  crawledVia: string
  productCount: number
  reportedTotal: number
  categoryCount: number
  priceTypeTotals: Record<string, number>
  categories: CatalogCategory[]
  products: CatalogProduct[]
}
export const CATALOG = catalogCensus as unknown as CatalogCensus

// ── OMO-3417: 명함 주문/구성 플로우 결선 어댑터 ──────────────────────────────
// 공급사 플래그(config/namecard-supplier.ts)가 printcity 일 때, 우리 slug 의 명함 가격/옵션을
// printcity 공개 GET JSON 직독 데이터에서 ProductConfigurator 가 소비하는 SwadpiaClientData
// 호환 형태로 변환한다. 성원 경로는 삭제하지 않고 플래그로 hide 만 한다.
//
// base 가격: src/data/printcity-namecard-base-matrix.json
//   = scripts/omo3417-printcity-namecard-base-matrix.mjs 가 product/{id}.productTypes[] 의
//     combo별 클린 price 사다리에서 canonical(기준 사이즈×코팅)별 용지×단/양면을 추출.
//   (OMO-3414 census 의 baseByQty 는 combo 병합 잡음으로 라이브 가격에 부적합 → 본 매트릭스로 대체.)
// 박(foil) 가격: census foilTable(수량브래킷, 면적모델 아님) 재사용.
import baseMatrix from '@/data/printcity-namecard-base-matrix.json'
import type { SwadpiaPaper, SwadpiaPrintEntry, SwadpiaSize } from '@/lib/swadpia'

interface BaseMatrixPaper {
  code: string
  title: string
  single: Record<string, number>
  double: Record<string, number>
}
interface BaseMatrixProduct {
  id: string
  ourSlug: string
  name: string
  defaultSize?: string
  defaultCoating?: string
  sizes?: { code: string; title: string }[]
  papers?: BaseMatrixPaper[]
}
interface BaseMatrix {
  issue: string
  source: string
  capturedAt: string
  products: BaseMatrixProduct[]
}
export const BASE_MATRIX = baseMatrix as unknown as BaseMatrix

/** slug → 대표 printcity 명함 제품(base-matrix). TARGETS 순서상 첫 매칭 = canonical 표준 제품. */
function representativeBaseProduct(slug: string): BaseMatrixProduct | null {
  return BASE_MATRIX.products.find((p) => p.ourSlug === slug && (p.papers?.length ?? 0) > 0) ?? null
}

/** "명함 90×50" 류 title 에서 cut 치수(mm) 파싱. (foil guard resolveFoilPaperCut 호환용) */
function parseSizeDims(title: string): { x: string; y: string } {
  const m = title.match(/(\d{2,3})\s*[x×*]\s*(\d{2,3})/)
  return { x: m?.[1] ?? '', y: m?.[2] ?? '' }
}

export interface PrintcityClientData {
  papers: SwadpiaPaper[]
  printEntries: SwadpiaPrintEntry[]
  sizes: SwadpiaSize[]
}

/**
 * printcity 명함 slug → ProductConfigurator 용 SwadpiaClientData 호환 데이터.
 * printEntries.print_unit2 = 단면(canonical 기본) base 단가(KRW). add_unit2 = 양면 추가분.
 * 매핑 제품/가격 미존재(letterpress·pearl·metallic 등 갭) 시 null → 호출측은 DB 기본가로 폴백.
 */
export function getPrintcityNamecardData(slug: string): PrintcityClientData | null {
  const prod = representativeBaseProduct(slug)
  if (!prod || !prod.papers || prod.papers.length === 0) return null

  const papers: SwadpiaPaper[] = prod.papers.map((p) => ({
    paper_code: p.code,
    paper_type_code: p.code,
    paper_weight: '',
    paper_weight_txt: p.title,
    paper_summary: p.title,
    paper_side_type: Object.keys(p.double).length > 0 ? '2' : '1',
    price_unit1: 0,
    price_unit2: 0,
    price_sale_rate: 1,
    print_extra_rate: 0,
    print_method_list: '',
  }))

  const printEntries: SwadpiaPrintEntry[] = []
  for (const p of prod.papers) {
    const qtys = new Set<number>([
      ...Object.keys(p.single).map(Number),
      ...Object.keys(p.double).map(Number),
    ])
    for (const q of [...qtys].sort((a, b) => a - b)) {
      const single = p.single[String(q)] ?? 0
      const double = p.double[String(q)] ?? 0
      const base = single > 0 ? single : double // canonical 기본 = 단면, 없으면 양면
      if (base <= 0) continue
      printEntries.push({
        quantity: q,
        paper_code: p.code,
        print_method: 'PC',
        print_unit1: single || base,
        print_unit2: base,
        add_unit2: double > 0 && single > 0 ? double - single : 0,
      })
    }
  }

  const sizes: SwadpiaSize[] = (prod.sizes ?? []).map((s) => {
    const d = parseSizeDims(s.title)
    return {
      size_type_code: s.code,
      size_type_name: s.title,
      cut_norm_x_size: d.x,
      cut_norm_y_size: d.y,
    }
  })

  return { papers, printEntries, sizes }
}

/**
 * printcity 명함 박(foil) 수량브래킷 단가(KRW) — census foilTable 직독.
 * 박은 total_price/base 매트릭스에 안 잡히므로 별도 수량브래킷으로 산정(면적모델 아님).
 * 대표색(첫 색) 기준 byQty 맵 반환. 박 미보유 slug 는 null.
 */
export function getPrintcityFoilByQty(slug: string): { byQty: Record<string, number>; repColor: string } | null {
  const ids = PRODUCT_MAPPING.filter((m) => m.ourSlug === slug).map((m) => m.printcityId)
  for (const id of ids) {
    const p = CENSUS.products.find((x) => x.id === id)
    if (p?.hasFoil && p.foilTable && p.foilTable.byColor) {
      const colors = Object.keys(p.foilTable.byColor)
      if (colors.length === 0) continue
      const repColor = colors[0]
      return { byQty: p.foilTable.byColor[repColor], repColor }
    }
  }
  return null
}

/** byQty 수량브래킷에서 주문수량 → 박 단가(KRW). 정확 매치 없으면 상위 브래킷, 없으면 최대. */
export function lookupPrintcityFoilKrw(byQty: Record<string, number>, qty: number): number {
  const entries = Object.entries(byQty)
    .map(([q, v]) => [Number(q), v] as [number, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[0] - b[0])
  if (entries.length === 0) return 0
  const exact = entries.find(([q]) => q === qty)
  if (exact) return exact[1]
  const upper = entries.find(([q]) => q >= qty)
  if (upper) return upper[1]
  return entries[entries.length - 1][1]
}
