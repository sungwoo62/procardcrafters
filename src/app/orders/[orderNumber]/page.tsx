import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import { Package, Printer, Truck, CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react'
import type { PrintOrder, PrintOrderItem, OrderStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ orderNumber: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params
  return { title: `주문 ${orderNumber} — Procardcrafters` }
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: {
    label: '결제 대기',
    icon: <Clock className="w-5 h-5" />,
    color: 'text-yellow-600 bg-yellow-50',
  },
  paid: {
    label: '결제 완료 · 파일 검토 중',
    icon: <Package className="w-5 h-5" />,
    color: 'text-blue-600 bg-blue-50',
  },
  processing: {
    label: '인쇄 진행 중',
    icon: <Printer className="w-5 h-5" />,
    color: 'text-indigo-600 bg-indigo-50',
  },
  shipped: {
    label: '배송 중',
    icon: <Truck className="w-5 h-5" />,
    color: 'text-orange-600 bg-orange-50',
  },
  delivered: {
    label: '배송 완료',
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-green-600 bg-green-50',
  },
  cancelled: {
    label: '취소됨',
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-red-600 bg-red-50',
  },
  refunded: {
    label: '환불 완료',
    icon: <RotateCcw className="w-5 h-5" />,
    color: 'text-gray-600 bg-gray-100',
  },
}

const STATUS_STEPS: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'delivered']

export default async function OrderTrackingPage({ params }: Props) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  const { data: orderData } = await supabase
    .from('print_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .single()

  if (!orderData) notFound()

  const order = orderData as PrintOrder

  const { data: itemsData } = await supabase
    .from('print_order_items')
    .select('*')
    .eq('order_id', order.id)

  const items = (itemsData as PrintOrderItem[] | null) ?? []

  const currentStatus = order.status
  const statusInfo = STATUS_CONFIG[currentStatus]
  const currentStepIndex = STATUS_STEPS.indexOf(currentStatus as OrderStatus)

  const isTerminal = currentStatus === 'cancelled' || currentStatus === 'refunded'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* 주문 번호 + 상태 */}
      <div>
        <p className="text-sm text-gray-500 mb-1">주문 번호</p>
        <h1 className="text-2xl font-bold text-gray-900 font-mono mb-4">{order.order_number}</h1>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.color}`}>
          {statusInfo.icon}
          {statusInfo.label}
        </div>
      </div>

      {/* 진행 상태 스텝퍼 */}
      {!isTerminal && (
        <div className="relative">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const isDone = currentStepIndex > idx
              const isCurrent = currentStepIndex === idx
              const info = STATUS_CONFIG[step]
              return (
                <div key={step} className="flex-1 flex flex-col items-center relative">
                  {/* 연결선 (첫 번째 제외) */}
                  {idx > 0 && (
                    <div
                      className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                        isDone ? 'bg-blue-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isDone
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : isCurrent
                        ? 'bg-white border-blue-500 text-blue-500'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {isDone ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <p className={`mt-2 text-xs text-center leading-tight ${isCurrent ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                    {info.label.split(' · ')[0]}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 주문 상품 목록 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">주문 상품</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-4 flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900">{item.product_name_en}</p>
                <p className="text-sm text-gray-500">{item.product_name_ko}</p>
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
              <p className="font-semibold text-gray-900">${item.subtotal_usd.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 금액 요약 */}
      <section className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>상품 합계</span>
          <span>${order.subtotal_usd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>배송비</span>
          <span>${order.shipping_usd.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
          <span>총 결제 금액</span>
          <span className="text-blue-600">${order.total_usd.toFixed(2)} USD</span>
        </div>
      </section>

      {/* 배송 정보 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">배송 정보</h2>
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
          <p className="font-medium">{order.shipping_name}</p>
          <p>{order.shipping_address_line1}</p>
          {order.shipping_address_line2 && <p>{order.shipping_address_line2}</p>}
          <p>{order.shipping_city}{order.shipping_state ? `, ${order.shipping_state}` : ''} {order.shipping_postal_code}</p>
          <p>{order.shipping_country}</p>
        </div>
      </section>

      {/* 주문 일시 */}
      <p className="text-xs text-gray-400 text-center">
        주문일: {new Date(order.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
      </p>
    </div>
  )
}
