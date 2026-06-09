import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { sendOrderStatusEmail, sendAdminStatusChangeEmail } from '@/lib/email'
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


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_orders')
    .select('*, print_order_items(*, print_files(*)), print_order_events(*)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  let body: { status?: OrderStatus; notes?: string; trackingNumber?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
  }

  const { data: order, error: fetchError } = await supabase
    .from('print_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}

  if (body.status) {
    const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? []
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `${order.status} → ${body.status} status transition not allowed` },
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
    return NextResponse.json({ error: `Update failed: ${updateError?.message}` }, { status: 500 })
  }

  if (body.status) {
    const emailData = {
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      totalUsd: order.total_usd,
      trackingNumber: body.trackingNumber,
    }

    await Promise.allSettled([
      sendOrderStatusEmail(body.status, emailData),
      sendAdminStatusChangeEmail(body.status, { ...emailData, changedBy: 'Admin' }),
    ])
  }

  return NextResponse.json(updated)
}
