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

/** Product slug to Swadpia category_code */
const CATEGORY_MAP: Record<string, string> = {
  'business-cards': 'CNC1000',
  'premium-business-cards': 'CNC2000',
  'stickers': 'CST1000',
  'die-cut-stickers': 'CST2000',
  'flyers': 'CLF1000',
  'brochures': 'CLF2000',
  'postcards': 'CDP3000',
  'posters': 'CPR2000',
  'banners': 'CPR5000',
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
