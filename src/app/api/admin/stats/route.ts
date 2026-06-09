import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'


// OMO-2733: 대시보드 성능 개선.
// 이전 구현은 주간 8회 + 월간 6회 + 오늘/이달 2회 = 16회의 순차 쿼리를 루프로 돌렸다.
// 모든 매출 집계는 동일한 print_orders(취소/환불 제외) 행에서 파생되므로,
// 가장 넓은 윈도(최근 6개월)를 한 번에 가져와 메모리에서 버킷팅한다.
// 상품 집계와 상태 분포는 전체기간이라 별도 쿼리이지만 Promise.all로 병렬화한다.
// 결과적으로 16회 순차 → 3회 병렬 쿼리.
export async function GET(_request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const supabase = createServerClient()
  const now = new Date()

  // Start of today (UTC)
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Widest window we need: earliest of (6개월 전 1일) and (8주 전 주 시작).
  const earliestMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const earliestWeekEnd = new Date(now)
  earliestWeekEnd.setDate(now.getDate() - 7 * 7)
  earliestWeekEnd.setUTCHours(23, 59, 59, 999)
  const earliestWeekStart = new Date(earliestWeekEnd)
  earliestWeekStart.setDate(earliestWeekEnd.getDate() - 6)
  earliestWeekStart.setUTCHours(0, 0, 0, 0)
  const windowStart = new Date(
    Math.min(earliestMonthStart.getTime(), earliestWeekStart.getTime())
  )

  // 3 parallel queries instead of 16 sequential.
  const [windowRes, itemsRes, allOrdersRes] = await Promise.all([
    supabase
      .from('print_orders')
      .select('total_usd, status, created_at')
      .gte('created_at', windowStart.toISOString())
      .not('status', 'in', '("cancelled","refunded")'),
    supabase
      .from('print_order_items')
      .select('product_slug, product_name_en, unit_price_usd, quantity'),
    supabase.from('print_orders').select('status'),
  ])

  const windowOrders = windowRes.data ?? []

  // 메모리 버킷 헬퍼. created_at(ISO) 기준 [startMs, endMs] 포함 집계.
  function bucket(startMs: number, endMs: number) {
    let revenue = 0
    let orders = 0
    for (const o of windowOrders) {
      const t = new Date(o.created_at).getTime()
      if (t >= startMs && t <= endMs) {
        revenue += o.total_usd ?? 0
        orders += 1
      }
    }
    return { revenue, orders }
  }

  const OPEN_END = Number.MAX_SAFE_INTEGER

  // Today / This month (이전 쿼리는 상한 없이 gte만 사용 → 동일하게 OPEN_END)
  const today = bucket(todayStart.getTime(), OPEN_END)
  const month = bucket(monthStart.getTime(), OPEN_END)

  // Weekly revenue for past 8 weeks (이전 경계 계산 그대로 유지)
  const weeklyData: { week: string; revenue: number; orders: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() - i * 7)
    weekEnd.setUTCHours(23, 59, 59, 999)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - 6)
    weekStart.setUTCHours(0, 0, 0, 0)

    const { revenue, orders } = bucket(weekStart.getTime(), weekEnd.getTime())
    weeklyData.push({
      week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      revenue,
      orders,
    })
  }

  // Monthly revenue for past 6 months (이전 경계 계산 그대로 유지)
  const monthlyData: { month: string; revenue: number; orders: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)

    const { revenue, orders } = bucket(mStart.getTime(), mEnd.getTime())
    monthlyData.push({
      month: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      revenue,
      orders,
    })
  }

  // Product analysis (aggregate by product_slug from print_order_items)
  const productMap: Record<string, { name: string; orders: number; revenue: number }> = {}
  for (const item of itemsRes.data ?? []) {
    if (!productMap[item.product_slug]) {
      productMap[item.product_slug] = { name: item.product_name_en, orders: 0, revenue: 0 }
    }
    productMap[item.product_slug].orders += 1
    productMap[item.product_slug].revenue +=
      (item.unit_price_usd ?? 0) * (item.quantity ?? 1)
  }

  const productStats = Object.entries(productMap)
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  // Order status distribution (전체기간)
  const statusDist: Record<string, number> = {}
  for (const o of allOrdersRes.data ?? []) {
    statusDist[o.status] = (statusDist[o.status] ?? 0) + 1
  }

  return NextResponse.json(
    {
      today,
      month,
      weeklyTrend: weeklyData,
      monthlyTrend: monthlyData,
      productStats,
      statusDistribution: statusDist,
    },
    {
      // 어드민 전용(비SEO) 응답. 브라우저에서 30초 동안 재사용해 재진입 체감속도 향상.
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    }
  )
}
