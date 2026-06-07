// OMO-2587/2597 마케팅 성과 집계 — DB I/O(service_role 클라이언트로 RLS 우회).
// 채널 귀속(attribution) + 광고비(print_ad_spend)를 합쳐 채널별 매출/ROAS/CPA/CVR을
// 산출한다. 임의 기간[start,end) 윈도우로 집계하므로 성과 API(기간=days)와
// 주간 리뷰 cron(전주 대비) 양쪽이 동일 로직을 공유한다 — 추측성 수치 금지.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AD_SPEND_CHANNEL_MAP,
  CHANNEL_LABELS_KO,
  deriveChannel,
  type MarketingChannel,
} from '@/lib/attribution'
import { buildReviewFromWindows, type WeeklyReview } from './review'

type DB = SupabaseClient

// 매출 인식에서 제외하는 주문 상태.
const EXCLUDED_STATUSES = ['cancelled', 'refunded']

export interface ChannelAgg {
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

export interface PerformanceKpi {
  revenue_usd: number
  orders: number
  aov_usd: number
  ad_spend_usd: number
  blended_roas: number | null
  blended_cpa_usd: number | null
  paid_clicks: number
  paid_cvr_pct: number | null
  attributed_orders: number
}

export interface PerformanceWindow {
  since: string // ISO start (inclusive)
  until: string // ISO end (exclusive)
  kpi: PerformanceKpi
  channels: ChannelAgg[]
  notes: string[]
}

// ── 주(week) 경계 유틸: 월요일 00:00 UTC 기준 ───────────────────
export function weekStart(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = out.getUTCDay() // 0=일 .. 1=월
  const diff = (dow + 6) % 7 // 월요일까지 거슬러 올라갈 일수
  out.setUTCDate(out.getUTCDate() - diff)
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + n)
  return out
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 기간 [start, end) 의 채널별 성과를 집계한다.
 * 주문 매출은 created_at, 광고비는 spend_date(DATE) 기준으로 윈도우를 자른다.
 * 데이터가 없는 지표(광고비 미적재 등)는 0/null + notes 로 정직히 반환한다.
 */
export async function aggregatePerformance(
  db: DB,
  start: Date,
  end: Date,
): Promise<PerformanceWindow> {
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const startDate = startIso.slice(0, 10)
  const endDate = endIso.slice(0, 10)
  const notes: string[] = []

  // ① 주문(취소/환불 제외) — 채널 귀속 + 매출.
  const { data: orders, error: ordersErr } = await db
    .from('print_orders')
    .select('total_usd, status, utm_source, utm_medium, gclid, fbclid, referrer_host')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
  if (ordersErr) throw new Error(`주문 집계 실패: ${ordersErr.message}`)

  const channels: Partial<Record<MarketingChannel, ChannelAgg>> = {}
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
    return channels[ch]!
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
      '모든 주문이 직접/미식별로 집계됨 — 체크아웃 UTM 캡처 wiring 적용 전까지 채널 기여는 표시되지 않습니다.',
    )
  }

  // ② 광고비 — 채널별 spend/clicks/impressions.
  const { data: spendRows, error: spendErr } = await db
    .from('print_ad_spend')
    .select('channel, spend_usd, clicks, impressions')
    .gte('spend_date', startDate)
    .lt('spend_date', endDate)
  if (spendErr) throw new Error(`광고비 집계 실패: ${spendErr.message}`)

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
    notes.push('광고비 데이터 없음 — print_ad_spend 적재 전까지 ROAS/CPA는 계산 불가.')
  }

  // ③ 채널별 파생 지표.
  const channelList = Object.values(channels).map((c) => {
    c.aov_usd = c.orders > 0 ? r2(c.revenue_usd / c.orders) : 0
    c.roas = c.spend_usd > 0 ? r2(c.revenue_usd / c.spend_usd) : null
    c.cpa_usd = c.spend_usd > 0 && c.orders > 0 ? r2(c.spend_usd / c.orders) : null
    c.revenue_usd = r2(c.revenue_usd)
    c.spend_usd = r2(c.spend_usd)
    return c
  })
  channelList.sort((a, b) => b.revenue_usd - a.revenue_usd)

  // ④ 종합 KPI.
  const paidCvr = totalClicks > 0 ? r2((totalOrders / totalClicks) * 100) : null
  notes.push(
    '전체 사이트 CVR(주문/세션)은 GA4 세션 데이터가 DB에 없어 표시 불가 — 광고 클릭 기준 CVR(주문/클릭)만 제공.',
  )

  return {
    since: startIso,
    until: endIso,
    kpi: {
      revenue_usd: r2(totalRevenue),
      orders: totalOrders,
      aov_usd: totalOrders > 0 ? r2(totalRevenue / totalOrders) : 0,
      ad_spend_usd: r2(totalSpend),
      blended_roas: totalSpend > 0 ? r2(totalRevenue / totalSpend) : null,
      blended_cpa_usd: totalSpend > 0 && totalOrders > 0 ? r2(totalSpend / totalOrders) : null,
      paid_clicks: totalClicks,
      paid_cvr_pct: paidCvr,
      attributed_orders: attributedOrders,
    },
    channels: channelList,
    notes,
  }
}

/**
 * 기준일이 속한 주(금주)와 직전 주를 비교해 주간 리뷰를 만든다.
 * anchor 미지정 시 호출부에서 "직전 완료 주"를 넘기는 것을 권장(어제 기준).
 */
export async function buildWeeklyReview(db: DB, anchor: Date): Promise<WeeklyReview> {
  const curStart = weekStart(anchor)
  const curEnd = addDays(curStart, 7)
  const prevStart = addDays(curStart, -7)

  const [current, previous] = await Promise.all([
    aggregatePerformance(db, curStart, curEnd),
    aggregatePerformance(db, prevStart, curStart),
  ])
  return buildReviewFromWindows(current, previous)
}

// 생성된 리뷰를 print_marketing_reviews에 upsert(같은 주 1건 유지).
export async function persistReview(db: DB, review: WeeklyReview): Promise<void> {
  const { error } = await db.from('print_marketing_reviews').upsert(
    {
      period_start: review.periodStart,
      period_end: review.periodEnd,
      metrics: {
        current: review.current,
        previous: review.previous,
        deltas: review.deltas,
      },
      suggestions: review.suggestions,
      data_gaps: review.dataGaps,
      summary_md: review.summaryMd,
    },
    { onConflict: 'period_start' },
  )
  if (error) throw new Error(`주간 마케팅 리뷰 저장 실패: ${error.message}`)
}
