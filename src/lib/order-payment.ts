import type { SupabaseClient } from '@supabase/supabase-js'
import { sendOrderStatusEmail, sendAdminNewOrderEmail } from '@/lib/email'

// OMO-2909: 결제-주문상태 정합성. 캡처 경로(클라이언트 onApprove → capture-order)와
// 서버 웹훅(paypal/webhook) 양쪽이 공유하는 멱등 paid 전이 + 알림 헬퍼.
// `status='paid'` 가 아닌 경우에만 전이하여 이메일 중복 발송을 막는다.

interface OrderMatch {
  orderId?: string
  paypalOrderId?: string
}

interface MarkPaidOptions {
  paymentMethod: 'PayPal' | 'Stripe'
  paymentStatus?: string
  stripePaymentIntentId?: string
}

interface OrderRow {
  order_number: string
  status: string
  customer_email: string
  customer_name: string
  total_usd: number
  print_order_items?: {
    product_name_en: string
    quantity: number
    subtotal_usd: number
  }[]
}

export interface MarkPaidResult {
  // 이번 호출에서 pending→paid 로 실제 전이가 발생했는지(이메일 발송 여부와 동일).
  transitioned: boolean
  // 주문이 존재하면 항상 채워진다(이미 paid 였어도 조회 반환). 매칭 실패 시 null.
  orderNumber: string | null
}

export async function markPrintOrderPaid(
  supabase: SupabaseClient,
  match: OrderMatch,
  opts: MarkPaidOptions,
): Promise<MarkPaidResult> {
  if (!match.orderId && !match.paypalOrderId) {
    throw new Error('markPrintOrderPaid requires orderId or paypalOrderId')
  }

  const updatePayload: Record<string, string> = {
    status: 'paid',
    payment_status: opts.paymentStatus ?? 'COMPLETED',
  }
  if (opts.stripePaymentIntentId) {
    updatePayload.stripe_payment_intent_id = opts.stripePaymentIntentId
  }

  // 멱등 가드: 이미 paid 인 주문은 0행 업데이트 → 중복 알림 차단.
  let updateQuery = supabase.from('print_orders').update(updatePayload).neq('status', 'paid')
  if (match.orderId) updateQuery = updateQuery.eq('id', match.orderId)
  if (match.paypalOrderId) updateQuery = updateQuery.eq('paypal_order_id', match.paypalOrderId)
  const { data: order } = await updateQuery
    .select('order_number, status, customer_email, customer_name, total_usd, print_order_items(*)')
    .maybeSingle()

  if (order) {
    const row = order as OrderRow
    const items = (row.print_order_items ?? []).map((i) => ({
      name: i.product_name_en,
      quantity: i.quantity,
      priceUsd: i.subtotal_usd,
    }))
    const emailData = {
      orderNumber: row.order_number,
      customerEmail: row.customer_email,
      customerName: row.customer_name,
      totalUsd: row.total_usd,
      items,
    }
    await Promise.allSettled([
      sendOrderStatusEmail('paid', emailData),
      sendAdminNewOrderEmail({ ...emailData, paymentMethod: opts.paymentMethod }),
    ])
    return { transitioned: true, orderNumber: row.order_number }
  }

  // 전이 없음(이미 paid 거나 매칭 실패) — 주문번호만 조회해 호출자에 반환.
  let lookupQuery = supabase.from('print_orders').select('order_number')
  if (match.orderId) lookupQuery = lookupQuery.eq('id', match.orderId)
  if (match.paypalOrderId) lookupQuery = lookupQuery.eq('paypal_order_id', match.paypalOrderId)
  const { data: existing } = await lookupQuery.maybeSingle()
  return {
    transitioned: false,
    orderNumber: (existing as { order_number: string } | null)?.order_number ?? null,
  }
}
