import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getExperimentByKey, getVariants, recordEvent } from '@/lib/experiments/service'
import type { ExperimentEventType } from '@/lib/experiments/types'

const VALID_EVENTS: ExperimentEventType[] = ['impression', 'click', 'conversion']

// 노출/클릭/전환 이벤트 수집.
// POST { experimentKey, variantKey, sessionId?, userId?, eventType, value?, orderId? }
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey : null
  const variantKey = typeof body.variantKey === 'string' ? body.variantKey : null
  const eventType = body.eventType as ExperimentEventType
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null
  const userId = typeof body.userId === 'string' ? body.userId : null
  const orderId = typeof body.orderId === 'string' ? body.orderId : null
  const value = typeof body.value === 'number' && Number.isFinite(body.value) ? body.value : 0

  if (!experimentKey || !variantKey) {
    return NextResponse.json({ error: 'experimentKey, variantKey 필수' }, { status: 400 })
  }
  if (!VALID_EVENTS.includes(eventType)) {
    return NextResponse.json({ error: '유효하지 않은 eventType' }, { status: 400 })
  }

  const supabase = createServerClient()
  const experiment = await getExperimentByKey(supabase, experimentKey)
  if (!experiment) {
    return NextResponse.json({ error: '실험 없음' }, { status: 404 })
  }

  const variants = await getVariants(supabase, experiment.id)
  const variant = variants.find((v) => v.key === variantKey)
  if (!variant) {
    return NextResponse.json({ error: '변형 없음' }, { status: 404 })
  }

  await recordEvent(supabase, {
    experimentId: experiment.id,
    variantId: variant.id,
    eventType,
    sessionId,
    userId,
    value,
    orderId,
  })

  return NextResponse.json({ ok: true })
}
