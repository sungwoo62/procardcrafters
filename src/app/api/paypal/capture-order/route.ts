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

  // PayPal 결제 캡처
  let captureResult: { status: string; payerId: string | null; amount: string | null }
  try {
    captureResult = await capturePaypalOrder(paypalOrderId)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  if (captureResult.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: `결제 미완료: ${captureResult.status}` },
      { status: 402 }
    )
  }

  // DB 상태 업데이트
  const { data: order, error: updateError } = await supabase
    .from('print_orders')
    .update({ status: 'paid', payment_status: 'COMPLETED' })
    .eq('id', orderId)
    .select()
    .single()

  if (updateError || !order) {
    return NextResponse.json({ error: '주문 상태 업데이트 실패' }, { status: 500 })
  }

  // 이메일 알림 (실패해도 무시)
  await sendOrderStatusEmail('paid', {
    orderNumber: order.order_number,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    totalUsd: order.total_usd,
  }).catch(() => {})

  return NextResponse.json({ orderNumber: order.order_number })
}
