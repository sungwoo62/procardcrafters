import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendOrderStatusEmail } from '@/lib/email'
import { OrderStatus } from '@/types/database'

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
}

function verifyAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_orders')
    .select('*, print_order_items(*, print_files(*))')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServerClient()

  let body: { status?: OrderStatus; notes?: string; trackingNumber?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다' }, { status: 400 })
  }

  const { data: order, error: fetchError } = await supabase
    .from('print_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}

  if (body.status) {
    const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? []
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `${order.status} → ${body.status} 상태 변경은 허용되지 않습니다` },
        { status: 400 }
      )
    }
    updates.status = body.status
  }

  if (body.notes !== undefined) updates.notes = body.notes
  if (body.trackingNumber !== undefined) updates.tracking_number = body.trackingNumber

  const { data: updated, error: updateError } = await supabase
    .from('print_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: `업데이트 실패: ${updateError?.message}` }, { status: 500 })
  }

  // 이메일 알림 발송 (상태 변경 시)
  if (body.status) {
    await sendOrderStatusEmail(body.status, {
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      totalUsd: order.total_usd,
      trackingNumber: body.trackingNumber,
    }).catch(() => {
      // 이메일 실패해도 API는 성공 반환
    })
  }

  return NextResponse.json(updated)
}
