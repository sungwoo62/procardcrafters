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
    .in('status', ['placing', 'placed'])
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
