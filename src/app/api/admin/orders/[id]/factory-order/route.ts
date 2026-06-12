import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { toCategoryCode } from '@/lib/factory-queue'
import { expandFinishingToSwadpiaFields } from '@/config/swadpia-finishing-fields'

type RouteContext = { params: Promise<{ id: string }> }

// GET: 공장 발주 상태 조회
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_factory_orders')
    .select('*')
    .eq('print_order_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ factoryOrders: data ?? [] })
}

// POST: 공장 발주 큐 등록 (수동 트리거)
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  // 주문 및 아이템/파일 조회
  const { data: order, error: orderError } = await supabase
    .from('print_orders')
    .select('*, print_order_items(*, print_files(*))')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (!['paid', 'processing'].includes(order.status)) {
    return NextResponse.json(
      { error: '결제 완료(paid/processing) 상태 주문만 발주 가능합니다.' },
      { status: 400 },
    )
  }

  // 이미 placed/placing 발주가 있으면 중복 방지
  const { data: existing } = await supabase
    .from('print_factory_orders')
    .select('id, status')
    .eq('print_order_id', id)
    .in('status', ['placing', 'placed', 'paid'])
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: '이미 발주가 진행 중 또는 완료된 주문입니다.', status: existing[0].status },
      { status: 409 },
    )
  }

  const items = order.print_order_items ?? []
  if (items.length === 0) {
    return NextResponse.json({ error: '주문 아이템이 없습니다.' }, { status: 400 })
  }

  // 아이템별 factory_order 생성
  const inserts = items.map((item: {
    id: string
    product_name_en: string
    selected_options: Record<string, string>
    quantity: number
    print_files?: { storage_path: string; status: string }[]
  }) => {
    const categoryCode = toCategoryCode(item.product_name_en ?? '')

    const approvedFile = item.print_files?.find(
      (f) => f.status === 'approved' || f.status === 'uploaded',
    )

    return {
      print_order_id: id,
      print_order_item_id: item.id,
      status: 'pending',
      category_code: categoryCode,
      // 후가공(finishing)을 성원 발주 폼 필드코드로 확장(OMO-2635). finishing 키 없으면 무영향.
      options_snapshot: expandFinishingToSwadpiaFields(item.selected_options ?? {}),
      quantity: item.quantity,
      file_url: approvedFile ? null : null, // resolved by script via storage_path
    }
  })

  const { data: created, error: insertError } = await supabase
    .from('print_factory_orders')
    .insert(inserts)
    .select()

  if (insertError) {
    return NextResponse.json({ error: `발주 등록 실패: ${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    message: `발주 큐 등록 완료 (${created?.length ?? 0}건). scripts/place-factory-orders.ts 실행 필요.`,
    factoryOrders: created,
  })
}

// PATCH: 발주 실원가 기록 (OMO-2830 교차검증)
// body: { factoryOrderId: string, actualCostKrw: number | null }
// 성원 실 결제금액(KRW)을 받아 주문 시점 환율(exchange_rate_krw_usd, KRW per USD)로
// USD 환산 스냅샷을 저장한다. actualCostKrw=null 이면 기록 해제.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body?.factoryOrderId) {
    return NextResponse.json({ error: 'factoryOrderId 필수' }, { status: 400 })
  }

  const supabase = createServerClient()

  // OMO-3018: 성원 발주 결제완료 표시/해제.
  // 사장님이 성원에서 결제까지 마친 발주를 placed → paid 로 전환한다.
  if (body.action === 'markSwadpiaPaid' || body.action === 'unmarkSwadpiaPaid') {
    const marking = body.action === 'markSwadpiaPaid'

    // 현재 상태 확인 (placed ↔ paid 전이만 허용)
    const { data: current } = await supabase
      .from('print_factory_orders')
      .select('id, status')
      .eq('id', body.factoryOrderId)
      .eq('print_order_id', id)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ error: '발주를 찾을 수 없습니다.' }, { status: 404 })
    }
    const allowedFrom = marking ? 'placed' : 'paid'
    if (current.status !== allowedFrom) {
      return NextResponse.json(
        {
          error: marking
            ? '발주 완료(placed) 상태만 결제완료로 표시할 수 있습니다.'
            : '결제완료(paid) 상태만 해제할 수 있습니다.',
          status: current.status,
        },
        { status: 409 },
      )
    }

    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('print_factory_orders')
      .update({
        status: marking ? 'paid' : 'placed',
        swadpia_paid_at: marking ? nowIso : null,
        swadpia_paid_by: marking ? (user.email ?? 'admin') : null,
        updated_at: nowIso,
      })
      .eq('id', body.factoryOrderId)
      .eq('print_order_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 감사 로그: 성원 결제완료 표시/해제 타임라인
    await supabase.from('print_order_events').insert({
      order_id: id,
      event_type: 'status_change',
      old_value: marking ? '성원 발주완료' : '성원 결제완료',
      new_value: marking ? '성원 결제완료' : '성원 발주완료(결제 해제)',
      metadata: {
        factory_order_id: body.factoryOrderId,
        swadpia_order_number: data.swadpia_order_number ?? null,
      },
      actor: user.email ?? 'admin',
    })

    return NextResponse.json({ factoryOrder: data })
  }

  const krwRaw = body.actualCostKrw
  const clearing = krwRaw === null || krwRaw === undefined || krwRaw === ''
  const krw = clearing ? null : Number(krwRaw)
  if (!clearing && (!Number.isFinite(krw) || (krw as number) < 0)) {
    return NextResponse.json({ error: '실원가(KRW)는 0 이상의 숫자여야 합니다.' }, { status: 400 })
  }

  // 환율: 주문 시점 캡처값(KRW per USD). 없으면 1300 폴백(promotion-engine 동일 규칙).
  const { data: order } = await supabase
    .from('print_orders')
    .select('exchange_rate_krw_usd')
    .eq('id', id)
    .maybeSingle()
  const rate = Number(order?.exchange_rate_krw_usd ?? 1300)
  const usd = clearing ? null : Math.round(((krw as number) / rate) * 100) / 100

  const update = {
    actual_cost_krw: krw,
    actual_cost_usd: usd,
    cost_recorded_at: clearing ? null : new Date().toISOString(),
    cost_recorded_by: clearing ? null : (user.email ?? 'admin'),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('print_factory_orders')
    .update(update)
    .eq('id', body.factoryOrderId)
    .eq('print_order_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ factoryOrder: data })
}

// DELETE: 발주 취소 (pending 상태만)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { error } = await supabase
    .from('print_factory_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('print_order_id', id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: '발주 취소 완료' })
}
