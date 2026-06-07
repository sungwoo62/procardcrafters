// 실험 서비스 — 배정/이벤트/평가/승자채택 (DB 부수효과) (OMO-2596)
// 자동 최적화 루프: 성과수집 → 평가 → 자동 승자 채택
import type { SupabaseClient } from '@supabase/supabase-js'
import { pickVariant } from './assignment'
import { determineWinner, type EvaluationResult } from './evaluation'
import type { Experiment, ExperimentEventType, ExperimentPerf, ExperimentVariant } from './types'

// service_role 클라이언트를 받아 RLS를 우회한다.
type DB = SupabaseClient

export async function getExperimentByKey(db: DB, key: string): Promise<Experiment | null> {
  const { data } = await db
    .from('print_marketing_experiments')
    .select('*')
    .eq('key', key)
    .maybeSingle()
  return (data as Experiment | null) ?? null
}

export async function getVariants(db: DB, experimentId: string): Promise<ExperimentVariant[]> {
  const { data } = await db
    .from('print_marketing_experiment_variants')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('created_at', { ascending: true })
  return (data as ExperimentVariant[] | null) ?? []
}

export async function getPerf(db: DB, experimentId: string): Promise<ExperimentPerf[]> {
  const { data } = await db
    .from('print_marketing_experiment_perf')
    .select('*')
    .eq('experiment_id', experimentId)
  return (data as ExperimentPerf[] | null) ?? []
}

/**
 * 세션에 변형을 배정한다(sticky). 기존 배정이 있으면 그대로 반환,
 * 없으면 가중 결정론적으로 골라 assignments에 기록한다.
 * 종료된 실험은 승자 변형으로 고정 배정한다.
 */
export async function assignVariant(
  db: DB,
  experiment: Experiment,
  sessionId: string,
  userId: string | null
): Promise<ExperimentVariant | null> {
  const variants = await getVariants(db, experiment.id)
  if (variants.length === 0) return null

  // 종료/완료 실험 → 승자(또는 control)로 고정
  if (experiment.status !== 'running') {
    const winner =
      variants.find((v) => v.id === experiment.winner_variant_id) ??
      variants.find((v) => v.is_control) ??
      variants[0]
    return winner ?? null
  }

  // 기존 배정 조회
  const { data: existing } = await db
    .from('print_marketing_experiment_assignments')
    .select('variant_id')
    .eq('experiment_id', experiment.id)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existing?.variant_id) {
    const found = variants.find((v) => v.id === existing.variant_id)
    if (found) return found
  }

  const picked = pickVariant(experiment.key, sessionId, variants)
  if (!picked) return null

  // upsert로 동시성 안전(unique(experiment_id, session_id))
  await db
    .from('print_marketing_experiment_assignments')
    .upsert(
      {
        experiment_id: experiment.id,
        variant_id: picked.id,
        session_id: sessionId,
        user_id: userId,
      },
      { onConflict: 'experiment_id,session_id', ignoreDuplicates: true }
    )

  return picked
}

export async function recordEvent(
  db: DB,
  params: {
    experimentId: string
    variantId: string
    eventType: ExperimentEventType
    sessionId: string | null
    userId: string | null
    value?: number
    orderId?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await db.from('print_marketing_experiment_events').insert({
    experiment_id: params.experimentId,
    variant_id: params.variantId,
    event_type: params.eventType,
    session_id: params.sessionId,
    user_id: params.userId,
    value: params.value ?? 0,
    order_id: params.orderId ?? null,
    metadata: params.metadata ?? {},
  })
}

function runtimeExceeded(experiment: Experiment): boolean {
  if (!experiment.started_at) return false
  const started = new Date(experiment.started_at).getTime()
  const ageDays = (Date.now() - started) / (1000 * 60 * 60 * 24)
  return ageDays >= experiment.max_runtime_days
}

export interface EvaluateOutcome {
  experimentKey: string
  result: EvaluationResult
  promoted: boolean
  deactivatedVariantKeys: string[]
}

/**
 * 단일 실험 평가 + (게이트 통과 & auto_promote 시) 자동 승자 채택.
 * 채택 시: 실험 completed, winner 기록, 패자 변형 is_active=false.
 * dryRun=true면 평가만 하고 DB를 변경하지 않는다(어드민 미리보기).
 */
export async function evaluateAndPromote(
  db: DB,
  experiment: Experiment,
  opts: { dryRun?: boolean } = {}
): Promise<EvaluateOutcome> {
  const perf = await getPerf(db, experiment.id)
  const forceOnTimeout = runtimeExceeded(experiment)
  const result = determineWinner(experiment, perf, { forceOnTimeout })

  const outcome: EvaluateOutcome = {
    experimentKey: experiment.key,
    result,
    promoted: false,
    deactivatedVariantKeys: [],
  }

  const shouldPromote =
    result.decided && result.winnerVariantId !== null && experiment.auto_promote && !opts.dryRun

  if (!shouldPromote) return outcome

  const winnerId = result.winnerVariantId as string
  const nowIso = new Date().toISOString()

  // 1) 실험 종료 + 승자 기록
  await db
    .from('print_marketing_experiments')
    .update({
      status: 'completed',
      winner_variant_id: winnerId,
      decided_at: nowIso,
      decision_reason: result.reason,
      ended_at: nowIso,
    })
    .eq('id', experiment.id)
    // 동시 실행 가드: 아직 running일 때만 채택
    .eq('status', 'running')

  // 2) 패자 변형 비활성화 (배정 풀에서 제외 = setAdEnabled(loser,false) 등가)
  const losers = perf.filter((p) => p.variant_id !== winnerId && p.is_active)
  if (losers.length > 0) {
    await db
      .from('print_marketing_experiment_variants')
      .update({ is_active: false })
      .in(
        'id',
        losers.map((l) => l.variant_id)
      )
    outcome.deactivatedVariantKeys = losers.map((l) => l.variant_key)
  }

  outcome.promoted = true
  return outcome
}

/**
 * 자동 최적화 루프의 진입점: running + auto_promote 실험 전체를 평가/채택.
 */
export async function runOptimizationLoop(db: DB): Promise<EvaluateOutcome[]> {
  const { data } = await db
    .from('print_marketing_experiments')
    .select('*')
    .eq('status', 'running')
    .eq('auto_promote', true)

  const experiments = (data as Experiment[] | null) ?? []
  const outcomes: EvaluateOutcome[] = []
  for (const exp of experiments) {
    outcomes.push(await evaluateAndPromote(db, exp))
  }
  return outcomes
}
