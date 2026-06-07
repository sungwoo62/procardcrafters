import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import {
  deriveChannel,
  AD_SPEND_CHANNEL_MAP,
  CHANNEL_LABELS_KO,
  type MarketingChannel,
} from '@/lib/attribution'

// 마케팅 성과측정 API (OMO-2587 · 북극성 축3)
// CVR / 매출 / ROAS / CPA / 채널별 매출 기여를 실데이터로 집계한다.
// 데이터가 아직 없는 지표(예: 광고비 미적재)는 0/null 로 정직하게 반환하고
// notes 로 가용성 한계를 명시한다 — 추측성 수치 금지.

const EXCLUDED_STATUSES = ['cancelled', 'refunded']

type ChannelAgg = {
  channel: MarketingChannel
  label: string
  orders: number
  revenue_usd: number
  aov_usd: number
  spend_usd: number
  clicks: number
  impressions: number
  roas: number | null // 매출 / 광고비 (광고비 0이면 null)
  cpa_usd: number | null // 광고비 / 주문수 (광고비 0이면 null)
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const daysParam = Number(request.nextUrl.searchParams.get('days') ?? '30')
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 30

  const since = new Date(Date.now() - days * 86400000)
  const sinceIso = since.toISOString()
  const sinceDate = sinceIso.slice(0, 10)

  const supabase = createServerClient()
  const notes: string[] = []

  // ── 1) 기간 내 주문(취소/환불 제외) — 채널 귀속 + 매출 ─────────────
  const { data: orders, error: ordersErr } = await supabase
    .from('print_orders')
    .select(
      'total_usd, status, created_at, utm_source, utm_medium, gclid, fbclid, referrer_host',
    )
    .gte('created_at', sinceIso)
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)

  if (ordersErr) {
    return NextResponse.json({ error: ordersErr.message }, { status: 500 })
  }

  const channels: Record<string, ChannelAgg> = {}
  const ensure = (ch: MarketingChannel): ChannelAgg => {
    if (!channels[ch]) {
      channels[ch] = {
        channel: ch,
        label: CHANNEL_LABELS_KO[ch],
        orders: 0,
        revenue_usd: 0,
        aov_usd: 0,
        spend_usd: 0,
        clicks: 0,
        impressions: 0,
        roas: null,
        cpa_usd: null,
      }
    }
    return channels[ch]
  }

  let totalRevenue = 0
  let totalOrders = 0
  let attributedOrders = 0
  for (const o of orders ?? []) {
    const ch = deriveChannel(o)
    const agg = ensure(ch)
    const rev = Number(o.total_usd ?? 0)
    agg.orders += 1
    agg.revenue_usd += rev
    totalRevenue += rev
    totalOrders += 1
    if (ch !== 'direct') attributedOrders += 1
  }

  if (totalOrders > 0 && attributedOrders === 0) {
    notes.push(
      '모든 주문이 직접/미식별로 집계됨 — 체크아웃 UTM 캡처 wiring(후속 이슈) 적용 전까지 채널 기여는 표시되지 않습니다.',
    )
  }

  // ── 2) 기간 내 광고비 — 채널별 spend/clicks/impressions ────────────
  const { data: spendRows, error: spendErr } = await supabase
    .from('print_ad_spend')
    .select('channel, spend_usd, clicks, impressions, conversions')
    .gte('spend_date', sinceDate)

  if (spendErr) {
    return NextResponse.json({ error: spendErr.message }, { status: 500 })
  }

  let totalSpend = 0
  let totalClicks = 0
  for (const s of spendRows ?? []) {
    const ch = AD_SPEND_CHANNEL_MAP[s.channel] ?? 'paid_search'
    const agg = ensure(ch)
    agg.spend_usd += Number(s.spend_usd ?? 0)
    agg.clicks += Number(s.clicks ?? 0)
    agg.impressions += Number(s.impressions ?? 0)
    totalSpend += Number(s.spend_usd ?? 0)
    totalClicks += Number(s.clicks ?? 0)
  }

  if ((spendRows ?? []).length === 0) {
    notes.push(
      '광고비 데이터 없음 — print_ad_spend 적재(Google Ads/Meta 일배치, 후속 이슈) 전까지 ROAS/CPA는 계산 불가.',
    )
  }

  // ── 3) 채널별 파생 지표 + 라운딩 ──────────────────────────────────
  const r2 = (n: number) => Math.round(n * 100) / 100
  const channelList = Object.values(channels).map((c) => {
    c.aov_usd = c.orders > 0 ? r2(c.revenue_usd / c.orders) : 0
    c.roas = c.spend_usd > 0 ? r2(c.revenue_usd / c.spend_usd) : null
    c.cpa_usd = c.spend_usd > 0 && c.orders > 0 ? r2(c.spend_usd / c.orders) : null
    c.revenue_usd = r2(c.revenue_usd)
    c.spend_usd = r2(c.spend_usd)
    return c
  })
  channelList.sort((a, b) => b.revenue_usd - a.revenue_usd)

  // ── 4) 종합 KPI ──────────────────────────────────────────────────
  const blendedRoas = totalSpend > 0 ? r2(totalRevenue / totalSpend) : null
  const blendedCpa = totalSpend > 0 && totalOrders > 0 ? r2(totalSpend / totalOrders) : null
  // 유료 클릭 기준 CVR(전체 세션 CVR은 GA4 필요 — DB에 세션 없음)
  const paidCvr = totalClicks > 0 ? r2((totalOrders / totalClicks) * 100) : null
  notes.push(
    '전체 사이트 CVR(주문/세션)은 GA4 세션 데이터가 DB에 없어 표시 불가 — 광고 클릭 기준 CVR(주문/클릭)만 제공.',
  )

  return NextResponse.json({
    range: { days, since: sinceDate },
    kpi: {
      revenue_usd: r2(totalRevenue),
      orders: totalOrders,
      aov_usd: totalOrders > 0 ? r2(totalRevenue / totalOrders) : 0,
      ad_spend_usd: r2(totalSpend),
      blended_roas: blendedRoas,
      blended_cpa_usd: blendedCpa,
      paid_clicks: totalClicks,
      paid_cvr_pct: paidCvr,
      attributed_orders: attributedOrders,
    },
    channels: channelList,
    notes,
  })
}
