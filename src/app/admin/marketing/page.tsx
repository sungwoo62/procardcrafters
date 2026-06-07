'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Target, MousePointerClick, Megaphone } from 'lucide-react'

interface ChannelAgg {
  channel: string
  label: string
  orders: number
  revenue_usd: number
  aov_usd: number
  spend_usd: number
  clicks: number
  impressions: number
  roas: number | null
  cpa_usd: number | null
}

interface Performance {
  range: { days: number; since: string }
  kpi: {
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
  channels: ChannelAgg[]
  notes: string[]
}

const RANGES = [7, 30, 90] as const

function fmtUsd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MarketingDashboard() {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<Performance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/marketing/performance?days=${days}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? '불러오기 실패')
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const kpiCards = data
    ? [
        { label: '매출(기간)', value: fmtUsd(data.kpi.revenue_usd), sub: `${data.kpi.orders} orders`, icon: DollarSign },
        { label: 'AOV', value: fmtUsd(data.kpi.aov_usd), sub: '주문당 평균', icon: ShoppingBag },
        {
          label: '광고비',
          value: fmtUsd(data.kpi.ad_spend_usd),
          sub: `${data.kpi.paid_clicks} clicks`,
          icon: Megaphone,
        },
        {
          label: 'Blended ROAS',
          value: data.kpi.blended_roas != null ? `${data.kpi.blended_roas}x` : '—',
          sub: data.kpi.blended_roas != null ? '매출/광고비' : '광고비 데이터 필요',
          icon: TrendingUp,
        },
        {
          label: 'Blended CPA',
          value: data.kpi.blended_cpa_usd != null ? fmtUsd(data.kpi.blended_cpa_usd) : '—',
          sub: data.kpi.blended_cpa_usd != null ? '광고비/주문' : '광고비 데이터 필요',
          icon: Target,
        },
        {
          label: '유료 CVR',
          value: data.kpi.paid_cvr_pct != null ? `${data.kpi.paid_cvr_pct}%` : '—',
          sub: '주문/광고클릭',
          icon: MousePointerClick,
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-400 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">마케팅 성과</h1>
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r}일
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : data ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {kpiCards.map(({ label, value, sub, icon: Icon }) => (
                <div key={label} className="rounded-2xl bg-white border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
                      <Icon className="h-3.5 w-3.5 text-gray-600" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* 채널별 매출 기여 */}
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">채널별 성과</h2>
              {data.channels.length === 0 ? (
                <p className="text-sm text-gray-400">기간 내 주문 없음</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                        <th className="py-2 pr-3 font-medium">채널</th>
                        <th className="py-2 px-3 font-medium text-right">매출</th>
                        <th className="py-2 px-3 font-medium text-right">주문</th>
                        <th className="py-2 px-3 font-medium text-right">AOV</th>
                        <th className="py-2 px-3 font-medium text-right">광고비</th>
                        <th className="py-2 px-3 font-medium text-right">ROAS</th>
                        <th className="py-2 pl-3 font-medium text-right">CPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.channels.map((c) => (
                        <tr key={c.channel} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5 pr-3 font-medium text-gray-800">{c.label}</td>
                          <td className="py-2.5 px-3 text-right text-gray-700">{fmtUsd(c.revenue_usd)}</td>
                          <td className="py-2.5 px-3 text-right text-gray-600">{c.orders}</td>
                          <td className="py-2.5 px-3 text-right text-gray-600">{fmtUsd(c.aov_usd)}</td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {c.spend_usd > 0 ? fmtUsd(c.spend_usd) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-700">
                            {c.roas != null ? `${c.roas}x` : '—'}
                          </td>
                          <td className="py-2.5 pl-3 text-right text-gray-700">
                            {c.cpa_usd != null ? fmtUsd(c.cpa_usd) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 데이터 가용성 안내 (정직성) */}
            {data.notes.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 text-xs font-semibold text-amber-800">데이터 가용성</p>
                <ul className="space-y-1 text-xs text-amber-700 list-disc pl-4">
                  {data.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
