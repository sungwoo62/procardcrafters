import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { evaluateAndPromote, getExperimentByKey } from '@/lib/experiments/service'

// 단일 실험 수동 평가/채택 (어드민).
// POST /api/admin/marketing/experiments/{key}/evaluate?dryRun=1
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { key } = await params
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'

  const supabase = createServerClient()
  const experiment = await getExperimentByKey(supabase, key)
  if (!experiment) {
    return NextResponse.json({ error: '실험 없음' }, { status: 404 })
  }

  const outcome = await evaluateAndPromote(supabase, experiment, { dryRun })
  return NextResponse.json({ ok: true, dryRun, outcome })
}
