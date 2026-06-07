/**
 * 공장 발주 파이프라인 헬스 모니터 (북극성 축1: 업무 풀 자동화 · 축2: 성과측정)
 *
 * 결제확정→시안승인→공장발주→납품 파이프라인이 "사람 개입 없이" 흐르는지 감시한다.
 * 드리프트(unowned/stalled) 자동 감지 + stalled placing 자동 재할당(self-heal) + 자동화 커버리지 지표 측정.
 *
 * 순수 분류/지표 계산(summarizePipeline)과 DB 부수효과(runPipelineHealthCheck)를 분리해 테스트 가능하게 둔다.
 */

import { createServerClient } from '@/lib/supabase'
import { logOrderEvent } from '@/lib/order-events'

// 임계값 (드리프트 판정 기준)
export const STALLED_PLACING_MIN = 30 // placing 잠금 후 30분 초과 → 워커 사망으로 간주, 재할당
export const STALE_PENDING_HOURS = 2 // pending 2시간 초과 → 큐 미배출(워커 다운)
export const MAX_ATTEMPTS = 3 // place-factory-orders.ts 와 동일

export interface PipelineCounts {
  /** print_factory_orders 전체 (cancelled 제외) */
  total: number
  placed: number
  pending: number
  placing: number
  failed: number
  /** placing 잠금 후 임계시간 초과 (워커 사망 추정) */
  stalledPlacing: number
  /** pending 임계시간 초과 (큐 미배출) */
  stalePending: number
  /** 결제+시안승인됐으나 발주 레코드 0건 (핸드오프 단절) */
  unownedPaid: number
}

export interface PipelineSummary extends PipelineCounts {
  /** placed / total * 100 — 자동 완료 비율 */
  automationCoveragePct: number
  /** (failed + stalledPlacing + unownedPaid) / 분모 * 100 — 수동개입 필요 비율 */
  manualInterventionPct: number
  severity: 'ok' | 'warning' | 'critical'
  /** 사람 inbox로 올려야 할 사건 요약 (없으면 빈 배열) */
  alerts: string[]
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 10000) / 100
}

/**
 * 큐 카운트로부터 자동화 커버리지 지표와 심각도를 계산한다 (순수 함수).
 *
 * severity:
 *  - critical: unownedPaid(핸드오프 단절) 또는 failed(재시도 소진) 존재 → 즉시 사람 개입
 *  - warning : stalledPlacing(재할당으로 self-heal) 또는 stalePending(큐 미배출) 존재
 *  - ok      : 드리프트 없음
 *
 * 커버리지 분모는 cancelled 제외 전체. unownedPaid 는 아직 발주 레코드가 없으므로
 * 수동개입 분모에 별도 가산한다.
 */
export function summarizePipeline(c: PipelineCounts): PipelineSummary {
  const denom = c.total + c.unownedPaid
  const manualCount = c.failed + c.stalledPlacing + c.unownedPaid

  const alerts: string[] = []
  if (c.unownedPaid > 0) {
    alerts.push(`결제+시안승인 완료됐으나 공장발주 미생성 ${c.unownedPaid}건 (핸드오프 단절)`)
  }
  if (c.failed > 0) {
    alerts.push(`공장발주 실패(재시도 ${MAX_ATTEMPTS}회 소진) ${c.failed}건`)
  }
  if (c.stalledPlacing > 0) {
    alerts.push(`발주 처리 중단(placing ${STALLED_PLACING_MIN}분+ 정체) ${c.stalledPlacing}건 → pending 재할당`)
  }
  if (c.stalePending > 0) {
    alerts.push(`발주 대기 적체(pending ${STALE_PENDING_HOURS}시간+) ${c.stalePending}건 → 워커 점검 필요`)
  }

  let severity: PipelineSummary['severity'] = 'ok'
  if (c.unownedPaid > 0 || c.failed > 0) severity = 'critical'
  else if (c.stalledPlacing > 0 || c.stalePending > 0) severity = 'warning'

  return {
    ...c,
    automationCoveragePct: pct(c.placed, c.total),
    manualInterventionPct: pct(manualCount, denom),
    severity,
    alerts,
  }
}

interface RunResult {
  summary: PipelineSummary
  requeued: number
}

/**
 * DB를 조회해 파이프라인 드리프트를 측정하고, stalled placing 을 자동 재할당하며,
 * 헬스 스냅샷을 print_factory_pipeline_health 에 기록한다.
 */
export async function runPipelineHealthCheck(nowMs: number): Promise<RunResult> {
  const supabase = createServerClient()
  const now = new Date(nowMs)
  const placingCutoff = new Date(nowMs - STALLED_PLACING_MIN * 60_000).toISOString()
  const pendingCutoff = new Date(nowMs - STALE_PENDING_HOURS * 3_600_000).toISOString()

  const countByStatus = async (status: string): Promise<number> => {
    const { count } = await supabase
      .from('print_factory_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    return count ?? 0
  }

  const [placed, pending, placing, failed] = await Promise.all([
    countByStatus('placed'),
    countByStatus('pending'),
    countByStatus('placing'),
    countByStatus('failed'),
  ])
  const total = placed + pending + placing + failed

  // 적체된 pending (큐 미배출)
  const { count: stalePending } = await supabase
    .from('print_factory_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('queued_at', pendingCutoff)

  // 정체된 placing (워커 사망 추정) — self-heal 대상 조회
  const { data: stalledRows } = await supabase
    .from('print_factory_orders')
    .select('id, print_order_id, attempt_count')
    .eq('status', 'placing')
    .lt('updated_at', placingCutoff)

  const stalledList = stalledRows ?? []

  // unowned drift: 결제(paid)+시안승인(approved)됐으나 발주 레코드가 0건인 주문
  const unownedPaid = await countUnownedPaidOrders(supabase)

  // --- self-heal: stalled placing 을 pending 으로 재할당 (재시도 여유분만) ---
  let requeued = 0
  for (const row of stalledList) {
    const final = (row.attempt_count ?? 0) >= MAX_ATTEMPTS
    const { error } = await supabase
      .from('print_factory_orders')
      .update({
        status: final ? 'failed' : 'pending',
        last_error: final
          ? `placing ${STALLED_PLACING_MIN}분+ 정체 (재시도 소진) — 자동 실패 처리`
          : `placing ${STALLED_PLACING_MIN}분+ 정체 — 자동 재할당`,
        failed_at: final ? now.toISOString() : null,
        updated_at: now.toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'placing') // 그 사이 워커가 placed 했으면 건드리지 않음
    if (!error) {
      requeued++
      await logOrderEvent({
        orderId: row.print_order_id,
        eventType: 'status_change',
        newValue: final ? '공장발주 자동 실패 처리(정체)' : '공장발주 자동 재할당(정체)',
        metadata: { factoryOrderId: row.id, reason: 'stalled_placing', attemptCount: row.attempt_count },
        actor: 'ops-monitor',
      }).catch(() => null)
    }
  }

  const counts: PipelineCounts = {
    total,
    placed,
    pending,
    placing,
    failed,
    // 재할당 후 placing 정체분은 해소됐으므로 스냅샷엔 0 가깝게 잡되 발생량 기록
    stalledPlacing: stalledList.length,
    stalePending: stalePending ?? 0,
    unownedPaid,
  }

  const summary = summarizePipeline(counts)

  // 헬스 스냅샷 기록 (추세 측정)
  await supabase.from('print_factory_pipeline_health').insert({
    total_factory_orders: total,
    placed_count: placed,
    pending_count: pending,
    placing_count: placing,
    failed_count: failed,
    stalled_placing_count: stalledList.length,
    stale_pending_count: stalePending ?? 0,
    unowned_paid_count: unownedPaid,
    requeued_count: requeued,
    automation_coverage_pct: summary.automationCoveragePct,
    manual_intervention_pct: summary.manualInterventionPct,
    severity: summary.severity,
    details: { alerts: summary.alerts },
  })

  return { summary, requeued }
}

/**
 * 결제완료(paid)이고 시안이 승인(approved)됐는데 print_factory_orders 가 0건인 주문 수.
 * 이는 시안승인→발주 핸드오프가 깨진 경우(=드리프트)다.
 */
async function countUnownedPaidOrders(
  supabase: ReturnType<typeof createServerClient>,
): Promise<number> {
  // paid 상태 주문 id
  const { data: paidOrders } = await supabase
    .from('print_orders')
    .select('id')
    .eq('status', 'paid')

  if (!paidOrders || paidOrders.length === 0) return 0
  const paidIds = paidOrders.map((o) => o.id)

  // 그 중 시안 승인된 주문 id
  const { data: approvedProofs } = await supabase
    .from('print_design_proofs')
    .select('order_id')
    .eq('status', 'approved')
    .in('order_id', paidIds)

  const approvedOrderIds = [...new Set((approvedProofs ?? []).map((p) => p.order_id))]
  if (approvedOrderIds.length === 0) return 0

  // 발주 레코드가 이미 있는 주문 id
  const { data: withFactory } = await supabase
    .from('print_factory_orders')
    .select('print_order_id')
    .in('print_order_id', approvedOrderIds)

  const ownedIds = new Set((withFactory ?? []).map((f) => f.print_order_id))
  return approvedOrderIds.filter((id) => !ownedIds.has(id)).length
}
