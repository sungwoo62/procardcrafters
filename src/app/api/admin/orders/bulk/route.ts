import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { sendOrderStatusEmail } from '@/lib/email'
import { OrderStatus } from '@/types/database'


const BULK_ALLOWED_TARGET: OrderStatus[] = [
  'paid', 'processing', 'shipped', 'delivered', 'cancelled',
]

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  let body: { ids: string[]; status: OrderStatus; trackingNumber?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
  }

  const { ids, status, trackingNumber } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Order ID list required' }, { status: 400 })
  }

  if (!BULK_ALLOWED_TARGET.includes(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
  }

  const supabase = createServerClient()

  const updates: Record<string, unknown> = { status }
  if (trackingNumber) updates.tracking_number = trackingNumber

  const { data, error } = await supabase
    .from('print_orders')
    .update(updates)
    .in('id', ids)
    .select('id, order_number, status, customer_email, customer_name, total_usd')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data?.length) {
    await Promise.allSettled(
      data.map((order) =>
        sendOrderStatusEmail(status, {
          orderNumber: order.order_number,
          customerEmail: order.customer_email,
          customerName: order.customer_name,
          totalUsd: order.total_usd,
          trackingNumber,
        })
      )
    )
  }

  return NextResponse.json({ updated: data?.length ?? 0, orders: data })
}
