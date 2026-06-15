/**
 * Swadpia pricing data integration
 *
 * Fetches paper/print cost/size data from the swadpia.co.kr JSON endpoint.
 *
 * Endpoint: POST /estimate/estimate_goods/json_data
 * Params: t (timestamp), product=name, category_code
 */

import { synthesizeBagPrintEntries } from '@/config/bag-pricing'

const SWADPIA_BASE = 'https://www.swadpia.co.kr'
const FETCH_TIMEOUT_MS = 15_000

// ─── Type definitions ───────────────────────────────────────

/** Paper info (paper_info) */
export interface SwadpiaPaper {
  paper_code: string
  paper_type_code: string
  paper_weight: string
  paper_weight_txt: string       // e.g. "Snow white 250g"
  paper_summary: string          // e.g. "White 250g"
  paper_side_type: string        // "2" = double-sided
  price_unit1: number            // Single-sided sheet price (KRW)
  price_unit2: number            // Double-sided sheet price (KRW)
  price_sale_rate: number        // Discount rate (0.7 = 30% off)
  print_extra_rate: number       // Extra print rate
  print_method_list: string      // e.g. "PTM10/Standard||PTM20/UV"
}

/** Print cost matrix entry (print_info1) */
export interface SwadpiaPrintEntry {
  quantity: number               // Quantity
  paper_code: string
  print_method: string           // "PTM10"
  print_unit1: number            // Single-sided print cost (KRW)
  print_unit2: number            // Double-sided print cost (KRW)
  add_unit2: number              // Double-sided surcharge (KRW)
}

/** Size info (size_info) */
export interface SwadpiaSize {
  size_type_code: string
  size_type_name: string         // "(90*50)"
  cut_norm_x_size: string
  cut_norm_y_size: string
}

/** Full pricing data per category */
export interface SwadpiaCategoryData {
  categoryCode: string
  papers: SwadpiaPaper[]
  printEntries: SwadpiaPrintEntry[]
  sizes: SwadpiaSize[]
  fetchedAt: number
  fetchSuccess: boolean
  errorMessage?: string
}

// ─── Category mapping ───────────────────────────────────────

/**
 * Product slug to Swadpia category_code.
 *
 * 자동발주 라우팅(`swadpia-order.ts` 의 SWADPIA_GOODS_MAP)이 이 맵을 단일
 * 소스로 사용한다. 이전엔 발주맵을 따로 15종만 두어 23종이 누락됐다(OMO-2634).
 * 새 제품 추가 시 여기에만 등록하면 가격조회 + 자동발주 라우팅이 함께 적용된다.
 */
export const CATEGORY_MAP: Record<string, string> = {
  // 명함류
  'business-cards': 'CNC1000',
  'premium-business-cards': 'CNC2000',
  'premium-foil-cards': 'CNC3000',       // Luxury 메탈/포일 명함
  'metallic-business-cards': 'CNC3000',  // Luxury 메탈릭 명함
  'letterpress-business-cards': 'CNC4000', // 아트지 300g 명함
  'transparent-business-cards': 'CNC5000', // PET 투명 명함
  'uv-business-cards': 'CNC6000',        // UV 코팅 명함 (11종)
  'pearl-business-cards': 'CNC8000',     // UV 코팅 명함 (9종)
  // 스티커류
  'stickers': 'CST1000',
  'die-cut-stickers': 'CST2000',
  'holographic-stickers': 'CST5000',   // 스페셜스티커
  'roll-stickers': 'CST7000',          // 팬시롤스티커
  'price-labels': 'CLP1000',           // 라벨스티커(롤)
  'barcode-labels': 'CLP1000',
  'food-labels': 'CLP1000',
  // 인쇄물
  'flyers': 'CLF1000',
  'brochures': 'CLF2000',
  'leaflets': 'CPR3000',               // 리플렛/팜플렛
  'menus': 'CLF2000',                  // 브로슈어와 동일 카테고리
  'saddle-stitch-booklet': 'CPR4000',  // 책자
  'perfect-bound-booklet': 'CPR4000',
  'catalogs': 'CPR4000',
  // 우편
  'postcards': 'CDP3000',
  // 디스플레이
  'posters': 'CPR2000',
  // ⚠️ banners/x/rollup: 성원 CPR5000 은 실제 '종이홀더'(오매핑). 성원엔 대형 배너
  // 카테고리가 없음(미니배너 COD1100 만 존재) → 라우팅 보류, 보드 결정 대기.
  'banners': 'CPR5000',
  'x-banners': 'CPR5000',
  'rollup-banners': 'CPR5000',
  'mini-banners': 'COD1100',            // 종이미니배너 (OMO-3058 정정: CPR5000→COD1100)
  // 봉투·서식
  'standard-envelopes': 'CEV1000',
  'admin-envelopes': 'CEV1000',
  'gusset-envelopes': 'CEV1000',
  'receipts': 'CNR2000',
  'quotation-forms': 'CNR2000',
  'invoice-forms': 'CNR2000',
  'ncr-forms': 'CNR2000',
  // 캘린더
  'wall-calendars': 'CCD1000',
  'desk-calendars': 'CCD2000',
  'mini-calendars': 'CCD2000',
  // ─── OMO-3058: 성원 전체 카탈로그 정렬 (라이브 검증 완료, 22종 신규) ───
  // 초대장/안내장/인사장
  'invitation-cards': 'CVS1000',        // 일반초대장/상품권
  'wedding-cards': 'CDP2000',           // 디지털청첩장/초대장
  'greeting-cards-general': 'CCM4000',  // 연하장
  'hangtag-cards': 'CNC7000',           // 프리컷팅(커팅 행택)
  // 스티커 변형 (용지 옵션 차이 → 동일 카테고리)
  'transparent-stickers': 'CST1000',    // 재단형(PVC 투명지 포함)
  'kraft-stickers': 'CST1000',
  'eco-stickers': 'CST1000',
  // 노트/메모
  'general-notebooks': 'CDP5100',       // 디지털노트
  'diaries': 'CDP5100',                 // ※성원 전용 다이어리 없음 → 디지털노트 대용
  'spring-notebooks': 'CDP5100',
  'memo-pads-general': 'CNR3000',       // 떡메모지
  'sticky-notes': 'CPS7000',            // 사각포스트잇
  // POP (성원 대형 POP 없음 → 미니배너 대용, 보드 확인 필요)
  'paper-pop': 'COD1100',               // 종이미니배너
  'foam-pop': 'COD1100',                // ※성원 폼보드 없음 → 미니배너 대용(루즈매칭)
  // 박스 (전부 판지/박스 단일 카테고리)
  'general-boxes': 'CHI3000',           // 판지/박스
  'corrugated-boxes': 'CHI3000',
  'gift-boxes': 'CHI3000',
  'cake-boxes': 'CHI3000',
  'tube-boxes': 'CHI3000',
  // 쇼핑백 — 성원 상단 4버튼 = 4개 독립 category_code (OMO-3197, 라이브 재크롤 검증)
  //   CPK2000 리본&브레이드 쇼핑백 / CPK4000 종이끈 쇼핑백 /
  //   CPK3000 끈없는 쇼핑백 / CPK5000 소량 쇼핑백(50·100 전용)
  // 옵션(용지/사이즈/수량)은 scripts/omo3197-bag-options.json 에 라이브 스냅샷 보관.
  'paper-shopping-bags': 'CPK4000',     // 종이끈 쇼핑백 (꼬임끈 손잡이)
  'kraft-bags': 'CPK4000',              // 크라프트지 = CPK4000 용지 변형(동일 카테고리)
  'gift-bags': 'CPK2000',               // 리본&브레이드 쇼핑백 (리본 손잡이)
  'handleless-bags': 'CPK3000',         // 끈없는 쇼핑백
  'small-batch-bags': 'CPK5000',        // 소량 쇼핑백 (50·100매)
}

// ─── 듀얼 프레스 라우팅 (OMO-3061) ────────────────────────────
//
// 성원은 같은 제품을 인쇄방식으로 분할한다:
//   · 옵셋/합판 (CNC/CPR…) = 대량 저가(gang-run). 명함 기준 최소 200부.
//   · 디지털 인디고 (CDP…) = 소량(1~400부). 장당 단가는 높으나 초소량 가능.
//   · 디지털 토너 (COD…) = 초저가 소량 — 단, 가격이 json_data 에 미노출(별도
//     인터랙티브 경로 필요)이라 현 단계 라우팅 보류(OMO-3061 토너 후속).
//
// 보드 승인(OMO-3058 Option A): 제품은 하나로 유지하고, 고객이 수량을 고르면
// **각 수량에서 더 싸거나 유일하게 가능한 프레스를 자동 선택**한다(프레스 종류는
// 고객에게 숨김, 베네핏 마이크로카피만). 크로스오버는 고정 MOQ 가 아니라 두 프레스
// 매트릭스의 수량별 최저가 비교로 결정한다(pickCheapestPress).
//
// 라이브 검증(명함, scripts/omo3061-verify.mjs): 옵셋 CNC1000(200~300,000부),
// 디지털 CDP1000(1~400부). q1=디지털 600원 vs 옵셋 4,000원→디지털; q10+=옵셋 우세.
// 신규 쌍 추가 시: 두 코드 모두 print 매트릭스(print_info1/3)가 실가격을 반환하는지
// 라이브 확인 후 등록한다.
//
// ⚠️ OMO-3062 검증결과 — 후보쌍 posters(CPR2000/CDP4000)·booklets(CPR4000/CDP5000)·
//    leaflets(CPR3000/CDP7000)·brochures(CLF2000/CDP8000)는 **현 인프라로 등록 불가**.
//    근거(scripts/omo3062-probe.mjs, probe2.mjs): 이 카테고리들은 다중 size(6~10종)이며
//    bare json_data POST 는 default size 매트릭스 하나만 반환한다. 결과로 옵셋 CPR2000/
//    CPR3000/CLF2000 가 모두 동일한 64,000원/장(대형판 디폴트)을 내고, 디지털 파트너
//    CDP4000 는 600원/장(소형 디폴트) → 프레스 비교가 서로 다른 size 를 비교(apples-to-
//    oranges)해 오라우팅. 책자는 size + in_page_qty 이중 의존. lookupPressCost 의
//    "수량→단일가격" 가정은 명함처럼 단일포맷 제품에서만 성립한다.
//    → 멀티사이즈 제품 등록은 size-키 기반 라우팅 확장이 선행돼야 함(후속 OMO-3064).
//    토너 COD1000/COD1100: json_data 에 print_unit2 매트릭스 자체가 없음(paper/size 만).
//    goods_view + JS calcuEstimate 인터랙티브 경로 필요(후속 OMO-3064).
//
// ⛔ OMO-3064 검증결과(라이브, scripts/omo3064-{jsonparam,interactive,sizewait}.mjs) —
//    [Task1 size-키 라우팅] **현 인프라로 자동화 불가 확정**. 3중 교차검증:
//      (a) json_data 는 paper_size/size/print_size 등 어떤 size 파라미터도 무시 →
//          전 size 동일 매트릭스(CPR2000=항상 64,000원 default A0200) 반환.
//      (b) goods_view product1: paper_size 직접 set + calcuEstimate 해도 price_unit2
//          불변(A1~B4 모두 134,310). 디지털 CDP4000 도 동일(전 size 179,070).
//      (c) 네이티브 onchange(chgPaperSize) 발화 시 AJAX 는 /estimate/estimate_goods/
//          product_size_preview 로 실치수(A1=594×841, B4=258×368)를 보내지만 **기하학
//          프리뷰만 반환**, 가격엔지 미반영. save_paper_size 가 선택과 무관하게 default
//          A0200 에 고정 → size→인쇄단가 연결은 자동화 도달 불가한 server-side commit
//          단계에서만 해소됨(실견적/발주 액션 위험 없이는 접근 불가).
//    → 멀티사이즈 듀얼프레스 자동라우팅 **영구 보류**. 보드 결정사항: 해당 제품군은
//      단일프레스로 등록(자동 프레스선택 미적용)하거나, 사람-게이트 수동 견적 유지.
//    [Task2 토너(COD) 인터랙티브 견적] product1.calcuEstimate → price_unit2 가 **값을
//      반환함**(COD1000=363,330 / COD1100=495,350, json_data 엔 매트릭스 부재와 대조).
//      단 (b)/(c)와 동일한 default-size commit 한계가 잠재 → 저가옵션 추가 전 가드된
//      라이브 검증(size/qty 정확도) 필수. 추가 여부는 보드 승인(인디고 기본/토너 옵션) 게이트.
// ⛔ OMO-3068 가드검증결과(라이브, scripts/omo3068-toner-{guard,ajax}.mjs) — **토너 옵션 보류 확정**.
//    토너 견적값은 default 한 점에서만 읽히며 size/qty 어느 축으로도 갈라지지 않음:
//      · COD1000: order_count(250개) 와 paper_size(4개) 전부 sweep → price_unit2 불변(363,330).
//      · COD1000: 두 번째 드라이버 paper_qty_select 를 100→22,000매까지 sweep 해도 363,330 고정,
//        가격 재계산 AJAX **0건** 발화(즉 22,000매도 363,330 = 명백한 stale default).
//      · COD1100: order_count·paper_size sweep 전부 불변(495,350). save_size 가 선택과 무관하게
//        default(A0300)에 고정 — Task1 size-commit 한계와 동일 근본원인.
//    → 토너는 json_data 매트릭스가 없어 인터랙티브 경로가 유일한데, 그 경로가 size/qty 를
//      commit 하지 않으므로 **수량/사이즈별 신뢰가능 단가 산출 불가**. 인디고(CDP) 대비 저가
//      수량구간도 산출 불가(인디고 단가는 json_data 매트릭스로 별도 취득되나 토너는 비교점 부재).
//    → 보드정책 "인디고 기본/토너 옵션" 중 **토너 옵션 절반은 미구현으로 종결**. 인디고 기본
//      라우팅은 기존대로 유지. 토너 재개 조건: 성원이 토너 단가를 json_data 매트릭스로 노출하거나
//      qty-commit 가능한 견적 API 제공 시(현재 도달 불가).
export type PressKind = 'offset' | 'digital'

export interface PressRoute {
  /** 옵셋/합판 category_code (대량) */
  offset: string
  /** 디지털 인디고 category_code (소량) */
  digital: string
}

export const PRESS_ROUTES: Record<string, PressRoute> = {
  'business-cards': { offset: 'CNC1000', digital: 'CDP1000' }, // 라이브 검증 OMO-3061
}

export interface PressCostResult {
  costKrw: number
  /** 라운드업된 실제 발주 수량(요청 이상 최소 단계) */
  effectiveQty: number
  paperCode: string
}

export interface PressPick extends PressCostResult {
  press: PressKind
  categoryCode: string
}

/**
 * 단일 프레스 매트릭스에서 수량별 인쇄비를 조회한다(OMO-3061).
 * - 요청 수량이 이 프레스의 최대 생산 수량을 넘으면 `null`(이 프레스로는 불가).
 * - 그 외엔 요청 이상 최소 수량단계로 라운드업한다(성원이 못 받는 소량 → 다음 배치).
 * - preferredPaper 가 해당 단계에 있으면 그 종이, 없으면 최저가 종이를 선택한다.
 */
export function lookupPressCost(
  entries: SwadpiaPrintEntry[],
  quantity: number,
  preferredPaper?: string,
): PressCostResult | null {
  const valid = entries.filter((e) => e.print_unit2 > 0)
  if (valid.length === 0) return null
  const maxQ = valid.reduce((m, e) => Math.max(m, e.quantity), 0)
  if (quantity > maxQ) return null // 이 프레스로는 해당 수량 생산 불가

  const steps = [...new Set(valid.map((e) => e.quantity))].sort((a, b) => a - b)
  const step = steps.find((s) => s >= quantity) ?? maxQ
  const atStep = valid.filter((e) => e.quantity === step)
  const pref = preferredPaper ? atStep.find((e) => e.paper_code === preferredPaper) : undefined
  const chosen = pref ?? atStep.reduce((m, e) => (e.print_unit2 < m.print_unit2 ? e : m), atStep[0])
  return { costKrw: chosen.print_unit2, effectiveQty: step, paperCode: chosen.paper_code }
}

export interface PressEntrySet {
  press: PressKind
  categoryCode: string
  entries: SwadpiaPrintEntry[]
}

/**
 * 주어진 수량에서 가장 저렴한(또는 유일하게 가능한) 프레스를 선택한다(OMO-3061).
 * 각 프레스를 lookupPressCost 로 평가해 생산 가능한 것 중 최저 KRW 단가를 고른다.
 * 모두 불가하면 `null`.
 */
export function pickCheapestPress(
  quantity: number,
  presses: PressEntrySet[],
  preferredPaper?: string,
): PressPick | null {
  let best: PressPick | null = null
  for (const p of presses) {
    const c = lookupPressCost(p.entries, quantity, preferredPaper)
    if (!c) continue
    if (!best || c.costKrw < best.costKrw) {
      best = { press: p.press, categoryCode: p.categoryCode, ...c }
    }
  }
  return best
}

export interface PressData {
  route: PressRoute
  offset: SwadpiaCategoryData
  digital: SwadpiaCategoryData
}

/**
 * 듀얼 프레스 제품(PRESS_ROUTES 등록)의 옵셋+디지털 가격 데이터를 함께 조회한다(OMO-3061).
 * 미등록 슬러그는 `null` → 호출측은 기존 단일 프레스 경로를 그대로 사용.
 */
export async function fetchPressData(slug: string): Promise<PressData | null> {
  const route = PRESS_ROUTES[slug]
  if (!route) return null
  const [offset, digital] = await Promise.all([
    fetchSwadpiaCategoryDataByCode(route.offset),
    fetchSwadpiaCategoryDataByCode(route.digital),
  ])
  return { route, offset, digital }
}

/**
 * 자동발주용 — 슬러그+수량으로 실제 발주할 프레스의 category_code 를 결정한다(OMO-3061).
 * 듀얼 프레스 제품이면 라이브 가격을 비교해 고객이 견적받은 것과 동일한 프레스를 고른다.
 * 미등록 슬러그/조회 실패 시 fallback(기본 옵셋 코드)으로 안전 폴백.
 */
export async function resolvePressCategoryCode(
  slug: string,
  quantity: number,
  fallback?: string,
): Promise<string> {
  const route = PRESS_ROUTES[slug]
  const base = fallback ?? CATEGORY_MAP[slug] ?? slug
  if (!route) return base
  try {
    const [off, dig] = await Promise.all([
      fetchSwadpiaCategoryDataByCode(route.offset),
      fetchSwadpiaCategoryDataByCode(route.digital),
    ])
    const pick = pickCheapestPress(quantity, [
      { press: 'offset', categoryCode: route.offset, entries: off.printEntries },
      { press: 'digital', categoryCode: route.digital, entries: dig.printEntries },
    ])
    return pick?.categoryCode ?? route.offset
  } catch {
    return route.offset
  }
}

// ─── In-memory cache (1-hour TTL) ────────────────────────────

const cache = new Map<string, SwadpiaCategoryData>()
const CACHE_TTL_MS = 60 * 60 * 1000

// ─── Data fetching ─────────────────────────────────────────

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function parseNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? 0 : n
}

/**
 * 성원 json_data 는 카테고리별로 paper_info/size_info 등을 배열이 아니라
 * 숫자키 객체({"0":{…},"1":{…}}) 또는 false/null 로 줄 때가 있다(스티커 등).
 * 항상 배열로 정규화해 .map 호출이 깨지지 않게 한다. (OMO-3058)
 */
function asArray<T = Record<string, unknown>>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v && typeof v === 'object') return Object.values(v as Record<string, T>)
  return []
}

/**
 * Fetches category pricing data from the Swadpia JSON endpoint by slug.
 * 슬러그→코드 변환(CATEGORY_MAP) + 1시간 캐시. 실제 fetch 는 …ByCode 위임.
 */
export async function fetchSwadpiaCategoryData(slug: string): Promise<SwadpiaCategoryData> {
  const categoryCode = CATEGORY_MAP[slug]
  if (!categoryCode) {
    return {
      categoryCode: '',
      papers: [],
      printEntries: [],
      sizes: [],
      fetchedAt: Date.now(),
      fetchSuccess: false,
      errorMessage: `No mapping found: ${slug}`,
    }
  }

  // Check cache
  const cached = cache.get(slug)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }

  const result = await fetchSwadpiaCategoryDataByCode(categoryCode)
  if (result.fetchSuccess) cache.set(slug, result)
  return result
}

/**
 * OMO-3058: 임의 성원 category_code 로 직접 가격/옵션 데이터를 조회한다.
 * 맵핑 검증(보드가 붙인 성원 링크 확인)·드리프트 모니터링에서 사용.
 * 슬러그 캐시를 거치지 않으므로 항상 라이브 값을 반환한다.
 */
export async function fetchSwadpiaCategoryDataByCode(categoryCode: string): Promise<SwadpiaCategoryData> {
  try {
    const formData = new URLSearchParams({
      t: String(Math.floor(Date.now() / 1000)),
      product: 'name',
      category_code: categoryCode,
    })

    const res = await fetchWithTimeout(`${SWADPIA_BASE}/estimate/estimate_goods/json_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${SWADPIA_BASE}/goods/goods_view/${categoryCode}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersPriceBot/1.0)',
      },
      body: formData.toString(),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const raw = await res.json()

    // Parse paper_info
    const papers: SwadpiaPaper[] = asArray(raw.paper_info).map((p: Record<string, unknown>) => ({
      paper_code: String(p.paper_code ?? ''),
      paper_type_code: String(p.paper_type_code ?? ''),
      paper_weight: String(p.paper_weight ?? ''),
      paper_weight_txt: String(p.paper_weight_txt ?? ''),
      paper_summary: String(p.paper_summary ?? ''),
      paper_side_type: String(p.paper_side_type ?? ''),
      price_unit1: parseNumber(p.price_unit1 as string),
      price_unit2: parseNumber(p.price_unit2 as string),
      price_sale_rate: parseNumber(p.price_sale_rate as string),
      print_extra_rate: parseNumber(p.print_extra_rate as string),
      print_method_list: String(p.print_method_list ?? ''),
    }))

    // Parse 수량별 인쇄비 매트릭스.
    // 옵셋/합판은 print_info1, 디지털(인디고 CDP/토너 COD)은 print_info3 에 담긴다(OMO-3058).
    // print_info1 이 비어있으면 print_info3 으로 폴백해 디지털 가격도 추출.
    const printSource = asArray(raw.print_info1).length > 0 ? raw.print_info1 : raw.print_info3
    const printEntries: SwadpiaPrintEntry[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of asArray<any>(printSource)) {
      const qty = parseInt(String(entry.unit_key), 10)
      if (isNaN(qty)) continue
      const info = entry['0']
      if (!info) continue
      printEntries.push({
        quantity: qty,
        paper_code: String(info.paper_code ?? ''),
        print_method: String(info.print_method ?? ''),
        print_unit1: parseNumber(info.print_unit1),
        print_unit2: parseNumber(info.print_unit2),
        add_unit2: parseNumber(info.add_unit2),
      })
    }

    // Parse size_info
    const sizes: SwadpiaSize[] = asArray(raw.size_info).map((s: Record<string, unknown>) => ({
      size_type_code: String(s.size_type_code ?? ''),
      size_type_name: String(s.size_type_name ?? ''),
      cut_norm_x_size: String(s.cut_norm_x_size ?? ''),
      cut_norm_y_size: String(s.cut_norm_y_size ?? ''),
    }))

    // OMO-3200: 쇼핑백(CPK2000/3000/4000/5000)은 print_info1 의 paper_code 가 비고
    // unit_key 가 내부 index 라 위 정적 파싱으로는 수량↔단가 매핑이 불가하다.
    // calcuEstimate 인터랙티브로 추출한 수량별 도매원가 매트릭스로 printEntries 를 대체한다.
    const bagEntries = synthesizeBagPrintEntries(categoryCode)

    const result: SwadpiaCategoryData = {
      categoryCode,
      papers,
      printEntries: bagEntries ?? printEntries,
      sizes,
      fetchedAt: Date.now(),
      fetchSuccess: true,
    }

    return result

  } catch (err) {
    return {
      categoryCode,
      papers: [],
      printEntries: [],
      sizes: [],
      fetchedAt: Date.now(),
      fetchSuccess: false,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Looks up print cost for a specific paper+quantity combination.
 * If no exact quantity match, interpolates to nearest higher quantity.
 */
export function lookupPrintCost(
  data: SwadpiaCategoryData,
  paperCode: string,
  quantity: number,
  doubleSided: boolean = true,
): number | null {
  const entries = data.printEntries
    .filter(e => e.paper_code === paperCode)
    .sort((a, b) => a.quantity - b.quantity)

  if (entries.length === 0) return null

  // Exact quantity match
  const exact = entries.find(e => e.quantity === quantity)
  if (exact) {
    return doubleSided ? exact.print_unit2 : exact.print_unit1
  }

  // Nearest higher quantity
  const upper = entries.find(e => e.quantity >= quantity)
  if (upper) {
    return doubleSided ? upper.print_unit2 : upper.print_unit1
  }

  // Exceeds max quantity; use highest available
  const last = entries[entries.length - 1]
  return doubleSided ? last.print_unit2 : last.print_unit1
}

/**
 * Calculate Swadpia base price (KRW)
 *
 * Formula: print_unit = per-quantity print cost
 * This is the wholesale price we pay to Swadpia.
 */
export function calculateSwadpiaPriceKrw(
  data: SwadpiaCategoryData,
  paperCode: string,
  quantity: number,
  doubleSided: boolean = true,
): number {
  const printCost = lookupPrintCost(data, paperCode, quantity, doubleSided)
  if (printCost === null) {
    // Not in print cost matrix (e.g. stickers)
    // Fall back to paper_info pricing
    const paper = data.papers.find(p => p.paper_code === paperCode)
    if (!paper) return 0
    return doubleSided
      ? paper.price_unit2 * paper.price_sale_rate
      : paper.price_unit1 * paper.price_sale_rate
  }
  return printCost
}

/**
 * Fetches pricing data for all categories in parallel.
 */
export async function fetchAllSwadpiaData(): Promise<SwadpiaCategoryData[]> {
  const slugs = Object.keys(CATEGORY_MAP)
  const results = await Promise.allSettled(slugs.map(fetchSwadpiaCategoryData))
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      categoryCode: CATEGORY_MAP[slugs[i]] ?? '',
      papers: [],
      printEntries: [],
      sizes: [],
      fetchedAt: Date.now(),
      fetchSuccess: false,
      errorMessage: r.reason?.message ?? 'Unknown error',
    }
  })
}

// Backward-compatible type/function exports
export type SwadpiaProductResult = SwadpiaCategoryData
export const fetchSwadpiaProductPrice = fetchSwadpiaCategoryData
export const fetchAllSwadpiaPrices = fetchAllSwadpiaData
