import { describe, it, expect } from 'vitest'
import { determineWinner, twoProportionZTest } from '../evaluation'
import { pickVariant } from '../assignment'
import type { Experiment, ExperimentPerf, ExperimentVariant } from '../types'

// ── 픽스처 ───────────────────────────────────────────────────
function perf(over: Partial<ExperimentPerf>): ExperimentPerf {
  return {
    experiment_id: 'exp1',
    variant_id: over.variant_id ?? 'v',
    variant_key: over.variant_key ?? 'v',
    variant_name: over.variant_key ?? 'v',
    is_control: false,
    is_active: true,
    weight: 1,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    cvr: 0,
    ctr: 0,
    rpv: 0,
    aov: 0,
    ...over,
  }
}

function exp(over: Partial<Experiment> = {}): Pick<
  Experiment,
  'goal_metric' | 'min_sample_per_variant' | 'confidence_level'
> {
  return {
    goal_metric: over.goal_metric ?? 'cvr',
    min_sample_per_variant: over.min_sample_per_variant ?? 200,
    confidence_level: over.confidence_level ?? 0.95,
  }
}

function variant(over: Partial<ExperimentVariant>): ExperimentVariant {
  return {
    id: over.id ?? 'v',
    experiment_id: 'exp1',
    key: over.key ?? 'v',
    name: over.key ?? 'v',
    is_control: over.is_control ?? false,
    weight: over.weight ?? 1,
    config: {},
    is_active: over.is_active ?? true,
    created_at: '2026-01-01',
  }
}

// ── z검정 ────────────────────────────────────────────────────
describe('twoProportionZTest', () => {
  it('큰 차이는 유의 (p<0.05)', () => {
    // 5% vs 10% @ n=1000
    const { pValue } = twoProportionZTest(100, 1000, 50, 1000)
    expect(pValue).toBeLessThan(0.05)
  })

  it('동일 비율은 비유의 (p≈1)', () => {
    const { pValue } = twoProportionZTest(50, 1000, 50, 1000)
    expect(pValue).toBeGreaterThan(0.9)
  })

  it('trials 0이면 p=1', () => {
    expect(twoProportionZTest(0, 0, 0, 0).pValue).toBe(1)
  })
})

// ── 승자 판정 게이트 ─────────────────────────────────────────
describe('determineWinner', () => {
  it('표본 부족 시 미결정', () => {
    const r = determineWinner(exp(), [
      perf({ variant_id: 'a', variant_key: 'control', impressions: 50, conversions: 5, cvr: 0.1 }),
      perf({ variant_id: 'b', variant_key: 'B', impressions: 50, conversions: 10, cvr: 0.2 }),
    ])
    expect(r.decided).toBe(false)
    expect(r.gateMet).toBe(false)
    expect(r.reason).toBe('insufficient_sample')
  })

  it('CVR 유의차 시 승자 채택', () => {
    const r = determineWinner(exp(), [
      perf({ variant_id: 'a', variant_key: 'control', impressions: 1000, conversions: 50, cvr: 0.05 }),
      perf({ variant_id: 'b', variant_key: 'B', impressions: 1000, conversions: 100, cvr: 0.1 }),
    ])
    expect(r.decided).toBe(true)
    expect(r.winnerKey).toBe('B')
    expect(r.reason).toBe('significant')
    expect(r.pValue).toBeLessThan(0.05)
  })

  it('표본 충분하나 유의차 없으면 미결정', () => {
    const r = determineWinner(exp(), [
      perf({ variant_id: 'a', variant_key: 'control', impressions: 1000, conversions: 50, cvr: 0.05 }),
      perf({ variant_id: 'b', variant_key: 'B', impressions: 1000, conversions: 52, cvr: 0.052 }),
    ])
    expect(r.decided).toBe(false)
    expect(r.gateMet).toBe(true)
    expect(r.reason).toBe('no_difference')
  })

  it('기간 초과 시 표본 부족이어도 선두 강제 채택', () => {
    const r = determineWinner(
      exp(),
      [
        perf({ variant_id: 'a', variant_key: 'control', impressions: 50, conversions: 2, cvr: 0.04 }),
        perf({ variant_id: 'b', variant_key: 'B', impressions: 50, conversions: 6, cvr: 0.12 }),
      ],
      { forceOnTimeout: true }
    )
    expect(r.decided).toBe(true)
    expect(r.winnerKey).toBe('B')
    expect(r.reason).toBe('max_runtime')
  })

  it('매출(rpv) 지표: 5% 이상 리프트 시 채택', () => {
    const r = determineWinner(exp({ goal_metric: 'rpv' }), [
      perf({ variant_id: 'a', variant_key: 'control', impressions: 1000, rpv: 1.0 }),
      perf({ variant_id: 'b', variant_key: 'B', impressions: 1000, rpv: 1.2 }),
    ])
    expect(r.decided).toBe(true)
    expect(r.winnerKey).toBe('B')
  })

  it('변형 1개면 미결정', () => {
    const r = determineWinner(exp(), [
      perf({ variant_id: 'a', variant_key: 'control', impressions: 1000, conversions: 50, cvr: 0.05 }),
    ])
    expect(r.decided).toBe(false)
    expect(r.reason).toBe('no_candidates')
  })
})

// ── 배정 ─────────────────────────────────────────────────────
describe('pickVariant', () => {
  const variants = [
    variant({ id: 'a', key: 'control', weight: 1 }),
    variant({ id: 'b', key: 'B', weight: 1 }),
  ]

  it('동일 세션은 항상 같은 변형(sticky)', () => {
    const first = pickVariant('exp', 'session-123', variants)
    const again = pickVariant('exp', 'session-123', variants)
    expect(first?.id).toBe(again?.id)
  })

  it('비활성 변형은 배정 제외', () => {
    const onlyA = [
      variant({ id: 'a', key: 'control', weight: 1, is_active: true }),
      variant({ id: 'b', key: 'B', weight: 1, is_active: false }),
    ]
    for (let i = 0; i < 20; i++) {
      expect(pickVariant('exp', `s${i}`, onlyA)?.id).toBe('a')
    }
  })

  it('가중치 0 변형 제외, 활성 없으면 null', () => {
    const none = [variant({ id: 'a', key: 'control', weight: 0 })]
    expect(pickVariant('exp', 's', none)).toBeNull()
  })

  it('대략적인 가중 분포(50/50)', () => {
    let aCount = 0
    const N = 2000
    for (let i = 0; i < N; i++) {
      if (pickVariant('exp', `sess-${i}`, variants)?.id === 'a') aCount++
    }
    // 결정론적 해시 — 40~60% 범위 내 균형 기대
    expect(aCount).toBeGreaterThan(N * 0.4)
    expect(aCount).toBeLessThan(N * 0.6)
  })
})
