import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { data: campaign, error: fetchErr } = await supabase
    .from('print_promotion_campaigns')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !campaign) {
    return NextResponse.json({ error: '캠페인을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (campaign.status !== 'draft') {
    return NextResponse.json(
      { error: `승인은 draft 상태에서만 가능합니다. 현재 상태: ${campaign.status}` },
      { status: 400 }
    )
  }

  const { error: updateErr } = await supabase
    .from('print_promotion_campaigns')
    .update({
      status: 'scheduled',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, newStatus: 'scheduled' })
}
