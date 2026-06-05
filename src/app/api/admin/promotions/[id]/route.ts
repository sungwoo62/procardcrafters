import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

const TIER_CAP: Record<string, number> = {
  top: 20,
  standard: 15,
  always_on: 10,
  bestseller: 10,
}

const EDITABLE_STATUSES = ['draft', 'scheduled', 'live']

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: campaign, error: fetchErr } = await supabase
    .from('print_promotion_campaigns')
    .select('*, calendar:print_promotion_calendar(default_discount_tier)')
    .eq('id', id)
    .single()

  if (fetchErr || !campaign) {
    return NextResponse.json({ error: '캠페인을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { status } = campaign as { status: string; calendar: { default_discount_tier: string } | null }

  if (!EDITABLE_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: '종료/취소된 캠페인은 편집할 수 없습니다.' },
      { status: 400 }
    )
  }

  const updateFields: Record<string, unknown> = {}

  // Headline + hero: editable in all non-terminal statuses
  if (body.headline_ko !== undefined) updateFields.headline_ko = String(body.headline_ko)
  if (body.headline_en !== undefined) updateFields.headline_en = String(body.headline_en)
  if (body.hero_image_url !== undefined) updateFields.hero_image_url = body.hero_image_url

  // Dates + status transitions: only for draft/scheduled
  if (status !== 'live') {
    if (body.promo_start_at !== undefined) updateFields.promo_start_at = body.promo_start_at
    if (body.promo_end_at !== undefined) updateFields.promo_end_at = body.promo_end_at
    if (body.peak_start_at !== undefined) updateFields.peak_start_at = body.peak_start_at
    if (body.order_cutoff_at !== undefined) updateFields.order_cutoff_at = body.order_cutoff_at

    // Status transitions: scheduled→live (Force Live Now), live→scheduled (Pause), live→ended (End Now)
    if (body.status !== undefined) {
      const allowed: Record<string, string[]> = {
        draft: ['scheduled', 'cancelled'],
        scheduled: ['live', 'cancelled'],
        live: ['scheduled', 'ended'],
      }
      const next = String(body.status)
      if (!allowed[status]?.includes(next)) {
        return NextResponse.json(
          { error: `${status} → ${next} 전환은 허용되지 않습니다.` },
          { status: 400 }
        )
      }
      updateFields.status = next
    }
  }

  if (Object.keys(updateFields).length > 0) {
    const { error: updateErr } = await supabase
      .from('print_promotion_campaigns')
      .update(updateFields)
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  // discount_pct: tier cap enforced, only for draft/scheduled
  if (body.discount_pct !== undefined && status !== 'live') {
    const tier = (campaign as unknown as { calendar: { default_discount_tier: string } | null }).calendar?.default_discount_tier ?? 'standard'
    const cap = TIER_CAP[tier] ?? 15
    const requested = Number(body.discount_pct)

    if (isNaN(requested) || requested <= 0 || requested > 100) {
      return NextResponse.json({ error: '할인율은 0~100 사이의 값이어야 합니다.' }, { status: 400 })
    }

    if (requested > cap) {
      return NextResponse.json(
        { error: `tier cap 위반: ${tier} 티어의 최대 할인율은 ${cap}%입니다.` },
        { status: 400 }
      )
    }

    // Update existing active promo code discount_pct
    const { data: existingCode } = await supabase
      .from('print_promo_codes')
      .select('id')
      .eq('campaign_id', id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (existingCode) {
      const { error: codeErr } = await supabase
        .from('print_promo_codes')
        .update({ discount_pct: requested })
        .eq('id', existingCode.id)

      if (codeErr) {
        return NextResponse.json({ error: codeErr.message }, { status: 500 })
      }
    }
  }

  // Product list: full replace, only for draft/scheduled
  if (body.products !== undefined && status !== 'live') {
    if (!Array.isArray(body.products)) {
      return NextResponse.json({ error: 'products는 배열이어야 합니다.' }, { status: 400 })
    }

    const { error: delErr } = await supabase
      .from('print_promotion_products')
      .delete()
      .eq('campaign_id', id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    if (body.products.length > 0) {
      const { error: insErr } = await supabase.from('print_promotion_products').insert(
        (body.products as string[]).map((slug, i) => ({
          campaign_id: id,
          product_slug: slug,
          sort_order: i,
        }))
      )

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
