import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import type { PrintOrder, PrintOrderItem } from '@/types/database'
import ReorderPayClient from './ReorderPayClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ orderNumber: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params
  return { title: `Pay for Order ${orderNumber} — Procardcrafters` }
}

export default async function ReorderPayPage({ params }: Props) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  const { data: orderData } = await supabase
    .from('print_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .single()

  if (!orderData) notFound()

  const order = orderData as PrintOrder & {
    paypal_order_id: string | null
    payment_provider: string | null
  }

  // 결제 대기(pending) + PayPal 주문이 준비된 경우에만 결제 진입 가능.
  // 이미 결제됐거나 PayPal 주문이 없으면 주문 상세로 돌려보낸다.
  if (order.status !== 'pending' || !order.paypal_order_id) {
    redirect(`/orders/${orderNumber}`)
  }

  const { data: itemsData } = await supabase
    .from('print_order_items')
    .select('*')
    .eq('order_id', order.id)

  const items = (itemsData as PrintOrderItem[] | null) ?? []
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <p className="text-sm text-gray-500 mb-1">Complete Your Reorder</p>
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.order_number}</h1>
      </div>

      {/* Order Items */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-4 flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{item.product_name_en}</p>
                {Object.keys(item.selected_options).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(item.selected_options).map(([type, value]) => (
                      <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {type}: {value as string}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="font-semibold text-gray-900 flex-shrink-0">${item.subtotal_usd.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Price Summary */}
      <section className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>${order.subtotal_usd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping</span>
          <span>${order.shipping_usd.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-blue-600">${order.total_usd.toFixed(2)} USD</span>
        </div>
      </section>

      {/* PayPal Payment */}
      <ReorderPayClient
        orderNumber={order.order_number}
        orderId={order.id}
        paypalOrderId={order.paypal_order_id}
        totalUsd={order.total_usd}
        clientId={clientId}
      />
    </div>
  )
}
