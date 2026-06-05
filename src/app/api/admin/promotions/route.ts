import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

const TIER_CAP: Record<string, number> = {
  top: 20,
  standard: 15,
  always_on: 10,
  bestseller: 10,
}

const TIER_DEFAULT_PCT: Record<string, number> = {
  top: 15,
  standard: 10,
  always_on: 5,
  bestseller: 10,
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  const supabase = createServerClient()

  let query = supabase
    .from('print_promotion_campaigns')
    .select(`
      *,
      calendar:print_promotion_calendar(
        key, name_ko, name_en,
        default_discount_tier, default_lead_days,
        default_peak_days, default_cutoff_days,
        recurring_pattern
      ),
      products:print_promotion_products(
        product_slug, sort_order, custom_hero_url,
        product:print_products(name_ko, name_en, base_price_krw, margin_multiplier, thumbnail_url)
      ),
      promo_codes:print_promo_codes(
        id, code, discount_pct, discount_tier, status, valid_from, valid_until
      )
    `)
    .order('promo_start_at', { ascending: true, nullsFirst: false })

  if (statusFilter) {
    const statuses = statusFilter.split(',').map((s) => s.trim()).filter(Boolean)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type RawProduct = {
    product_slug: string
    sort_order: number
    custom_hero_url: string | null
    product: { name_ko: string; name_en: string; base_price_krw: number; margin_multiplier: number; thumbnail_url: string | null } | null
  }
  type RawCode = { id: string; code: string; discount_pct: number; discount_tier: string; status: string; valid_from: string; valid_until: string }
  type RawCampaign = {
    id: string; calendar_id: string; year: number; status: string
    promo_start_at: string | null; promo_end_at: string | null
    peak_start_at: string | null; order_cutoff_at: string | null
    headline_ko: string | null; headline_en: string | null; hero_image_url: string | null
    approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string
    calendar: { key: string; name_ko: string; name_en: string; default_discount_tier: string } | null
    products: RawProduct[]
    promo_codes: RawCode[]
  }

  const campaigns = ((data ?? []) as RawCampaign[]).map((c) => {
    const tier = c.calendar?.default_discount_tier ?? 'standard'
    const cap = TIER_CAP[tier] ?? 15

    const activeCodes = (c.promo_codes ?? []).filter((pc) => pc.status === 'active')
    const discountPct =
      activeCodes.length > 0
        ? Math.min(activeCodes[0].discount_pct, cap)
        : TIER_DEFAULT_PCT[tier] ?? 10

    const products = c.products ?? []
    const marginEstimates = products
      .map((pp) => {
        const p = pp.product
        if (!p || !p.base_price_krw || !p.margin_multiplier) return null
        const sellPrice = p.base_price_krw * p.margin_multiplier
        const effectiveSell = sellPrice * (1 - discountPct / 100)
        const marginKrw = effectiveSell - p.base_price_krw
        const marginPct = effectiveSell > 0 ? (marginKrw / effectiveSell) * 100 : 0
        return { slug: pp.product_slug, marginKrw, marginPct }
      })
      .filter(Boolean)

    const avgMarginPct =
      marginEstimates.length > 0
        ? marginEstimates.reduce((sum, m) => sum + (m?.marginPct ?? 0), 0) / marginEstimates.length
        : null

    return {
      ...c,
      discountPct,
      tierCap: cap,
      avgMarginPct,
      isLossMaking: avgMarginPct !== null && avgMarginPct < 0,
    }
  })

  return NextResponse.json({ campaigns })
}
