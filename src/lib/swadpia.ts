/**
 * 성원애드피아 가격 스크래퍼
 *
 * 성원애드피아(swadpia.co.kr) 사이트에서 상품별 가격 데이터를 파싱합니다.
 * 가격 데이터는 페이지 내 스크립트 변수 또는 AJAX 응답으로 제공됩니다.
 *
 * 매핑 전략:
 * - 우리 상품 slug → 성원 category_code + goods_code
 * - 성원 페이지에서 수량/옵션별 가격 추출
 * - 실패 시 폴백 가격 사용
 */

const SWADPIA_BASE = 'https://www.swadpia.co.kr'
const FETCH_TIMEOUT_MS = 15_000

// ─── 타입 정의 ───────────────────────────────────────────────

export interface SwadpiaOptionPrice {
  optionKey: string   // "qty:100,paper:snow_350,coating:matte"
  priceKrw: number
  goodsCode: string
}

export interface SwadpiaProductResult {
  slug: string
  basePriceKrw: number        // 기본 단가 (최소 옵션 조합 가격)
  optionPrices: SwadpiaOptionPrice[]
  sourceData: Record<string, unknown> | null
  fetchSuccess: boolean
  errorMessage?: string
}

// ─── 성원 상품 매핑 ───────────────────────────────────────────
// slug → 성원 상품 코드 목록 (옵션별로 여러 goods_code 존재)

interface SwadpiaGoodsMapping {
  categoryCode: string
  goodsCode: string
  description: string
  // 이 goods_code가 매핑되는 우리 옵션 조합
  optionKey: string
}

const PRODUCT_MAPPINGS: Record<string, SwadpiaGoodsMapping[]> = {
  'business-cards': [
    { categoryCode: 'CNC1000', goodsCode: 'GNC1001', description: '일반지명함 (스노우/아트지)', optionKey: 'paper:snow_350,coating:matte' },
    { categoryCode: 'CNC2000', goodsCode: 'GNC2001', description: '고급지명함 (리넨/특수지)', optionKey: 'paper:linen_350,coating:none' },
  ],
  'stickers': [
    { categoryCode: 'CST1000', goodsCode: 'GST1001', description: '재단형 스티커', optionKey: 'type:cut' },
    { categoryCode: 'CST2000', goodsCode: 'GST2001', description: '도무송형 스티커', optionKey: 'type:diecut' },
  ],
  'flyers': [
    { categoryCode: 'CLF1000', goodsCode: 'GLF1001', description: '합판전단 (A4)', optionKey: 'size:a4,type:ganpan' },
  ],
  'postcards': [
    { categoryCode: 'CDP3000', goodsCode: 'GDP3001', description: '엽서', optionKey: 'size:standard' },
  ],
  'posters': [
    { categoryCode: 'CPR2000', goodsCode: 'GPR2001', description: '포스터 (A3)', optionKey: 'size:a3' },
  ],
}

// ─── 수량 옵션 (공통) ─────────────────────────────────────────

const QUANTITY_OPTIONS = [100, 200, 500, 1000]

// ─── 유틸리티 ─────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 성원 상품 상세 페이지 HTML에서 가격 데이터를 추출합니다.
 * 가격은 스크립트 변수 또는 숨겨진 폼 필드에 포함되어 있습니다.
 */
function extractPriceFromHtml(html: string): number | null {
  // 패턴 1: "order_amt" 값 (예: var order_amt = 15000)
  const orderAmtMatch = html.match(/var\s+order_amt\s*=\s*["']?(\d+)["']?/)
  if (orderAmtMatch) {
    return parseInt(orderAmtMatch[1], 10)
  }

  // 패턴 2: 상품 가격 표시 (예: <span class="price">15,000원</span>)
  const priceSpanMatch = html.match(/class=["'](?:price|goods_price|item_price)[^"']*["'][^>]*>([0-9,]+)원/)
  if (priceSpanMatch) {
    return parseInt(priceSpanMatch[1].replace(/,/g, ''), 10)
  }

  // 패턴 3: JSON 데이터 내 price 필드 (예: "price":"15000")
  const jsonPriceMatch = html.match(/"(?:price|base_price|goods_price)"\s*:\s*["']?(\d+)["']?/)
  if (jsonPriceMatch) {
    return parseInt(jsonPriceMatch[1], 10)
  }

  // 패턴 4: 메인 페이지 가격 표시 형식 (예: 15,000원)
  const mainPriceMatch = html.match(/(\d{1,3}(?:,\d{3})+)원/)
  if (mainPriceMatch) {
    return parseInt(mainPriceMatch[1].replace(/,/g, ''), 10)
  }

  return null
}

/**
 * 성원 estimate API를 통해 견적 가격을 조회합니다.
 * POST /estimate/estimate_order/action_proc 엔드포인트 사용
 */
async function fetchEstimatePrice(
  categoryCode: string,
  goodsCode: string,
  qty: number
): Promise<number | null> {
  try {
    const formData = new URLSearchParams({
      category_code: categoryCode,
      goods_code: goodsCode,
      order_count: String(qty),
      goods_mode: 'estimate',
    })

    const res = await fetchWithTimeout(`${SWADPIA_BASE}/estimate/estimate_order/action_proc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${SWADPIA_BASE}/goods/goods_view/${categoryCode}/${goodsCode}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersPriceBot/1.0)',
      },
      body: formData.toString(),
    })

    if (!res.ok) return null

    const text = await res.text()

    // JSON 응답 파싱 시도
    try {
      const json = JSON.parse(text)
      if (json.order_amt) return parseInt(json.order_amt, 10)
      if (json.price) return parseInt(json.price, 10)
      if (json.data?.price) return parseInt(json.data.price, 10)
    } catch {
      // JSON이 아닌 경우 HTML 파싱
      return extractPriceFromHtml(text)
    }
  } catch {
    // 타임아웃 또는 네트워크 오류
  }
  return null
}

/**
 * 성원 상품 페이지 HTML을 직접 파싱하여 기본 가격을 추출합니다.
 */
async function fetchPagePrice(categoryCode: string, goodsCode: string): Promise<number | null> {
  try {
    const url = `${SWADPIA_BASE}/goods/goods_view/${categoryCode}/${goodsCode}`
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersPriceBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    return extractPriceFromHtml(html)
  } catch {
    return null
  }
}

// ─── 폴백 가격 (성원 조회 실패 시) ───────────────────────────
// 마지막 확인: 2026-04-18 (성원애드피아 기준 VAT 제외 가격 KRW)

const FALLBACK_PRICES: Record<string, number> = {
  'business-cards': 12_000,   // 명함 100매 기준
  'stickers': 10_000,          // 스티커 100매 기준
  'flyers': 18_000,            // 전단지 A4 1000매 기준
  'postcards': 15_000,         // 엽서 100매 기준
  'posters': 28_000,           // 포스터 A3 기준
}

// ─── 메인 스크래핑 함수 ──────────────────────────────────────

/**
 * 특정 상품의 성원애드피아 가격을 조회합니다.
 */
export async function fetchSwadpiaProductPrice(slug: string): Promise<SwadpiaProductResult> {
  const mappings = PRODUCT_MAPPINGS[slug]
  if (!mappings || mappings.length === 0) {
    return {
      slug,
      basePriceKrw: FALLBACK_PRICES[slug] ?? 10_000,
      optionPrices: [],
      sourceData: null,
      fetchSuccess: false,
      errorMessage: `상품 매핑 없음: ${slug}`,
    }
  }

  const optionPrices: SwadpiaOptionPrice[] = []
  const sourceData: Record<string, unknown> = {}
  let basePriceKrw: number | null = null
  let fetchSuccess = false
  let errorMessage: string | undefined

  for (const mapping of mappings) {
    const { categoryCode, goodsCode, optionKey } = mapping

    // 1단계: estimate API 시도
    for (const qty of QUANTITY_OPTIONS) {
      const price = await fetchEstimatePrice(categoryCode, goodsCode, qty)
      if (price && price > 0) {
        fetchSuccess = true
        const key = `qty:${qty},${optionKey}`
        optionPrices.push({ optionKey: key, priceKrw: price, goodsCode })
        sourceData[key] = { categoryCode, goodsCode, qty, price, method: 'estimate_api' }

        // 첫 번째 (최소 수량) 가격을 기본 단가로 사용
        if (basePriceKrw === null) {
          basePriceKrw = price
        }
      }
    }

    // 2단계: estimate API 실패 시 페이지 직접 파싱
    if (!fetchSuccess) {
      const pagePrice = await fetchPagePrice(categoryCode, goodsCode)
      if (pagePrice && pagePrice > 0) {
        fetchSuccess = true
        const key = `default,${optionKey}`
        optionPrices.push({ optionKey: key, priceKrw: pagePrice, goodsCode })
        sourceData[key] = { categoryCode, goodsCode, price: pagePrice, method: 'page_scrape' }
        if (basePriceKrw === null) {
          basePriceKrw = pagePrice
        }
      }
    }
  }

  // 3단계: 모두 실패 시 폴백 가격 사용
  if (basePriceKrw === null) {
    basePriceKrw = FALLBACK_PRICES[slug] ?? 10_000
    errorMessage = '성원애드피아 가격 조회 실패, 폴백 가격 사용'
    fetchSuccess = false
  }

  return {
    slug,
    basePriceKrw,
    optionPrices,
    sourceData: Object.keys(sourceData).length > 0 ? sourceData : null,
    fetchSuccess,
    errorMessage,
  }
}

/**
 * 모든 상품의 성원애드피아 가격을 병렬로 조회합니다.
 */
export async function fetchAllSwadpiaPrices(): Promise<SwadpiaProductResult[]> {
  const slugs = Object.keys(PRODUCT_MAPPINGS)
  const results = await Promise.allSettled(slugs.map(fetchSwadpiaProductPrice))

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value
    return {
      slug: slugs[i],
      basePriceKrw: FALLBACK_PRICES[slugs[i]] ?? 10_000,
      optionPrices: [],
      sourceData: null,
      fetchSuccess: false,
      errorMessage: result.reason?.message ?? '알 수 없는 오류',
    }
  })
}
