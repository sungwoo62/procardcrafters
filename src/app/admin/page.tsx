'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  BarChart2,
  MessageCircle,
  Package,
  FileText,
  Users,
} from 'lucide-react'

interface TrendPoint {
  week?: string
  month?: string
  revenue: number
  orders: number
}

interface ProductStat {
  slug: string
  name: string
  orders: number
  revenue: number
}

interface Stats {
  today: { revenue: number; orders: number }
  month: { revenue: number; orders: number }
  weeklyTrend: TrendPoint[]
  monthlyTrend: TrendPoint[]
  productStats: ProductStat[]
  statusDistribution: Record<string, number>
}

// Pure CSS bar chart component
function BarChart({ data, labelKey }: { data: TrendPoint[]; labelKey: 'week' | 'month' }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => {
        const height = Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 4 : 0)
        const label = labelKey === 'week' ? d.week : d.month
        return (
          <div key={i} className="flex flex-col items-center flex-1 gap-1">
            <div className="relative w-full group">
              {d.revenue > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-xs text-white z-10">
                  ${d.revenue.toFixed(0)} ({d.orders} orders)
                </div>
              )}
              <div
                className="w-full rounded-t bg-gray-800 transition-all"
                style={{ height: `${height}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
              />
            </div>
            <span className="text-xs text-gray-400 truncate w-full text-center">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export default function AdminDashboardPage() {
  const [secret, setSecret] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trendView, setTrendView] = useState<'weekly' | 'monthly'>('weekly')

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/stats', {
      headers: { 'x-admin-secret': secret },
    })
    if (res.status === 401) {
      setAuthenticated(false)
      setError('Authentication failed. Please check your password.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setStats(data)
    setLoading(false)
  }, [secret])

  useEffect(() => {
    if (authenticated) fetchStats()
  }, [authenticated, fetchStats])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthenticated(true)
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
          <h1 className="mb-6 text-xl font-bold text-gray-900">Admin Dashboard</h1>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <input
            type="password"
            placeholder="Admin password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mb-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            Log In
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header + Navigation */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <nav className="flex gap-2 flex-wrap">
            {[
              { href: '/admin', label: 'Dashboard', icon: BarChart2 },
              { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
              { href: '/admin/files', label: 'File Review', icon: FileText },
              { href: '/admin/chats', label: 'Chat Logs', icon: MessageCircle },
              { href: '/admin/portfolio', label: 'Portfolio', icon: Package },
              { href: '/admin/files', label: 'File Review', icon: FileText },
              { href: '/admin/customers', label: 'Customers', icon: Users },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={`${href}?secret=${encodeURIComponent(secret)}`}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : stats ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: "Today's Revenue",
                  value: `$${stats.today.revenue.toFixed(2)}`,
                  sub: `${stats.today.orders} orders`,
                  icon: DollarSign,
                },
                {
                  label: 'Monthly Revenue',
                  value: `$${stats.month.revenue.toFixed(2)}`,
                  sub: `${stats.month.orders} orders`,
                  icon: TrendingUp,
                },
                {
                  label: 'Monthly Orders',
                  value: `${stats.month.orders}`,
                  sub: `Avg $${stats.month.orders > 0 ? (stats.month.revenue / stats.month.orders).toFixed(2) : '0'}`,
                  icon: ShoppingBag,
                },
                {
                  label: 'Total Orders',
                  value: `${Object.values(stats.statusDistribution).reduce((a, b) => a + b, 0)}`,
                  sub: 'All orders',
                  icon: BarChart2,
                },
              ].map(({ label, value, sub, icon: Icon }) => (
                <div key={label} className="rounded-2xl bg-white border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
                      <Icon className="h-3.5 w-3.5 text-gray-600" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Revenue Trend Chart */}
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Revenue Trend</h2>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['weekly', 'monthly'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setTrendView(v)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        trendView === v
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {v === 'weekly' ? 'Weekly' : 'Monthly'}
                    </button>
                  ))}
                </div>
              </div>
              {trendView === 'weekly' ? (
                <BarChart data={stats.weeklyTrend} labelKey="week" />
              ) : (
                <BarChart data={stats.monthlyTrend} labelKey="month" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Product Analysis */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Product Analysis</h2>
                {stats.productStats.length === 0 ? (
                  <p className="text-sm text-gray-400">No data</p>
                ) : (
                  <div className="space-y-3">
                    {stats.productStats.map((p) => {
                      const maxRevenue = stats.productStats[0]?.revenue ?? 1
                      const pct = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0
                      return (
                        <div key={p.slug}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">{p.name}</span>
                            <span className="text-sm text-gray-500">
                              ${p.revenue.toFixed(2)} ({p.orders} orders)
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100">
                            <div
                              className="h-1.5 rounded-full bg-gray-800 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Order Status Distribution */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Order Status Distribution</h2>
                {Object.keys(stats.statusDistribution).length === 0 ? (
                  <p className="text-sm text-gray-400">No data</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.statusDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => {
                        const total = Object.values(stats.statusDistribution).reduce(
                          (a, b) => a + b,
                          0
                        )
                        const pct = total > 0 ? (count / total) * 100 : 0
                        return (
                          <div key={status} className="flex items-center gap-3">
                            <span className="w-20 text-xs text-gray-600 shrink-0">
                              {STATUS_LABELS[status] ?? status}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                              <div
                                className="h-1.5 rounded-full bg-gray-700 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-gray-500">{count}</span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
