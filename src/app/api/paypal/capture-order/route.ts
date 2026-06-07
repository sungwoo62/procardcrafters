import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { capturePaypalOrder } from '@/lib/paypal'
import { sendOrderStatusEmail, sendAdminNewOrderEmail } from '@/lib/email'

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

  // ── 캡처 전 권위 주문 조회 (소유권·멱등·금액 검증의 기준값) ──────────
  const { data: existing, error: fetchError } = await supabase
    .from('print_orders')
    .select('id, status, paypal_order_id, total_usd, order_number')
    .eq('id', orderId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // 소유권: 전달된 paypalOrderId가 이 주문에 바인딩된 값과 일치해야 함
  if (existing.paypal_order_id && existing.paypal_order_id !== paypalOrderId) {
    return NextResponse.json({ error: 'PayPal order does not match this order' }, { status: 409 })
  }

  // 멱등: 이미 결제 완료된 주문은 재캡처 없이 성공 반환 (이메일 재발송 방지)
  if (existing.status === 'paid') {
    return NextResponse.json({ orderNumber: existing.order_number, duplicate: true })
  }

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

  // 금액 대조: 실제 캡처 금액이 서버 권위 금액(total_usd)과 일치해야 함
  const expectedAmount = Number(existing.total_usd).toFixed(2)
  if (captureResult.amount != null && captureResult.amount !== expectedAmount) {
    return NextResponse.json(
      { error: `Captured amount mismatch (expected ${expectedAmount}, got ${captureResult.amount})` },
      { status: 409 }
    )
  }

  // 멱등 조건부 UPDATE: pending인 경우에만 paid 전이 (동시 캡처 TOCTOU 방어)
  const { data: order, error: updateError } = await supabase
    .from('print_orders')
    .update({ status: 'paid', payment_status: 'COMPLETED' })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('*, print_order_items(*)')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
  // 경쟁 캡처가 먼저 처리한 경우 — 멱등 성공 반환 (후처리/이메일 중복 방지)
  if (!order) {
    return NextResponse.json({ orderNumber: existing.order_number, duplicate: true })
  }

  const items = (order.print_order_items ?? []).map((i: { product_name_en: string; quantity: number; subtotal_usd: number }) => ({
    name: i.product_name_en,
    quantity: i.quantity,
    priceUsd: i.subtotal_usd,
  }))

  const emailData = {
    orderNumber: order.order_number,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    totalUsd: order.total_usd,
    items,
  }

  await Promise.allSettled([
    sendOrderStatusEmail('paid', emailData),
    sendAdminNewOrderEmail({ ...emailData, paymentMethod: 'PayPal' }),
  ])

  return NextResponse.json({ orderNumber: order.order_number })
}
