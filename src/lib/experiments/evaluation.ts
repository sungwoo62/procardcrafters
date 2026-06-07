// 성과 평가 + 승자 판정 (자동 최적화 루프의 핵심) (OMO-2596)
// 참조 패턴: OMO-2543 determineWinner — 통계적 유의·최소표본 게이트 유지
import type { Experiment, ExperimentPerf, GoalMetric } from './types'

// 비율(전환율/클릭률)은 2-비율 z검정으로 유의성 판정 가능.
const PROPORTION_METRICS: GoalMetric[] = ['cvr', 'ctr']

// rpv/aov(매출성)는 분산 미수집 → 통계검정 대신 최소 상대 리프트 휴리스틱 게이트.
const MIN_REVENUE_LIFT = 0.05

export interface EvaluationResult {
  // 승자 채택 결정이 내려졌는가
  decided: boolean
  winnerVariantId: string | null
  winnerKey: string | null
  // 'significant' | 'max_runtime' | 'insufficient_sample' | 'no_difference' | 'no_candidates'
  reason: string
  pValue: number | null
  leaderKey: string | null
  runnerUpKey: string | null
  // 최소 표본 게이트 충족 여부
  gateMet: boolean
}

// 표준정규 누적분포 (Abramowitz & Stegun 7.1.26 근사)
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2)
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

/**
 * 2-비율 양측 z검정.
 * 두 변형의 성공/시도로부터 z통계량과 p-value를 산출한다.
 */
export function twoProportionZTest(
  successA: number,
  trialsA: number,
  successB: number,
  trialsB: number
): { z: number; pValue: number } {
  if (trialsA <= 0 || trialsB <= 0) return { z: 0, pValue: 1 }
  const pA = successA / trialsA
  const pB = successB / trialsB
  const pPool = (successA + successB) / (trialsA + trialsB)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / trialsA + 1 / trialsB))
  if (se === 0) return { z: 0, pValue: 1 }
  const z = (pA - pB) / se
  // 양측 p-value
  const pValue = 2 * (1 - normalCdf(Math.abs(z)))
  return { z, pValue }
}

function metricValue(row: ExperimentPerf, metric: GoalMetric): number {
  return row[metric]
}

// 비율 지표의 분자(성공 수) — 노출 대비
function successCount(row: ExperimentPerf, metric: GoalMetric): number {
  return metric === 'ctr' ? row.clicks : row.conversions
}

/**
 * 실험의 변형 성과로부터 승자를 판정한다. 순수 함수(부수효과 없음).
 *
 * 게이트:
 *  1. 활성 변형 중 최소 2개가 min_sample_per_variant(노출 기준)를 충족해야 평가.
 *  2. 비율 지표: 선두 vs 2위 2-비율 z검정 p < (1-confidence) → 유의한 승자.
 *  3. 매출 지표: 선두가 2위 대비 최소 5% 리프트 → 승자(휴리스틱).
 *  4. forceOnTimeout=true(최대 운영기간 초과): 게이트 충족 시 선두를 강제 채택.
 */
export function determineWinner(
  experiment: Pick<Experiment, 'goal_metric' | 'min_sample_per_variant' | 'confidence_level'>,
  perf: ExperimentPerf[],
  opts: { forceOnTimeout?: boolean } = {}
): EvaluationResult {
  const metric = experiment.goal_metric
  const alpha = 1 - experiment.confidence_level

  const active = perf.filter((p) => p.is_active)
  const empty: EvaluationResult = {
    decided: false,
    winnerVariantId: null,
    winnerKey: null,
    reason: 'no_candidates',
    pValue: null,
    leaderKey: null,
    runnerUpKey: null,
    gateMet: false,
  }
  if (active.length < 2) return empty

  // 최소 표본(노출) 게이트
  const qualified = active.filter((p) => p.impressions >= experiment.min_sample_per_variant)
  const gateMet = qualified.length >= 2

  // 지표 내림차순 정렬 (게이트 충족분 우선, 없으면 전체)
  const pool = gateMet ? qualified : active
  const ranked = [...pool].sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
  const leader = ranked[0]
  const runnerUp = ranked[1]

  const base: EvaluationResult = {
    decided: false,
    winnerVariantId: null,
    winnerKey: null,
    reason: gateMet ? 'no_difference' : 'insufficient_sample',
    pValue: null,
    leaderKey: leader.variant_key,
    runnerUpKey: runnerUp?.variant_key ?? null,
    gateMet,
  }

  if (!gateMet) {
    // 표본 부족: 기간초과 강제 채택만 허용
    if (opts.forceOnTimeout && metricValue(leader, metric) > metricValue(runnerUp, metric)) {
      return {
        ...base,
        decided: true,
        winnerVariantId: leader.variant_id,
        winnerKey: leader.variant_key,
        reason: 'max_runtime',
      }
    }
    return base
  }

  let significant = false
  let pValue: number | null = null

  if (PROPORTION_METRICS.includes(metric)) {
    const { pValue: p } = twoProportionZTest(
      successCount(leader, metric),
      leader.impressions,
      successCount(runnerUp, metric),
      runnerUp.impressions
    )
    pValue = p
    significant = p < alpha && metricValue(leader, metric) > metricValue(runnerUp, metric)
  } else {
    // 매출 지표: 상대 리프트 휴리스틱
    const runnerVal = metricValue(runnerUp, metric)
    const leaderVal = metricValue(leader, metric)
    significant = runnerVal > 0 ? leaderVal >= runnerVal * (1 + MIN_REVENUE_LIFT) : leaderVal > 0
  }

  if (significant) {
    return {
      ...base,
      decided: true,
      winnerVariantId: leader.variant_id,
      winnerKey: leader.variant_key,
      reason: 'significant',
      pValue,
    }
  }

  // 유의차 없음 — 기간초과 시 선두 강제 채택
  if (opts.forceOnTimeout && metricValue(leader, metric) > metricValue(runnerUp, metric)) {
    return {
      ...base,
      decided: true,
      winnerVariantId: leader.variant_id,
      winnerKey: leader.variant_key,
      reason: 'max_runtime',
      pValue,
    }
  }

  return { ...base, pValue }
}
