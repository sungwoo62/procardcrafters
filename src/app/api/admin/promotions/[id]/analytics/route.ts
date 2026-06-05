import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

const FUNNEL_ORDER = [
  'promo_impression',
  'promo_click',
  'promo_code_view',
  'promo_add_to_cart',
  'promo_checkout_start',
  'promo_code_redeem',
]

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id: campaignId } = await params
  const supabase = createServerClient()

  // 캠페인 기본 정보
  const { data: campaign, error: campErr } = await supabase
    .from('print_promotion_campaigns')
    .select('id, year, status, promo_start_at, promo_end_at, calendar:print_promotion_calendar(name_ko, name_en, key)')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: '캠페인을 찾을 수 없습니다.' }, { status: 404 })
  }

  // funnel 이벤트 집계
  const { data: eventRows } = await supabase
    .from('print_promotion_events')
    .select('event_type')
    .eq('campaign_id', campaignId)

  const funnelCounts: Record<string, number> = {}
  for (const row of eventRows ?? []) {
    funnelCounts[row.event_type] = (funnelCounts[row.event_type] ?? 0) + 1
  }

  const funnel = FUNNEL_ORDER.map((type) => ({
    type,
    count: funnelCounts[type] ?? 0,
  }))

  // unique visitors (impression 기준)
  const { data: uvRows } = await supabase
    .from('print_promotion_events')
    .select('user_id, session_id')
    .eq('campaign_id', campaignId)
    .eq('event_type', 'promo_impression')

  const uvSet = new Set<string>()
  for (const r of uvRows ?? []) {
    uvSet.add(r.user_id ?? r.session_id ?? '')
  }
  const uniqueVisitors = uvSet.size

  // 시간대별 redemption (최근 30일 또는 캠페인 기간)
  const { data: redeemRows } = await supabase
    .from('print_promotion_events')
    .select('created_at')
    .eq('campaign_id', campaignId)
    .eq('event_type', 'promo_code_redeem')
    .order('created_at', { ascending: true })

  // 6시간 단위 버킷으로 집계
  const redemptionTimeline: Record<string, number> = {}
  for (const r of redeemRows ?? []) {
    const d = new Date(r.created_at)
    const h = Math.floor(d.getUTCHours() / 6) * 6
    const bucket = `${d.toISOString().slice(0, 10)}T${String(h).padStart(2, '0')}:00`
    redemptionTimeline[bucket] = (redemptionTimeline[bucket] ?? 0) + 1
  }

  const timeline = Object.entries(redemptionTimeline)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time.localeCompare(b.time))

  // top product (add_to_cart 기준)
  const { data: atcRows } = await supabase
    .from('print_promotion_events')
    .select('product_slug')
    .eq('campaign_id', campaignId)
    .eq('event_type', 'promo_add_to_cart')
    .not('product_slug', 'is', null)

  const slugCounts: Record<string, number> = {}
  for (const r of atcRows ?? []) {
    if (r.product_slug) slugCounts[r.product_slug] = (slugCounts[r.product_slug] ?? 0) + 1
  }
  const topProduct =
    Object.entries(slugCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // revenue impact (redemptions → orders)
  const { data: codeRows } = await supabase
    .from('print_promo_codes')
    .select('id')
    .eq('campaign_id', campaignId)

  const codeIds = (codeRows ?? []).map((c) => c.id)

  let revenueData = {
    total_discount_usd: 0,
    total_revenue_usd: 0,
    order_count: 0,
    aov_usd: 0,
    aov_baseline_usd: 0,
  }

  if (codeIds.length > 0) {
    const { data: redemptions } = await supabase
      .from('print_promo_code_redemptions')
      .select('order_id, discount_amount_cents')
      .in('code_id', codeIds)

    const orderIds = [...new Set((redemptions ?? []).map((r) => r.order_id).filter(Boolean))]

    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('print_orders')
        .select('total_usd, promo_discount_usd')
        .in('id', orderIds)

      const totalRevenue = (orders ?? []).reduce((s, o) => s + Number(o.total_usd), 0)
      const totalDiscount = (orders ?? []).reduce((s, o) => s + Number(o.promo_discount_usd), 0)
      const orderCount = orders?.length ?? 0

      // baseline AOV: 전체 주문 AOV (last 90d)
      const { data: baselineOrders } = await supabase
        .from('print_orders')
        .select('total_usd')
        .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
        .limit(500)

      const baselineAov =
        baselineOrders && baselineOrders.length > 0
          ? baselineOrders.reduce((s, o) => s + Number(o.total_usd), 0) / baselineOrders.length
          : 0

      revenueData = {
        total_discount_usd: Math.round(totalDiscount * 100) / 100,
        total_revenue_usd: Math.round(totalRevenue * 100) / 100,
        order_count: orderCount,
        aov_usd: orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0,
        aov_baseline_usd: Math.round(baselineAov * 100) / 100,
      }
    }
  }

  // redemption rate = redeem / unique_visitors
  const impressionCount = funnelCounts['promo_impression'] ?? 0
  const redeemCount = funnelCounts['promo_code_redeem'] ?? 0
  const redemptionRate =
    uniqueVisitors > 0 ? Math.round((redeemCount / uniqueVisitors) * 10000) / 100 : 0
  const TARGET_REDEMPTION_RATE = 0.5

  return NextResponse.json({
    campaign,
    funnel,
    unique_visitors: uniqueVisitors,
    timeline,
    top_product: topProduct,
    revenue: revenueData,
    redemption_rate: redemptionRate,
    target_redemption_rate: TARGET_REDEMPTION_RATE,
  })
}
