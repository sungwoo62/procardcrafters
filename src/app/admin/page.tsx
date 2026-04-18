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

// 순수 CSS 바 차트 컴포넌트
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
                  ${d.revenue.toFixed(0)} ({d.orders}건)
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
  pending: '대기',
  paid: '결제완료',
  processing: '제작중',
  shipped: '배송중',
  delivered: '배송완료',
  cancelled: '취소',
  refunded: '환불',
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
      setError('인증 실패. 비밀번호를 확인하세요.')
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
            로그인
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* 헤더 + 내비게이션 */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
          <nav className="flex gap-2 flex-wrap">
            {[
              { href: '/admin', label: '대시보드', icon: BarChart2 },
              { href: '/admin/orders', label: '주문 관리', icon: ShoppingBag },
              { href: '/admin/files', label: '파일 검토', icon: FileText },
              { href: '/admin/chats', label: '챗봇 이력', icon: MessageCircle },
              { href: '/admin/portfolio', label: '포트폴리오', icon: Package },
              { href: '/admin/files', label: '파일 검토', icon: FileText },
              { href: '/admin/customers', label: '고객 관리', icon: Users },
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
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : stats ? (
          <div className="space-y-6">
            {/* KPI 카드 */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: '오늘 매출',
                  value: `$${stats.today.revenue.toFixed(2)}`,
                  sub: `${stats.today.orders}건`,
                  icon: DollarSign,
                },
                {
                  label: '이번 달 매출',
                  value: `$${stats.month.revenue.toFixed(2)}`,
                  sub: `${stats.month.orders}건`,
                  icon: TrendingUp,
                },
                {
                  label: '이번 달 주문',
                  value: `${stats.month.orders}건`,
                  sub: `평균 $${stats.month.orders > 0 ? (stats.month.revenue / stats.month.orders).toFixed(2) : '0'}`,
                  icon: ShoppingBag,
                },
                {
                  label: '챗봇 견적',
                  value: `${Object.values(stats.statusDistribution).reduce((a, b) => a + b, 0)}건`,
                  sub: '전체 주문',
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

            {/* 매출 트렌드 차트 */}
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">매출 트렌드</h2>
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
                      {v === 'weekly' ? '주간' : '월간'}
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
              {/* 상품별 분석 */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">상품별 분석</h2>
                {stats.productStats.length === 0 ? (
                  <p className="text-sm text-gray-400">데이터 없음</p>
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
                              ${p.revenue.toFixed(2)} ({p.orders}건)
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

              {/* 주문 상태 분포 */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">주문 상태 분포</h2>
                {Object.keys(stats.statusDistribution).length === 0 ? (
                  <p className="text-sm text-gray-400">데이터 없음</p>
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
