/**
 * Swadpia pricing data integration
 *
 * Fetches paper/print cost/size data from the swadpia.co.kr JSON endpoint.
 *
 * Endpoint: POST /estimate/estimate_goods/json_data
 * Params: t (timestamp), product=name, category_code
 *
 * ⚠️ OMO-2646 (2026-06-08): 성원애드피아가 사이트를 개편하면서 우리가 의존하던
 * **비인증 공개 엔드포인트가 전면 폐지**됐다. 라이브 확인 결과:
 *   - POST /estimate/estimate_goods/json_data → 404 (Apache Not Found)
 *   - GET  /goods/goods_view/{cat}/{goodsCode} → 비로그인 404 (로그인 게이트)
 *   - GET  /member/login → 404 (로그인은 홈페이지 모달, 필드 mem_login_id)
 * 소형인쇄 카탈로그 자체는 adpiamall로 이전되지 않았고 swadpia.co.kr에 그대로 있으나,
 * 견적/가격 조회가 모두 세션 인증 뒤로 들어갔다. 신규 엔드포인트는 인증 세션 없이는
 * 확인 불가하여 미정. 그래서 아래 SWADPIA_PUBLIC_ENDPOINT_LIVE 가드로 죽은 엔드포인트
 * 호출을 차단하고 DB 가격 폴백을 명시적으로 사용한다(소비자는 fetchSuccess:false 시
 * 이미 DB 폴백 — ProductConfigurator useSwadpia 가드). 재연동 방향은 보드 결정 대기.
 */

const SWADPIA_BASE = 'https://www.swadpia.co.kr'
const FETCH_TIMEOUT_MS = 15_000

/**
 * OMO-2646: 공개 견적 엔드포인트가 살아있는지 여부.
 * 현재 false — 엔드포인트가 404로 폐지됐으므로 매 렌더/크론마다 무의미한 404 왕복과
 * print_price_history 실패행 누적을 막기 위해 네트워크 호출을 건너뛴다.
 * 신규 인증 기반 엔드포인트로 재연동되면 true 로 되돌리고 fetch 로직을 교체한다.
 */
const SWADPIA_PUBLIC_ENDPOINT_LIVE = false

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

/** Product slug to Swadpia category_code */
const CATEGORY_MAP: Record<string, string> = {
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
  'banners': 'CPR5000',
  'x-banners': 'CPR5000',
  'rollup-banners': 'CPR5000',
  'mini-banners': 'CPR5000',
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
 * Fetches category pricing data from the Swadpia JSON endpoint.
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

  // OMO-2646: 공개 엔드포인트 폐지 — 죽은 404 호출을 건너뛰고 즉시 폴백 사유 반환.
  if (!SWADPIA_PUBLIC_ENDPOINT_LIVE) {
    return {
      categoryCode,
      papers: [],
      printEntries: [],
      sizes: [],
      fetchedAt: Date.now(),
      fetchSuccess: false,
      errorMessage: 'OMO-2646: swadpia public estimate endpoint retired (now auth-gated); using DB price fallback',
    }
  }

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
    const papers: SwadpiaPaper[] = (raw.paper_info ?? []).map((p: Record<string, unknown>) => ({
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

    // Parse print_info1 (quantity-based print cost matrix)
    const printEntries: SwadpiaPrintEntry[] = []
    for (const entry of (raw.print_info1 ?? [])) {
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
    const sizes: SwadpiaSize[] = (raw.size_info ?? []).map((s: Record<string, unknown>) => ({
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

    cache.set(slug, result)
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
