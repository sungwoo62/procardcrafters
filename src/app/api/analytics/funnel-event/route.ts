import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// OMO-2914 (R2) — 라이브 퍼널 상단 1st-party 계측 싱크.
// 클라이언트 analytics.ts(view_item / begin_checkout)에서 fire-and-forget 로 호출한다.
// GA4 Data API 가 막혀(OMO-2894) 있어도 위클리 신호 루틴(OMO-2891)이 DB 에서
// products → checkout → order → paid 퍼널 이탈을 측정할 수 있게 한다.
const VALID_TYPES = ['view_item', 'begin_checkout'] as const
type FunnelEventType = (typeof VALID_TYPES)[number]

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const {
    event_type,
    session_id,
    product_id,
    product_slug,
    product_name,
    category,
    value,
    path,
    referrer,
  } = body

  if (!event_type || !VALID_TYPES.includes(event_type as FunnelEventType)) {
    return NextResponse.json({ error: '유효하지 않은 event_type' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { error } = await supabase.from('print_funnel_events').insert({
    event_type,
    session_id: typeof session_id === 'string' ? session_id : null,
    product_id: typeof product_id === 'string' ? product_id : null,
    product_slug: typeof product_slug === 'string' ? product_slug : null,
    product_name: typeof product_name === 'string' ? product_name : null,
    category: typeof category === 'string' ? category : null,
    value: typeof value === 'number' && Number.isFinite(value) ? value : null,
    path: typeof path === 'string' ? path : null,
    referrer: typeof referrer === 'string' ? referrer : null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
