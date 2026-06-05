'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface FunnelStep {
  type: string
  count: number
}

interface TimelinePoint {
  time: string
  count: number
}

interface RevenueData {
  total_discount_usd: number
  total_revenue_usd: number
  order_count: number
  aov_usd: number
  aov_baseline_usd: number
}

interface AnalyticsData {
  campaign: {
    id: string
    year: number
    status: string
    calendar: { name_ko: string; name_en: string; key: string } | null
  }
  funnel: FunnelStep[]
  unique_visitors: number
  timeline: TimelinePoint[]
  top_product: string | null
  revenue: RevenueData
  redemption_rate: number
  target_redemption_rate: number
}

const FUNNEL_LABELS: Record<string, string> = {
  promo_impression: '노출 (Impression)',
  promo_click: 'CTA 클릭',
  promo_code_view: '코드 확인',
  promo_add_to_cart: '장바구니 추가',
  promo_checkout_start: '결제 시작',
  promo_code_redeem: '코드 사용 완료',
}

const FUNNEL_COLORS = [
  'bg-indigo-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-green-600',
]

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtUsd(n: number) {
  return `$${fmt(n, 2)}`
}

function fmtPct(n: number) {
  return `${fmt(n, 2)}%`
}

export default function CampaignAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/promotions/${id}/analytics`)
    if (res.status === 401) { router.push('/admin/login'); return }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? '데이터를 불러올 수 없습니다.')
      setLoading(false)
      return
    }
    setData(await res.json())
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">데이터 로딩 중...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-red-500">{error || '데이터 없음'}</div>
      </div>
    )
  }

  const { campaign, funnel, unique_visitors, timeline, top_product, revenue, redemption_rate, target_redemption_rate } = data

  const impressionCount = funnel[0]?.count ?? 0
  const redeemCount = funnel[funnel.length - 1]?.count ?? 0
  const maxCount = Math.max(...funnel.map((f) => f.count), 1)

  const aovDelta = revenue.aov_baseline_usd > 0
    ? ((revenue.aov_usd - revenue.aov_baseline_usd) / revenue.aov_baseline_usd) * 100
    : null

  const rateVsTarget = redemption_rate - target_redemption_rate
  const nextYearRecommended =
    redemption_rate < target_redemption_rate
      ? '+5%'
      : redemption_rate > 5
        ? '-2%'
        : '유지'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/promotions"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              프로모션 목록
            </Link>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {campaign.calendar?.name_ko} {campaign.year} — Funnel 분석
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {campaign.calendar?.name_en} · 상태: {campaign.status}
          </p>
        </div>

        {/* KPI 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '총 노출', value: fmt(impressionCount), sub: `UV ${fmt(unique_visitors)}` },
            {
              label: '코드 사용',
              value: fmt(redeemCount),
              sub: `전환율 ${fmtPct(redemption_rate)}`,
            },
            { label: '프로모 매출', value: fmtUsd(revenue.total_revenue_usd), sub: `${fmt(revenue.order_count)}건` },
            { label: '총 할인액', value: fmtUsd(revenue.total_discount_usd), sub: 'revenue impact' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Funnel 차트 */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Funnel (Impression → Redeem)</h2>
          <div className="space-y-3">
            {funnel.map((step, i) => {
              const prev = i === 0 ? step.count : funnel[i - 1].count
              const dropPct = prev > 0 && i > 0 ? ((prev - step.count) / prev) * 100 : 0
              const barWidth = maxCount > 0 ? (step.count / maxCount) * 100 : 0

              return (
                <div key={step.type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{FUNNEL_LABELS[step.type] ?? step.type}</span>
                    <div className="flex items-center gap-3">
                      {i > 0 && step.count < prev && (
                        <span className="text-xs text-red-500">▼ {fmtPct(dropPct)} 이탈</span>
                      )}
                      <span className="font-semibold text-gray-900">{fmt(step.count)}</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${FUNNEL_COLORS[i]}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 전환율 vs 목표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Redemption rate vs 목표
            </h2>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{fmtPct(redemption_rate)}</span>
              <span className="text-sm text-gray-400 mb-0.5">
                목표 {fmtPct(target_redemption_rate)}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {rateVsTarget >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : rateVsTarget > -0.2 ? (
                <Minus className="h-4 w-4 text-yellow-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  rateVsTarget >= 0
                    ? 'text-green-600'
                    : rateVsTarget > -0.2
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }`}
              >
                목표 대비 {rateVsTarget >= 0 ? '+' : ''}{fmtPct(rateVsTarget)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              내년 권장 할인 조정: <strong>{nextYearRecommended}</strong>
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">AOV vs Baseline</h2>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{fmtUsd(revenue.aov_usd)}</span>
              <span className="text-sm text-gray-400 mb-0.5">
                baseline {fmtUsd(revenue.aov_baseline_usd)}
              </span>
            </div>
            {aovDelta !== null && (
              <div className="mt-3 flex items-center gap-2">
                {aovDelta >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={`text-sm font-medium ${aovDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {aovDelta >= 0 ? '+' : ''}{fmtPct(aovDelta)} vs baseline
                </span>
              </div>
            )}
            {top_product && (
              <p className="text-xs text-gray-400 mt-3">
                최다 ATC 상품: <strong>{top_product}</strong>
              </p>
            )}
          </div>
        </div>

        {/* 시간대별 redemption 타임라인 */}
        {timeline.length > 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              시간대별 Redemption (6h 버킷)
            </h2>
            <div className="flex items-end gap-1 h-32">
              {timeline.map((t) => {
                const maxVal = Math.max(...timeline.map((x) => x.count), 1)
                const heightPct = (t.count / maxVal) * 100
                return (
                  <div
                    key={t.time}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${t.time}: ${t.count}건`}
                  >
                    <div
                      className="w-full bg-indigo-500 rounded-t opacity-80 group-hover:opacity-100 transition-opacity"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{timeline[0]?.time.slice(0, 10)}</span>
              <span>{timeline[timeline.length - 1]?.time.slice(0, 10)}</span>
            </div>
          </div>
        )}

        {timeline.length === 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center text-sm text-gray-400">
            아직 redemption 데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
