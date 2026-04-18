/**
 * 성원애드피아 가격 데이터 연동
 *
 * 성원애드피아(swadpia.co.kr) 사이트의 JSON 엔드포인트에서
 * 실제 용지/인쇄비/사이즈 데이터를 가져옵니다.
 *
 * 엔드포인트: POST /estimate/estimate_goods/json_data
 * 파라미터: t (timestamp), product=name, category_code
 */

const SWADPIA_BASE = 'https://www.swadpia.co.kr'
const FETCH_TIMEOUT_MS = 15_000

// ─── 타입 정의 ───────────────────────────────────────────────

/** 용지 정보 (paper_info) */
export interface SwadpiaPaper {
  paper_code: string
  paper_type_code: string
  paper_weight: string
  paper_weight_txt: string       // "스노우지 백색 250g"
  paper_summary: string          // "백색 250g"
  paper_side_type: string        // "2" = 양면
  price_unit1: number            // 단면 전지 단가 (KRW)
  price_unit2: number            // 양면 전지 단가 (KRW)
  price_sale_rate: number        // 할인율 (0.7 = 30% 할인)
  print_extra_rate: number       // 추가 인쇄 비율
  print_method_list: string      // "PTM10/일반인쇄||PTM20/UV인쇄"
}

/** 인쇄비 매트릭스 항목 (print_info1) */
export interface SwadpiaPrintEntry {
  quantity: number               // 수량
  paper_code: string
  print_method: string           // "PTM10"
  print_unit1: number            // 단면 인쇄비 (KRW)
  print_unit2: number            // 양면 인쇄비 (KRW)
  add_unit2: number              // 양면 추가비 (KRW)
}

/** 사이즈 정보 (size_info) */
export interface SwadpiaSize {
  size_type_code: string
  size_type_name: string         // "(90*50)"
  cut_norm_x_size: string
  cut_norm_y_size: string
}

/** 카테고리별 전체 가격 데이터 */
export interface SwadpiaCategoryData {
  categoryCode: string
  papers: SwadpiaPaper[]
  printEntries: SwadpiaPrintEntry[]
  sizes: SwadpiaSize[]
  fetchedAt: number
  fetchSuccess: boolean
  errorMessage?: string
}

// ─── 카테고리 매핑 ───────────────────────────────────────────

/** 우리 상품 slug → 성원 category_code */
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

// ─── 캐시 (메모리, 1시간 TTL) ────────────────────────────────

const cache = new Map<string, SwadpiaCategoryData>()
const CACHE_TTL_MS = 60 * 60 * 1000

// ─── 데이터 가져오기 ─────────────────────────────────────────

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
 * 성원 JSON 엔드포인트에서 카테고리별 가격 데이터를 가져옵니다.
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
      errorMessage: `매핑 없음: ${slug}`,
    }
  }

  // 캐시 확인
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

    // paper_info 파싱
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

    // print_info1 파싱 (수량별 인쇄비 매트릭스)
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

    // size_info 파싱
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
      errorMessage: err instanceof Error ? err.message : '알 수 없는 오류',
    }
  }
}

/**
 * 특정 용지+수량 조합의 성원 인쇄비를 조회합니다.
 * 정확한 수량이 없으면 가장 가까운 상위 수량으로 보간합니다.
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

  // 정확한 수량 매치
  const exact = entries.find(e => e.quantity === quantity)
  if (exact) {
    return doubleSided ? exact.print_unit2 : exact.print_unit1
  }

  // 가장 가까운 상위 수량
  const upper = entries.find(e => e.quantity >= quantity)
  if (upper) {
    return doubleSided ? upper.print_unit2 : upper.print_unit1
  }

  // 최대 수량 초과 시 최대값 사용
  const last = entries[entries.length - 1]
  return doubleSided ? last.print_unit2 : last.print_unit1
}

/**
 * 성원 기준 가격 계산 (KRW)
 *
 * 공식: 인쇄비 (print_unit) = 수량별 인쇄 원가
 * 이것이 성원에서 우리가 지불하는 도매가입니다.
 */
export function calculateSwadpiaPriceKrw(
  data: SwadpiaCategoryData,
  paperCode: string,
  quantity: number,
  doubleSided: boolean = true,
): number {
  const printCost = lookupPrintCost(data, paperCode, quantity, doubleSided)
  if (printCost === null) {
    // 인쇄비 매트릭스에 없는 경우 (스티커 등)
    // paper_info의 가격으로 폴백
    const paper = data.papers.find(p => p.paper_code === paperCode)
    if (!paper) return 0
    return doubleSided
      ? paper.price_unit2 * paper.price_sale_rate
      : paper.price_unit1 * paper.price_sale_rate
  }
  return printCost
}

/**
 * 모든 카테고리의 가격 데이터를 병렬로 가져옵니다.
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
      errorMessage: r.reason?.message ?? '알 수 없는 오류',
    }
  })
}

// 하위 호환용 타입/함수 export
export type SwadpiaProductResult = SwadpiaCategoryData
export const fetchSwadpiaProductPrice = fetchSwadpiaCategoryData
export const fetchAllSwadpiaPrices = fetchAllSwadpiaData
