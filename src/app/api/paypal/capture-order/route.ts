import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { capturePaypalOrder } from '@/lib/paypal'
import { markPrintOrderPaid } from '@/lib/order-payment'

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
    // OMO-2909: 캡처 실패/타임아웃 — 결제가 실제 완료됐는지 불확실하므로 주문을
    // PENDING_REVIEW 로 표시해 운영 가시성을 확보한다. 서버 웹훅
    // (PAYMENT.CAPTURE.COMPLETED)이 도착하면 멱등하게 paid 로 정정된다.
    await supabase
      .from('print_orders')
      .update({ payment_status: 'PENDING_REVIEW' })
      .eq('id', orderId)
      .neq('status', 'paid')
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  if (captureResult.status !== 'COMPLETED') {
    await supabase
      .from('print_orders')
      .update({ payment_status: 'PENDING_REVIEW' })
      .eq('id', orderId)
      .neq('status', 'paid')
    return NextResponse.json(
      { error: `Payment incomplete: ${captureResult.status}` },
      { status: 402 }
    )
  }

  // 멱등 전이(이미 웹훅이 paid 처리했어도 안전) + paid 알림.
  const result = await markPrintOrderPaid(
    supabase,
    { orderId, paypalOrderId },
    { paymentMethod: 'PayPal' },
  )

  if (!result.orderNumber) {
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }

  return NextResponse.json({ orderNumber: result.orderNumber })
}
