import { createServerClient } from '@/lib/supabase'
import {
  checkAbuseCircuit,
  checkPostRedemptionLock,
  alertNegativeMargin,
} from '@/lib/promo-circuit-breaker'

// ============================================================
// 타입 정의
// ============================================================

export interface Campaign {
  id: string
  calendar_id: string
  year: number
  status: string
  promo_start_at: string | null
  promo_end_at: string | null
  peak_start_at: string | null
  order_cutoff_at: string | null
  headline_ko: string | null
  headline_en: string | null
  hero_image_url: string | null
  calendar: {
    key: string
    name_ko: string
    name_en: string
    default_discount_tier: string
  }
  products: Array<{
    product_slug: string
    sort_order: number
    custom_hero_url: string | null
  }>
}

export interface PromoCode {
  id: string
  campaign_id: string | null
  code: string
  discount_pct: number
  discount_tier: 'top' | 'standard' | 'always_on' | 'bestseller'
  min_order_cents: number
  max_discount_cents: number | null
  valid_from: string
  valid_until: string
  max_uses: number | null
  per_user_max: number
  status: string
}

export interface CartContext {
  userId?: string
  totalCents: number
  productSlugs?: string[]
  ip?: string
}

export interface ValidateResult {
  valid: boolean
  code?: PromoCode
  discountAmount?: number  // cents
  effectivePct?: number    // 실제 적용된 할인율 (cap 후)
  reason?: string
}

export interface Redemption {
  id: string
  code_id: string
  order_id: string
  user_id: string | null
  discount_amount_cents: number
  applied_at: string
}

// ============================================================
// Tier cap 상수
// ============================================================

const TIER_CAP: Record<string, number> = {
  top: 20,
  standard: 15,
  always_on: 10,
  bestseller: 10,
}

const BF_PEAK_DAY1_CAP = 25  // BF 첫째날만 25% 허용
const LOW_MARGIN_THRESHOLD = 25  // margin_pct < 25%이면 프로모 제외

// ============================================================
// 내부 헬퍼
// ============================================================

/** BF 피크 첫 번째 날인지 확인 (peak_start_at ~ +24h) */
function isBfPeakDay1(campaign: { peak_start_at: string | null } | null): boolean {
  if (!campaign?.peak_start_at) return false
  const peakStart = new Date(campaign.peak_start_at)
  const peakDay1End = new Date(peakStart.getTime() + 24 * 60 * 60 * 1000)
  const now = new Date()
  return now >= peakStart && now < peakDay1End
}

/** tier + BF 여부를 고려한 cap 계산 */
async function resolveCapPct(
  code: PromoCode,
  hasAnyBestseller: boolean,
  supabase: ReturnType<typeof createServerClient>,
): Promise<number> {
  // bestseller 상품이 카트에 있으면 최대 10% (tier 무관)
  if (hasAnyBestseller) return TIER_CAP.bestseller

  if (code.discount_tier === 'top' && code.campaign_id) {
    // BF 캠페인 + 피크 첫째날 → 25%
    const { data: campaign } = await supabase
      .from('print_promotion_campaigns')
      .select('peak_start_at, calendar:print_promotion_calendar(key)')
      .eq('id', code.campaign_id)
      .single()

    const calendarKey = (campaign as unknown as { calendar?: { key?: string } | null })?.calendar?.key
    if (calendarKey === 'black_friday' && isBfPeakDay1(campaign)) {
      return BF_PEAK_DAY1_CAP
    }
  }

  return TIER_CAP[code.discount_tier] ?? TIER_CAP.standard
}

/** 할인 금액 계산 (cents) — cap 적용 후 */
function computeDiscountCents(
  totalCents: number,
  pct: number,
  maxDiscountCents: number | null,
): { discountCents: number; effectivePct: number } {
  let discountCents = Math.floor((totalCents * pct) / 100)
  if (maxDiscountCents !== null && discountCents > maxDiscountCents) {
    discountCents = maxDiscountCents
  }
  const effectivePct = totalCents > 0 ? (discountCents / totalCents) * 100 : 0
  return { discountCents, effectivePct }
}

// ============================================================
// 공개 API
// ============================================================

/**
 * status=live이고 promo_start ≤ now ≤ promo_end인 캠페인 + products 반환
 */
export async function getActiveCampaigns(date?: Date): Promise<Campaign[]> {
  const supabase = createServerClient()
  const now = (date ?? new Date()).toISOString()

  const { data, error } = await supabase
    .from('print_promotion_campaigns')
    .select(`
      *,
      calendar:print_promotion_calendar(key, name_ko, name_en, default_discount_tier),
      products:print_promotion_products(product_slug, sort_order, custom_hero_url)
    `)
    .eq('status', 'live')
    .lte('promo_start_at', now)
    .gte('promo_end_at', now)
    .order('promo_start_at', { ascending: true })

  if (error) throw new Error(`getActiveCampaigns: ${error.message}`)
  return (data ?? []) as Campaign[]
}

/**
 * 프로모 코드 검증.
 * - 코드 유효성 (status, 기간, max_uses, per_user_max, min_order_cents)
 * - tier-cap 강제 (bestseller 상품 포함 여부, BF 피크 1일차 여부)
 * - 저마진 라인 자동 제외
 * - max_discount_cents 상한 적용
 */
export async function validateCode(
  code: string,
  cart: CartContext,
): Promise<ValidateResult> {
  const supabase = createServerClient()
  const now = new Date()

  // ── 1. 코드 조회 ──────────────────────────────────────────
  const { data: row, error: codeErr } = await supabase
    .from('print_promo_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .single()

  if (codeErr || !row) {
    return { valid: false, reason: '존재하지 않는 코드입니다.' }
  }

  const promoCode = row as PromoCode

  // ── 2. abuse circuit breaker ──────────────────────────────
  const abuseCheck = await checkAbuseCircuit(promoCode.id, cart.ip, cart.userId)
  if (abuseCheck.blocked) {
    return { valid: false, reason: abuseCheck.reason }
  }

  // ── 3. status 체크 ────────────────────────────────────────
  if (promoCode.status !== 'active') {
    return { valid: false, reason: '사용할 수 없는 코드입니다.' }
  }

  // ── 4. 유효 기간 ──────────────────────────────────────────
  const validFrom = new Date(promoCode.valid_from)
  const validUntil = new Date(promoCode.valid_until)
  if (now < validFrom || now > validUntil) {
    return { valid: false, reason: '코드 유효 기간이 아닙니다.' }
  }

  // ── 5. 최소 주문 금액 ─────────────────────────────────────
  if (cart.totalCents < promoCode.min_order_cents) {
    const minKrw = Math.round(promoCode.min_order_cents / 100)
    return { valid: false, reason: `최소 주문 금액 ${minKrw.toLocaleString()}원 이상이어야 합니다.` }
  }

  // ── 6. max_uses 체크 ──────────────────────────────────────
  if (promoCode.max_uses !== null) {
    const { count: usedCount, error: cntErr } = await supabase
      .from('print_promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', promoCode.id)

    if (cntErr) throw new Error(`max_uses 조회 실패: ${cntErr.message}`)
    if ((usedCount ?? 0) >= promoCode.max_uses) {
      return { valid: false, reason: '코드 사용 한도를 초과했습니다.' }
    }
  }

  // ── 7. per_user_max 체크 ──────────────────────────────────
  if (cart.userId) {
    const { count: userCount, error: uErr } = await supabase
      .from('print_promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', promoCode.id)
      .eq('user_id', cart.userId)

    if (uErr) throw new Error(`per_user_max 조회 실패: ${uErr.message}`)
    if ((userCount ?? 0) >= promoCode.per_user_max) {
      return { valid: false, reason: '이 코드는 이미 사용하셨습니다.' }
    }
  }

  // ── 8. 저마진 라인 자동 제외 ──────────────────────────────
  //    카트의 모든 상품이 margin_pct < 25%이면 적용 불가
  if (cart.productSlugs?.length) {
    const { data: products } = await supabase
      .from('print_products')
      .select('slug, margin_pct, is_bestseller')
      .in('slug', cart.productSlugs)

    if (products?.length) {
      const eligibleProducts = products.filter(
        (p) => p.margin_pct === null || Number(p.margin_pct) >= LOW_MARGIN_THRESHOLD,
      )
      if (eligibleProducts.length === 0) {
        return { valid: false, reason: '이 코드는 해당 상품에 적용할 수 없습니다.' }
      }

      // ── 9. bestseller cap ──────────────────────────────────
      const hasAnyBestseller = products.some((p) => p.is_bestseller === true)
      const capPct = await resolveCapPct(promoCode, hasAnyBestseller, supabase)
      const appliedPct = Math.min(promoCode.discount_pct, capPct)

      const { discountCents, effectivePct } = computeDiscountCents(
        cart.totalCents,
        appliedPct,
        promoCode.max_discount_cents,
      )

      return {
        valid: true,
        code: promoCode,
        discountAmount: discountCents,
        effectivePct,
      }
    }
  }

  // ── 10. 상품 목록 없는 경우 (카트 컨텍스트 없이 호출) ──────
  const capPct = await resolveCapPct(promoCode, false, supabase)
  const appliedPct = Math.min(promoCode.discount_pct, capPct)
  const { discountCents, effectivePct } = computeDiscountCents(
    cart.totalCents,
    appliedPct,
    promoCode.max_discount_cents,
  )

  return {
    valid: true,
    code: promoCode,
    discountAmount: discountCents,
    effectivePct,
  }
}

/**
 * 프로모 코드 적용 — 원자적 DB 함수 호출로 race condition 방지.
 * validateCode 후 신뢰할 수 있는 discountAmount를 넘겨야 함.
 */
export async function applyCode(
  orderId: string,
  codeId: string,
  discountAmountCents: number,
  userId?: string,
): Promise<Redemption> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('print_redeem_promo_code', {
    p_code_id: codeId,
    p_order_id: orderId,
    p_user_id: userId ?? null,
    p_discount_amount_cents: discountAmountCents,
  })

  if (error) throw new Error(`applyCode RPC 실패: ${error.message}`)

  const result = data as { ok: boolean; reason?: string; redemption_id?: string; applied_at?: string }

  if (!result.ok) {
    throw new Error(`프로모 코드 적용 실패: ${result.reason}`)
  }

  const redemption: Redemption = {
    id: result.redemption_id!,
    code_id: codeId,
    order_id: orderId,
    user_id: userId ?? null,
    discount_amount_cents: discountAmountCents,
    applied_at: result.applied_at!,
  }

  // ── 사후 처리 (비차단: 실패해도 주문 진행) ─────────────────
  void Promise.allSettled([
    // 1h 누적 후 임계 초과 시 자동 lock
    checkPostRedemptionLock(codeId),
    // margin 음수 체크 및 알림
    checkMarginAndAlert(orderId, codeId, discountAmountCents),
  ])

  return redemption
}

// ============================================================
// 캠페인 우선순위 (홈 hero 선택용)
// BF > Christmas > Valentine(top) > 기타 시즌 > wedding(always_on)
// ============================================================

export function getCampaignPriority(calendarKey: string): number {
  if (calendarKey === 'black_friday') return 100
  if (calendarKey === 'christmas_new_year') return 90
  if (calendarKey === 'valentine') return 80
  if (['graduation', 'halloween', 'back_to_school'].includes(calendarKey)) return 60
  if (calendarKey === 'wedding_boost') return 10
  return 50
}

// ============================================================
// 단일 캠페인 조회 (LP 페이지용)
// ============================================================

export interface CampaignDetail extends Campaign {
  promoCode: PromoCode | null
  productDetails: Array<{
    slug: string
    name_en: string
    hero_image_url: string | null
    description_en: string | null
    sort_order: number
  }>
}

/**
 * calendar.key = slug인 라이브 캠페인 + 프로모 코드 + 상품 상세 반환.
 * 없으면 null.
 */
export async function getCampaignBySlug(slug: string): Promise<CampaignDetail | null> {
  const supabase = createServerClient()
  const now = new Date().toISOString()

  const { data: calendar } = await supabase
    .from('print_promotion_calendar')
    .select('id')
    .eq('key', slug)
    .single()

  if (!calendar) return null

  const { data: campaignData } = await supabase
    .from('print_promotion_campaigns')
    .select(`
      *,
      calendar:print_promotion_calendar(key, name_ko, name_en, default_discount_tier),
      products:print_promotion_products(product_slug, sort_order, custom_hero_url)
    `)
    .eq('calendar_id', calendar.id)
    .eq('status', 'live')
    .lte('promo_start_at', now)
    .gte('promo_end_at', now)
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!campaignData) return null
  const campaign = campaignData as Campaign

  const productSlugs = campaign.products.map(p => p.product_slug)

  const { data: codeData } = await supabase
    .from('print_promo_codes')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'active')
    .lte('valid_from', now)
    .gte('valid_until', now)
    .order('discount_pct', { ascending: false })
    .limit(1)
    .single()

  type ProductRow = { slug: string; name_en: string; hero_image_url: string | null; description_en: string | null }
  let imageRows: ProductRow[] = []
  if (productSlugs.length > 0) {
    const { data } = await supabase
      .from('print_products')
      .select('slug, name_en, hero_image_url, description_en')
      .in('slug', productSlugs)
      .eq('is_active', true)
    imageRows = (data ?? []) as ProductRow[]
  }

  const imageMap: Record<string, ProductRow> = {}
  for (const p of imageRows) {
    imageMap[p.slug] = p
  }

  const productDetails = campaign.products
    .map(p => ({
      slug: p.product_slug,
      name_en: imageMap[p.product_slug]?.name_en ?? p.product_slug,
      hero_image_url: imageMap[p.product_slug]?.hero_image_url ?? null,
      description_en: imageMap[p.product_slug]?.description_en ?? null,
      sort_order: p.sort_order,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    ...campaign,
    promoCode: codeData ? (codeData as PromoCode) : null,
    productDetails,
  }
}

/**
 * 캠페인의 최고 할인율 활성 코드 반환 (홈 hero용).
 */
export async function getTopPromoCode(campaignId: string): Promise<PromoCode | null> {
  const supabase = createServerClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('print_promo_codes')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'active')
    .lte('valid_from', now)
    .gte('valid_until', now)
    .order('discount_pct', { ascending: false })
    .limit(1)
    .single()
  return data ? (data as PromoCode) : null
}

/**
 * 주문 데이터에서 margin 계산 후 음수면 알림.
 * margin = subtotal - factory_cost - shipping - transaction_fee - promo_discount
 */
async function checkMarginAndAlert(
  orderId: string,
  codeId: string,
  discountAmountCents: number,
): Promise<void> {
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from('print_orders')
    .select('subtotal_usd, shipping_usd, exchange_rate_krw_usd')
    .eq('id', orderId)
    .single()

  if (!order) return

  const { data: items } = await supabase
    .from('print_order_items')
    .select('quantity, product:print_products(base_price_krw)')
    .eq('order_id', orderId)

  const exchangeRate = Number(order.exchange_rate_krw_usd ?? 1300)
  const subtotalUsd = Number(order.subtotal_usd)
  const shippingUsd = Number(order.shipping_usd)
  const promoDiscountUsd = discountAmountCents / 100

  // factory cost: 원가 합산 (KRW → USD)
  const factoryCostUsd = (items ?? []).reduce((sum, item) => {
    const basePriceKrw = Number(
      (item.product as { base_price_krw?: number } | null)?.base_price_krw ?? 0,
    )
    return sum + (basePriceKrw * item.quantity) / exchangeRate
  }, 0)

  const transactionFeeUsd = subtotalUsd * 0.03  // Stripe/PayPal ~3%

  const marginUsd =
    subtotalUsd - promoDiscountUsd - factoryCostUsd - shippingUsd - transactionFeeUsd

  if (marginUsd < 0) {
    await alertNegativeMargin(codeId, orderId, marginUsd, subtotalUsd)
  }
}
