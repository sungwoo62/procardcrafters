import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { assignVariant, getExperimentByKey } from '@/lib/experiments/service'

// 변형 배정 — 세션별 sticky. 클라이언트가 노출 직전 호출.
// POST { experimentKey, sessionId, userId? }
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey : null
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null
  const userId = typeof body.userId === 'string' ? body.userId : null

  if (!experimentKey) {
    return NextResponse.json({ error: 'experimentKey 필수' }, { status: 400 })
  }
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId 필수' }, { status: 400 })
  }

  const supabase = createServerClient()
  const experiment = await getExperimentByKey(supabase, experimentKey)

  // 없거나 초안/보관 상태 → 배정 없음(클라이언트는 기본 변형 표시)
  if (!experiment || experiment.status === 'draft' || experiment.status === 'archived') {
    return NextResponse.json({ assigned: false, variant: null })
  }

  const variant = await assignVariant(supabase, experiment, sessionId, userId)
  if (!variant) {
    return NextResponse.json({ assigned: false, variant: null })
  }

  return NextResponse.json({
    assigned: true,
    experimentId: experiment.id,
    variant: {
      id: variant.id,
      key: variant.key,
      config: variant.config,
    },
  })
}
