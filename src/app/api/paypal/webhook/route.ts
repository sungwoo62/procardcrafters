import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { verifyPaypalWebhookSignature, capturePaypalOrder } from '@/lib/paypal'
import { markPrintOrderPaid } from '@/lib/order-payment'

// OMO-2909: PayPal 서버 웹훅 — 결제-주문상태 정합성 안전망.
// 클라이언트 onApprove → capture-order 경로가 브라우저 종료 등으로 끊겨도
// 서버가 PayPal 로부터 직접 이벤트를 받아 주문을 멱등하게 paid 로 전이한다.
//
// 처리 이벤트:
//  - PAYMENT.CAPTURE.COMPLETED : 캡처 완료 → 즉시 paid (주 안전망)
//  - CHECKOUT.ORDER.APPROVED   : 승인됐으나 캡처 미완 → 서버측 캡처 시도 후 paid
//
// 환경변수: PAYPAL_WEBHOOK_ID (Developer Dashboard 웹훅 등록 시 발급).

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  let verified: boolean
  try {
    verified = await verifyPaypalWebhookSignature(
      {
        authAlgo: request.headers.get('paypal-auth-algo'),
        certUrl: request.headers.get('paypal-cert-url'),
        transmissionId: request.headers.get('paypal-transmission-id'),
        transmissionSig: request.headers.get('paypal-transmission-sig'),
        transmissionTime: request.headers.get('paypal-transmission-time'),
      },
      rawBody,
    )
  } catch (err) {
    // PAYPAL_WEBHOOK_ID 미설정 등 구성 오류 — 위조 이벤트 차단을 위해 거부.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  if (!verified) {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 401 })
  }

  let event: {
    event_type?: string
    resource?: {
      id?: string
      supplementary_data?: { related_ids?: { order_id?: string } }
    }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServerClient()
  const eventType = event.event_type

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    // 캡처 리소스에는 상위 PayPal order id 가 supplementary_data 에 담긴다.
    const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id
    if (!paypalOrderId) {
      // 매칭 불가 — 200 으로 ack 해 PayPal 재시도 폭주를 막는다.
      return NextResponse.json({ received: true, matched: false })
    }
    const result = await markPrintOrderPaid(
      supabase,
      { paypalOrderId },
      { paymentMethod: 'PayPal' },
    )
    return NextResponse.json({
      received: true,
      matched: result.orderNumber !== null,
      transitioned: result.transitioned,
    })
  }

  if (eventType === 'CHECKOUT.ORDER.APPROVED') {
    const paypalOrderId = event.resource?.id
    if (!paypalOrderId) {
      return NextResponse.json({ received: true, matched: false })
    }

    // 승인됐으나 우리 캡처가 안 됐을 수 있다(브라우저 종료). 주문이 아직 paid 가
    // 아니면 서버측 캡처를 시도한다. 이미 캡처됐다면 PayPal 이 422 를 반환하므로
    // PAYMENT.CAPTURE.COMPLETED 웹훅이 paid 전이를 담당한다(여기선 무시).
    const { data: order } = await supabase
      .from('print_orders')
      .select('id, status')
      .eq('paypal_order_id', paypalOrderId)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ received: true, matched: false })
    }
    if (order.status === 'paid') {
      return NextResponse.json({ received: true, matched: true, transitioned: false })
    }

    try {
      const capture = await capturePaypalOrder(paypalOrderId)
      if (capture.status === 'COMPLETED') {
        const result = await markPrintOrderPaid(
          supabase,
          { paypalOrderId, orderId: order.id },
          { paymentMethod: 'PayPal' },
        )
        return NextResponse.json({ received: true, matched: true, transitioned: result.transitioned })
      }
    } catch {
      // 이미 캡처됨(ORDER_ALREADY_CAPTURED) 또는 일시 오류 —
      // CAPTURE.COMPLETED 웹훅에 위임. ack 만 한다.
    }
    return NextResponse.json({ received: true, matched: true, transitioned: false })
  }

  // 미처리 이벤트 타입 — ack.
  return NextResponse.json({ received: true, ignored: eventType ?? 'unknown' })
}
