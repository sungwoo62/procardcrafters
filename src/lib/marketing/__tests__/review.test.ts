import { describe, it, expect } from 'vitest'
import { assembleReview, delta, generateSuggestions } from '../review'
import type { ChannelAgg, PerformanceKpi, PerformanceWindow } from '../performance'

// ── 픽스처 ───────────────────────────────────────────────────
function channel(over: Partial<ChannelAgg>): ChannelAgg {
  return {
    channel: over.channel ?? 'paid_search',
    label: over.label ?? '유료 검색',
    orders: over.orders ?? 0,
    revenue_usd: over.revenue_usd ?? 0,
    aov_usd: over.aov_usd ?? 0,
    spend_usd: over.spend_usd ?? 0,
    clicks: over.clicks ?? 0,
    impressions: over.impressions ?? 0,
    roas: over.roas ?? null,
    cpa_usd: over.cpa_usd ?? null,
  }
}

function window(
  over: Omit<Partial<PerformanceWindow>, 'kpi'> & { kpi?: Partial<PerformanceKpi>; channels?: ChannelAgg[] },
): PerformanceWindow {
  return {
    since: over.since ?? '2026-06-01T00:00:00.000Z',
    until: over.until ?? '2026-06-08T00:00:00.000Z',
    kpi: {
      revenue_usd: 0,
      orders: 0,
      aov_usd: 0,
      ad_spend_usd: 0,
      blended_roas: null,
      blended_cpa_usd: null,
      paid_clicks: 0,
      paid_cvr_pct: null,
      attributed_orders: 0,
      ...over.kpi,
    },
    channels: over.channels ?? [],
    notes: over.notes ?? [],
  }
}

describe('delta', () => {
  it('previous=0 이면 pctChange=null(증가율 정의 불가)', () => {
    expect(delta(10, 0)).toEqual({ current: 10, previous: 0, absChange: 10, pctChange: null })
  })
  it('정상 증가율 계산', () => {
    const d = delta(150, 100)
    expect(d.absChange).toBe(50)
    expect(d.pctChange).toBeCloseTo(50)
  })
})

describe('generateSuggestions', () => {
  it('ROAS 격차 1.5배 이상이면 예산 재배분 제안(high)', () => {
    const cur = window({
      kpi: { revenue_usd: 1000, orders: 10, aov_usd: 100, ad_spend_usd: 300 },
      channels: [
        channel({ channel: 'paid_search', label: '유료 검색', spend_usd: 100, revenue_usd: 600, roas: 6, orders: 6 }),
        channel({ channel: 'paid_social', label: '유료 소셜', spend_usd: 200, revenue_usd: 400, roas: 2, orders: 4 }),
      ],
    })
    const out = generateSuggestions(cur, null)
    const budget = out.find((s) => s.category === 'budget' && s.priority === 'high')
    expect(budget).toBeTruthy()
    expect(budget!.title).toContain('재배분')
  })

  it('ROAS<1 손실 채널이면 축소 제안', () => {
    const cur = window({
      kpi: { revenue_usd: 50, orders: 1, aov_usd: 50, ad_spend_usd: 100 },
      channels: [channel({ channel: 'paid_social', label: '유료 소셜', spend_usd: 100, revenue_usd: 50, roas: 0.5, orders: 1 })],
    })
    const out = generateSuggestions(cur, null)
    expect(out.some((s) => s.title.includes('손실 구간') || s.title.includes('점검/축소'))).toBe(true)
  })

  it('유료 클릭 많고 CVR<1%면 랜딩 점검 제안', () => {
    const cur = window({
      kpi: { revenue_usd: 100, orders: 1, aov_usd: 100, ad_spend_usd: 50, paid_clicks: 500, paid_cvr_pct: 0.2 },
      channels: [channel({ channel: 'paid_search', label: '유료 검색', spend_usd: 50, revenue_usd: 100, roas: 2, orders: 1 })],
    })
    const out = generateSuggestions(cur, null)
    expect(out.some((s) => s.category === 'landing')).toBe(true)
  })

  it('데이터 없으면 안전망 제안(data)', () => {
    const out = generateSuggestions(window({}), null)
    expect(out.length).toBeGreaterThan(0)
    // 이메일 부재 제안 또는 SEO/data 안전망이 항상 1개 이상 존재
    expect(out.some((s) => ['data', 'email', 'seo'].includes(s.category))).toBe(true)
  })
})

describe('assembleReview', () => {
  it('previous=null 이면 deltas=null, summaryMd 생성', () => {
    const review = assembleReview(window({ kpi: { revenue_usd: 500, orders: 5, aov_usd: 100, ad_spend_usd: 0, blended_roas: null, blended_cpa_usd: null, paid_clicks: 0, paid_cvr_pct: null, attributed_orders: 0 } }), null)
    expect(review.deltas).toBeNull()
    expect(review.summaryMd).toContain('주간 마케팅 리뷰')
    expect(review.dataGaps.some((g) => g.metric.includes('CVR'))).toBe(true)
  })

  it('전주 대비 매출 델타가 요약에 반영', () => {
    const prev = window({ kpi: { revenue_usd: 400, orders: 4, aov_usd: 100, ad_spend_usd: 0, blended_roas: null, blended_cpa_usd: null, paid_clicks: 0, paid_cvr_pct: null, attributed_orders: 0 } })
    const cur = window({ kpi: { revenue_usd: 600, orders: 6, aov_usd: 100, ad_spend_usd: 0, blended_roas: null, blended_cpa_usd: null, paid_clicks: 0, paid_cvr_pct: null, attributed_orders: 0 } })
    const review = assembleReview(cur, prev)
    expect(review.deltas).not.toBeNull()
    expect(review.deltas!.revenue_usd.absChange).toBe(200)
    expect(review.deltas!.revenue_usd.pctChange).toBeCloseTo(50)
  })
})
