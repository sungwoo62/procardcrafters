import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function verifyAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()

  // Start of today (UTC)
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Today's stats
  const { data: todayOrders } = await supabase
    .from('print_orders')
    .select('total_usd, status')
    .gte('created_at', todayStart.toISOString())
    .not('status', 'in', '("cancelled","refunded")')

  // This month's stats
  const { data: monthOrders } = await supabase
    .from('print_orders')
    .select('total_usd, status')
    .gte('created_at', monthStart.toISOString())
    .not('status', 'in', '("cancelled","refunded")')

  // Weekly revenue for past 8 weeks
  const weeklyData: { week: string; revenue: number; orders: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() - i * 7)
    weekEnd.setUTCHours(23, 59, 59, 999)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - 6)
    weekStart.setUTCHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('print_orders')
      .select('total_usd')
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())
      .not('status', 'in', '("cancelled","refunded")')

    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
    weeklyData.push({
      week: label,
      revenue: (data ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0),
      orders: (data ?? []).length,
    })
  }

  // Monthly revenue for past 6 months
  const monthlyData: { month: string; revenue: number; orders: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)

    const { data } = await supabase
      .from('print_orders')
      .select('total_usd')
      .gte('created_at', mStart.toISOString())
      .lte('created_at', mEnd.toISOString())
      .not('status', 'in', '("cancelled","refunded")')

    const label = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyData.push({
      month: label,
      revenue: (data ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0),
      orders: (data ?? []).length,
    })
  }

  // Product analysis (aggregate by product_slug from print_order_items)
  const { data: itemsData } = await supabase
    .from('print_order_items')
    .select('product_slug, product_name_en, unit_price_usd, quantity')

  const productMap: Record<string, { name: string; orders: number; revenue: number }> = {}
  for (const item of itemsData ?? []) {
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

  // Order status distribution
  const { data: allOrders } = await supabase
    .from('print_orders')
    .select('status')

  const statusDist: Record<string, number> = {}
  for (const o of allOrders ?? []) {
    statusDist[o.status] = (statusDist[o.status] ?? 0) + 1
  }

  return NextResponse.json({
    today: {
      revenue: (todayOrders ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0),
      orders: (todayOrders ?? []).length,
    },
    month: {
      revenue: (monthOrders ?? []).reduce((s, o) => s + (o.total_usd ?? 0), 0),
      orders: (monthOrders ?? []).length,
    },
    weeklyTrend: weeklyData,
    monthlyTrend: monthlyData,
    productStats,
    statusDistribution: statusDist,
  })
}
