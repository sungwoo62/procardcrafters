/**
 * Swadpia pricing data integration
 *
 * Fetches paper/print cost/size data from the swadpia.co.kr JSON endpoint.
 *
 * Endpoint: POST /estimate/estimate_goods/json_data
 * Params: t (timestamp), product=name, category_code
 *
 * OMO-2646 (2026-06-08, 정정): 앞선 진단에서 "비인증 공개 엔드포인트 전면 폐지(404)"로
 * 잘못 결론 내려 SWADPIA_PUBLIC_ENDPOINT_LIVE=false 가드를 넣었으나, 라이브 재검증 결과
 * **엔드포인트는 정상 동작**한다(인증·세션·Referer 불필요, bare POST 도 HTTP 200 + 유효 JSON).
 * 예: POST /estimate/estimate_goods/json_data {t, product=name, category_code=CNC1000}
 *     → paper_info/print_info1/size_info 정상 반환. goods_view 페이지도 비로그인 200.
 * 따라서 가드를 제거하고 라이브 도매가 fetch 를 복원한다. (adpiamall 은 무관 — 무시)
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
  'premium-foil-cards': 'CNC3000',       // 카드명함(Luxury 화이트/실버/골드 200μ) — OMO-3097 라이브: 메탈·포일 스톡 실재, 유지
  'metallic-business-cards': 'CNC3000',  // 카드명함(Luxury 메탈릭)
  'letterpress-business-cards': 'CNC4000', // 하이브리드명함(아트지 백색 300g 단일) — OMO-3097 라이브: 활판 전용 격자 부재, 최근접 아트지300g 유지
  'transparent-business-cards': 'CNC5000', // 투명하이브리드명함(PET)
  'uv-business-cards': 'CNC6000',        // 디지털박/에폭시명함 — UV/특수후가공 명함 최적 카테고리, 유지
  // OMO-3097: pearl→CNC8000(이전)은 라이브에 실재하나(9종, 깨진 라우팅 아님) 펄지가 없음.
  // 펄 용지(다이니티 골드펄 250g)는 CNC2000 고급지명함에만 존재 → 펄 명함은 CNC2000 으로 라우팅.
  'pearl-business-cards': 'CNC2000',     // 고급지명함(다이니티 골드펄 250g 옵션) — OMO-3097 라이브검증
  // 스티커류
  'stickers': 'CST1000',
  'die-cut-stickers': 'CST2000',
  'transparent-stickers': 'CST1000',   // 재단형(투명데드롱 25 용지옵션) — OMO-3097 라이브검증
  'holographic-stickers': 'CST6000',   // 팬시롤(홀로그램/투명 Pet) — OMO-3095 라이브검증: CST6000 만 홀로그램 용지(STR050HN1) 보유. CST5000(스페셜)엔 홀로그램 없음(샤인실버/금은무광/저온유포/PVC뿐)
  'kraft-stickers': 'CST1000',         // 재단형(크라프트 57g 용지옵션) — OMO-3097 라이브검증
  'roll-stickers': 'CST7000',          // 팬시롤스티커
  'eco-stickers': 'CST1000',           // 재단형(모조지 80g 용지옵션) — OMO-3097 라이브검증
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
  // 우편·초대장·연하장
  'postcards': 'CDP3000',
  'invitation-cards': 'CVS1000',       // 초대장/상품권(일반) — OMO-3097 라이브검증(에폭시형은 CVS6000)
  'wedding-cards': 'CDP2000',          // 디지털청첩장/초대장(52종 용지) — OMO-3097 라이브검증
  'greeting-cards-general': 'CCM2000', // 디자인연하장 — OMO-3097 라이브검증
  // 메모·포스트잇
  'memo-pads-general': 'CNR3000',      // 떡메모지(매직칼라/모조지) — OMO-3097 라이브검증
  'sticky-notes': 'CPS7000',           // 사각포스트잇(모조지 80/100g) — OMO-3097 라이브검증
  // 디스플레이 — OMO-3097: 배너는 CPR5000(종이홀더) 오타 라우팅이었음. CRP(현수막) 코드가 정답(CPR≠CRP).
  'posters': 'CPR2000',
  'banners': 'CRP5100',                // 현수막(150denier) — OMO-3097 라이브검증(이전 CPR5000=종이홀더 오매핑)
  'x-banners': 'CRP4000',              // 배너(페트 210µ) — OMO-3097 라이브검증
  'rollup-banners': 'CRP4000',         // 배너(페트 210µ) — OMO-3097 라이브검증
  'mini-banners': 'COD1100',           // 종이미니배너 — OMO-3097 라이브검증
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
  // 패키징 — OMO-3097 라이브검증(판지/박스 CHI3000, 쇼핑백 CPK 계열)
  'general-boxes': 'CHI3000',          // 판지/박스(양면마닐라·메탈팩보드)
  'corrugated-boxes': 'CHI3000',
  'gift-boxes': 'CHI3000',
  'cake-boxes': 'CHI3000',
  'tube-boxes': 'CHI3000',
  'paper-shopping-bags': 'CPK4000',    // 일반쇼핑백
  'kraft-bags': 'CPK3000',             // 손잡이쇼핑백
  'gift-bags': 'CPK2000',              // 리본&브레이드 쇼핑백
  // 미연동(성원 미취급/타공급 또는 전용 격자 부재) — 의도적 미매핑, 리포트 SWADPIA_UNSUPPORTED 참조:
  //   hangtag-cards(택 전용격자 부재), paper-pop·foam-pop(POP 카테고리 부재),
  //   general-notebooks·spring-notebooks·diaries(대량 노트/다이어리 성원 미취급)
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

// ─── goods_view HTML 스크랩 (OMO-3148) ───────────────────────────
//
// 성원 json_data(견적 가격 매트릭스)에는 후가공(오시/박/형압…)·인쇄색상(양면/단면)이
// 들어있지 않다. 그 옵션들은 goods_view HTML 폼(chk_* 체크박스 + print_color_type
// select)에 있다. 맵핑 비교 패널의 "성원 스크랩" 측에 이 둘을 라이브로 긁어 표시해
// 우리 DB 옵션과 같은 성원 소스 기준으로 정직하게 비교하기 위함(보드 제보 OMO-3148).

const SWADPIA_FINISHING_LABEL: Record<string, string> = {
  osi: '오시', missing: '미싱', bak: '박', dbak: '디지털박', ap: '형압',
  numbering: '넘버링', domusong: '도무송', tagong: '타공', guidori: '귀도리',
  epoxy: '에폭시', coating: '코팅', partial_coating: '부분코팅', folding: '접지',
  cutting: '재단', binding: '제본', bonding: '무선제본', laminex: '라미넥스',
  guidori_position: '귀도리위치', tape: '양면테이프', window: '봉투창',
}

export interface SwadpiaGoodsViewOptions {
  fetchSuccess: boolean
  printColors: { code: string; label: string }[]
  finishings: { code: string; label: string }[]
  error?: string
}

/** category_code → goods_code ('G' + 가운데 코드 + '1', 예: CNC1000→GNC1001). */
function swadpiaGoodsCode(categoryCode: string): string {
  return 'G' + categoryCode.slice(1, -1) + '1'
}

/**
 * 성원 goods_view HTML을 긁어 인쇄색상(print_color_type select)과 후가공(swguide_postpress
 * 라벨 링크) 옵션을 추출한다. 카테고리별 노출 toggle은 클라이언트 JS(init)가 결정하므로
 * 폼 템플릿에 존재하는 후가공 집합을 그대로 보고한다(일부 카테고리는 런타임에 일부 숨김).
 */
export async function fetchSwadpiaGoodsViewOptions(
  categoryCode: string,
): Promise<SwadpiaGoodsViewOptions> {
  const empty: SwadpiaGoodsViewOptions = { fetchSuccess: false, printColors: [], finishings: [] }
  if (!categoryCode) return { ...empty, error: 'no category' }
  try {
    const url = `${SWADPIA_BASE}/goods/goods_view/${categoryCode}/${swadpiaGoodsCode(categoryCode)}`
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersMappingBot/1.0)' },
    })
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` }
    const html = await res.text()

    // 인쇄색상: <select name="print_color_type" ...> 안의 <option value="X">라벨</option>
    const printColors: { code: string; label: string }[] = []
    const selMatch = html.match(/<select[^>]*name=["']print_color_type["'][\s\S]*?<\/select>/i)
    if (selMatch) {
      const optRe = /<option[^>]*value=["']([^"']+)["'][^>]*>([^<]+)<\/option>/gi
      let m: RegExpExecArray | null
      while ((m = optRe.exec(selMatch[0]))) {
        const label = m[2].replace(/&nbsp;/g, ' ').trim()
        if (m[1] && label) printColors.push({ code: m[1], label })
      }
    }

    // 후가공: 폼의 후가공 라벨 링크 swguide_postpress('osi');">오시</a> 에서 추출한다.
    // (raw 서버 HTML은 모든 chk_* td가 display:none 이고 노출은 카테고리별 JS init이 결정
    //  → inline style로는 판별 불가. 폼 템플릿에 존재하는 후가공 옵션 집합을 그대로 보고.)
    const finishings: { code: string; label: string }[] = []
    const seen = new Set<string>()
    const ppRe = /swguide_postpress\(['"]([a-z_]+)['"]\);?\s*">([^<]+)<\/a>/gi
    let c: RegExpExecArray | null
    while ((c = ppRe.exec(html))) {
      const code = c[1]
      const label = c[2].replace(/&nbsp;/g, ' ').trim()
      if (!code || code.startsWith('is_') || seen.has(code)) continue
      seen.add(code)
      finishings.push({ code, label: label || SWADPIA_FINISHING_LABEL[code] || code })
    }

    return { fetchSuccess: true, printColors, finishings }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'fetch failed' }
  }
}
