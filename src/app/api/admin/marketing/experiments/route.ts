import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { determineWinner } from '@/lib/experiments/evaluation'
import type { Experiment, ExperimentPerf } from '@/lib/experiments/types'

// A/B 실험 성과 측정 API (OMO-2596).
// 실험별 변형 성과(노출/전환/CVR/RPV) + 현재 승자 판정 미리보기를 롤업한다.
// OMO-2587 채널 성과측정 API(/api/admin/marketing/performance)와 병렬 보완:
// 채널/ROAS/CPA는 performance, 실험 변형 단위 성과·승자는 본 엔드포인트가 담당.
// GET /api/admin/marketing/experiments?status=running
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const statusFilter = request.nextUrl.searchParams.get('status')
  const supabase = createServerClient()

  let query = supabase
    .from('print_marketing_experiments')
    .select('*')
    .order('created_at', { ascending: false })
  if (statusFilter) {
    query = query.in('status', statusFilter.split(','))
  }

  const { data: experimentsData, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const experiments = (experimentsData as Experiment[] | null) ?? []

  if (experiments.length === 0) {
    return NextResponse.json({ experiments: [] })
  }

  const { data: perfData } = await supabase
    .from('print_marketing_experiment_perf')
    .select('*')
    .in(
      'experiment_id',
      experiments.map((e) => e.id)
    )
  const allPerf = (perfData as ExperimentPerf[] | null) ?? []

  const rollup = experiments.map((exp) => {
    const variants = allPerf.filter((p) => p.experiment_id === exp.id)
    // 현재 데이터로의 승자 판정 미리보기(채택은 하지 않음)
    const evaluation = determineWinner(exp, variants)
    return {
      id: exp.id,
      key: exp.key,
      name: exp.name,
      surface: exp.surface,
      status: exp.status,
      goalMetric: exp.goal_metric,
      autoPromote: exp.auto_promote,
      minSamplePerVariant: exp.min_sample_per_variant,
      confidenceLevel: exp.confidence_level,
      winnerVariantId: exp.winner_variant_id,
      decidedAt: exp.decided_at,
      decisionReason: exp.decision_reason,
      startedAt: exp.started_at,
      variants: variants.map((v) => ({
        variantId: v.variant_id,
        key: v.variant_key,
        name: v.variant_name,
        isControl: v.is_control,
        isActive: v.is_active,
        impressions: v.impressions,
        clicks: v.clicks,
        conversions: v.conversions,
        revenue: v.revenue,
        cvr: v.cvr,
        ctr: v.ctr,
        rpv: v.rpv,
        aov: v.aov,
      })),
      evaluation,
    }
  })

  return NextResponse.json({ experiments: rollup })
}
