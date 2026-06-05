import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/admin/promo-codes/[id]
// 프로모 코드 상세 + 잠금 이력 + 1h/전체 사용 통계
export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const [
    { data: code, error: codeErr },
    { data: lockHistory },
  ] = await Promise.all([
    supabase
      .from('print_promo_codes')
      .select('*, campaign:print_promotion_campaigns(id, headline_ko, status)')
      .eq('id', id)
      .single(),
    supabase
      .from('print_promo_code_lock_history')
      .select('*')
      .eq('code_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (codeErr || !code) {
    return NextResponse.json({ error: '코드를 찾을 수 없습니다.' }, { status: 404 })
  }

  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const [{ count: redemptions1h }, { count: redemptionsTotal }] = await Promise.all([
    supabase
      .from('print_promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', id)
      .gte('applied_at', since1h),
    supabase
      .from('print_promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', id),
  ])

  return NextResponse.json({
    code,
    lockHistory: lockHistory ?? [],
    stats: {
      redemptions_1h: redemptions1h ?? 0,
      redemptions_total: redemptionsTotal ?? 0,
    },
  })
}

// PATCH /api/admin/promo-codes/[id]
// body: { action: 'lock' | 'unlock' }
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params

  let body: { action: 'lock' | 'unlock' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!['lock', 'unlock'].includes(body.action)) {
    return NextResponse.json(
      { error: 'action은 lock 또는 unlock 이어야 합니다.' },
      { status: 400 },
    )
  }

  const newStatus = body.action === 'lock' ? 'locked' : 'active'
  const historyAction = body.action === 'lock' ? 'locked' : 'unlocked'
  const reason = body.action === 'lock' ? 'admin_manual_lock' : 'admin_manual_unlock'

  const supabase = createServerClient()

  const { error: updateErr } = await supabase
    .from('print_promo_codes')
    .update({ status: newStatus })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json(
      { error: `상태 업데이트 실패: ${updateErr.message}` },
      { status: 500 },
    )
  }

  await supabase.from('print_promo_code_lock_history').insert({
    code_id: id,
    action: historyAction,
    reason,
    context: null,
  })

  return NextResponse.json({ ok: true, status: newStatus })
}
