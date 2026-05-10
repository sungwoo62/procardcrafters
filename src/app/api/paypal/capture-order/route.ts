import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { capturePaypalOrder } from '@/lib/paypal'
import { sendOrderStatusEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  let body: { paypalOrderId: string; orderId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
  }

  const { paypalOrderId, orderId } = body

  if (!paypalOrderId || !orderId) {
    return NextResponse.json({ error: 'paypalOrderId and orderId are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  let captureResult: { status: string; payerId: string | null; amount: string | null }
  try {
    captureResult = await capturePaypalOrder(paypalOrderId)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  if (captureResult.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: `Payment incomplete: ${captureResult.status}` },
      { status: 402 }
    )
  }

  const { data: order, error: updateError } = await supabase
    .from('print_orders')
    .update({ status: 'paid', payment_status: 'COMPLETED' })
    .eq('id', orderId)
    .select()
    .single()

  if (updateError || !order) {
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
  await sendOrderStatusEmail('paid', {
    orderNumber: order.order_number,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    totalUsd: order.total_usd,
  }).catch(() => {})

  return NextResponse.json({ orderNumber: order.order_number })
}
