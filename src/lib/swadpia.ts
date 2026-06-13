/**
 * Swadpia pricing data integration
 *
 * Fetches paper/print cost/size data from the swadpia.co.kr JSON endpoint.
 *
 * Endpoint: POST /estimate/estimate_goods/json_data
 * Params: t (timestamp), product=name, category_code
 */

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
  // 쇼핑백/봉투백
  'paper-shopping-bags': 'CPK4000',     // 일반쇼핑백
  'kraft-bags': 'CPK4000',
  'gift-bags': 'CPK2000',               // 리본&브레이드 쇼핑백
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

    const result: SwadpiaCategoryData = {
      categoryCode,
      papers,
      printEntries,
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
