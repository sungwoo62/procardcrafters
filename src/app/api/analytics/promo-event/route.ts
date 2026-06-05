import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const VALID_TYPES = [
  'promo_impression',
  'promo_click',
  'promo_code_view',
  'promo_add_to_cart',
  'promo_checkout_start',
  'promo_code_redeem',
] as const

const VALID_SURFACES = ['megamenu', 'hero', 'toast', 'lp', 'unknown'] as const

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { event_type, campaign_id, code, surface, user_id, session_id, product_slug } = body

  if (!event_type || !VALID_TYPES.includes(event_type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: '유효하지 않은 event_type' }, { status: 400 })
  }
  if (!campaign_id || typeof campaign_id !== 'string') {
    return NextResponse.json({ error: 'campaign_id 필수' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { error } = await supabase.from('print_promotion_events').insert({
    campaign_id,
    event_type,
    surface: VALID_SURFACES.includes(surface as (typeof VALID_SURFACES)[number])
      ? surface
      : 'unknown',
    code: code ?? null,
    user_id: user_id ?? null,
    session_id: session_id ?? null,
    product_slug: product_slug ?? null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
