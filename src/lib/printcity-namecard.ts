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
// OMO-3454: printcity 실제 스토어프론트(site/seller/printcity menuCategory[명함]) 16제품 기준.
// category3rd = subCateCode(bc01~bc06). null = 우리 카탈로그 미보유(printcity 측 갭).
export const PRODUCT_MAPPING: ProductMapping[] = [
  { printcityId: '679c60008db6e006523747ad', printcityName: '일반 명함', category3rd: 'bc01', ourSlug: 'business-cards', note: '표준 명함(스노우/아트지) ↔ 우리 일반 명함' },
  { printcityId: '679c60008db6e006523747b9', printcityName: '고급 명함', category3rd: 'bc01', ourSlug: 'premium-business-cards', note: '고급(통합·수입지 다종, 434조합) ↔ 프리미엄 명함' },
  { printcityId: '679c60008db6e006523747b8', printcityName: 'PET 카드명함', category3rd: 'bc02', ourSlug: 'transparent-business-cards', note: 'PET(투명/반투명) ↔ 투명 명함' },
  { printcityId: '679c60008db6e006523747b5', printcityName: 'MC 카드명함', category3rd: 'bc02', ourSlug: 'premium-business-cards', note: '두꺼운 카드명함(MC) ↔ 프리미엄 명함' },
  { printcityId: '679c60008db6e006523747ae', printcityName: '점자 명함', category3rd: 'bc03', ourSlug: null, note: '점자(UV 돌출) — 우리 카탈로그 미보유(갭)' },
  { printcityId: '679c60008db6e006523747b1', printcityName: '엣지 명함', category3rd: 'bc03', ourSlug: 'premium-foil-cards', note: '엣지박(12색) ↔ 박 카드(foil cards)' },
  { printcityId: '679c60008db6e006523747b6', printcityName: '부분코팅 명함', category3rd: 'bc03', ourSlug: 'uv-business-cards', note: '부분코팅(스팟UV) ↔ UV 카드' },
  { printcityId: '679c60008db6e006523747b2', printcityName: '에폭시 명함', category3rd: 'bc03', ourSlug: 'premium-foil-cards', note: '에폭/엠보(형압) ↔ 박·형압 카드' },
  { printcityId: '679c57c58db6e00652374789', printcityName: '디지털 명함', category3rd: 'bc04', ourSlug: 'business-cards', note: '디지털 인쇄 표준 명함 ↔ 일반 명함' },
  { printcityId: '679c5fff8db6e0065237478e', printcityName: '디지털 화이트명함', category3rd: 'bc04', ourSlug: 'business-cards', note: '화이트토너 디지털 ↔ 일반 명함(특수토너 큐레이션)' },
  { printcityId: '679c5fff8db6e0065237478d', printcityName: '디지털 긴급명함', category3rd: 'bc04', ourSlug: 'business-cards', note: '긴급(당일) 디지털 ↔ 일반 명함(리드타임 옵션)' },
  { printcityId: '679c5fff8db6e0065237478c', printcityName: '디지털 형광명함', category3rd: 'bc04', ourSlug: 'business-cards', note: '형광(네온) 디지털 ↔ 일반 명함(형광토너 큐레이션)' },
  { printcityId: '679c50d38db6e0065237477e', printcityName: '디지털 카드명함', category3rd: 'bc05', ourSlug: 'premium-business-cards', note: '두꺼운 카드(디지털) ↔ 프리미엄 명함' },
  { printcityId: '679c60008db6e006523747b3', printcityName: '디지털 3D박명함', category3rd: 'bc06', ourSlug: 'premium-foil-cards', note: '디지털 3D박(3색) ↔ 박 카드(foil cards)' },
  { printcityId: '679c60008db6e006523747b7', printcityName: '디지털 부분에폭명함', category3rd: 'bc06', ourSlug: 'premium-foil-cards', note: '부분에폭(스팟에폭시) ↔ 박·형압 카드' },
  { printcityId: '679c58488db6e0065237478b', printcityName: '디지털 홀로그램명함', category3rd: 'bc06', ourSlug: 'premium-foil-cards', note: '홀로그램 디지털 ↔ 박 카드(홀로그램 큐레이션)' },
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
  // OMO-3454: printcity 실제 스토어프론트 명함명 기준(전역 census 폐기).
  const targets = ['일반 명함', '고급 명함', 'MC 카드명함', '디지털 카드명함']
  const premium = new Set(['고급 명함', 'MC 카드명함', '디지털 카드명함'])
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
      note: premium.has(name) ? '프리미엄/카드(↔성원 표준앵커, 등급차 존재)' : '표준 용지',
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
    .filter((p) => p.nameKO === '일반 명함' && p.counts.combos > 0)
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
