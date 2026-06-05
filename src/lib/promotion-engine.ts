import { createServerClient } from '@/lib/supabase'

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

  // ── 2. status 체크 ────────────────────────────────────────
  if (promoCode.status !== 'active') {
    return { valid: false, reason: '사용할 수 없는 코드입니다.' }
  }

  // ── 3. 유효 기간 ──────────────────────────────────────────
  const validFrom = new Date(promoCode.valid_from)
  const validUntil = new Date(promoCode.valid_until)
  if (now < validFrom || now > validUntil) {
    return { valid: false, reason: '코드 유효 기간이 아닙니다.' }
  }

  // ── 4. 최소 주문 금액 ─────────────────────────────────────
  if (cart.totalCents < promoCode.min_order_cents) {
    const minKrw = Math.round(promoCode.min_order_cents / 100)
    return { valid: false, reason: `최소 주문 금액 ${minKrw.toLocaleString()}원 이상이어야 합니다.` }
  }

  // ── 5. max_uses 체크 ──────────────────────────────────────
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

  // ── 6. per_user_max 체크 ──────────────────────────────────
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

  // ── 7. 저마진 라인 자동 제외 ──────────────────────────────
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

      // ── 8. bestseller cap ──────────────────────────────────
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

  // ── 9. 상품 목록 없는 경우 (카트 컨텍스트 없이 호출) ───────
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

  return {
    id: result.redemption_id!,
    code_id: codeId,
    order_id: orderId,
    user_id: userId ?? null,
    discount_amount_cents: discountAmountCents,
    applied_at: result.applied_at!,
  }
}
