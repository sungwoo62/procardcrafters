import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import { Package, Printer, Truck, CheckCircle, XCircle, Clock, RotateCcw, ExternalLink } from 'lucide-react'
import type { PrintOrder, PrintOrderItem, PrintFile, OrderStatus } from '@/types/database'
import RejectedFileUpload from '@/components/RejectedFileUpload'
import DesignProofReview from '@/components/DesignProofReview'
import ReorderButton from '@/components/ReorderButton'
import ReviewButton from '@/components/ReviewButton'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ orderNumber: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params
  return { title: `Order ${orderNumber} — Procardcrafters` }
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="w-5 h-5" />,
    color: 'text-yellow-600 bg-yellow-50',
  },
  paid: {
    label: 'Paid · File Under Review',
    icon: <Package className="w-5 h-5" />,
    color: 'text-blue-600 bg-blue-50',
  },
  processing: {
    label: 'Printing',
    icon: <Printer className="w-5 h-5" />,
    color: 'text-indigo-600 bg-indigo-50',
  },
  shipped: {
    label: 'Shipped',
    icon: <Truck className="w-5 h-5" />,
    color: 'text-orange-600 bg-orange-50',
  },
  delivered: {
    label: 'Delivered',
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-green-600 bg-green-50',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-red-600 bg-red-50',
  },
  refunded: {
    label: 'Refunded',
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

  const { data: filesData } = await supabase
    .from('print_files')
    .select('id, original_filename, rejection_reason, status')
    .eq('order_id', order.id)
    .eq('status', 'rejected')

  const rejectedFiles = (filesData as Pick<PrintFile, 'id' | 'original_filename' | 'rejection_reason' | 'status'>[] | null) ?? []

  // 송장 (고객 노출용): 라벨 발급 이후만, tracking 번호 + carrier + ship/deliver 시각
  const { data: shipmentsData } = await supabase
    .from('print_shipments')
    .select('id, carrier, tracking_number, status, shipped_at, delivered_at')
    .eq('order_id', order.id)
    .in('status', ['label_created', 'in_transit', 'delivered'])
    .order('created_at', { ascending: false })

  interface CustomerShipment {
    id: string
    carrier: string
    tracking_number: string | null
    status: 'label_created' | 'in_transit' | 'delivered' | string
    shipped_at: string | null
    delivered_at: string | null
  }
  const shipments = (shipmentsData as CustomerShipment[] | null) ?? []

  function trackingUrl(carrier: string, tn: string): string | null {
    if (!tn) return null
    if (carrier === 'fedex') return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(tn)}`
    if (carrier === 'dhl')   return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(tn)}`
    if (carrier === 'ups')   return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`
    return null
  }

  const currentStatus = order.status
  const statusInfo = STATUS_CONFIG[currentStatus]
  const currentStepIndex = STATUS_STEPS.indexOf(currentStatus as OrderStatus)

  const isTerminal = currentStatus === 'cancelled' || currentStatus === 'refunded'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Order Number + Status */}
      <div>
        <p className="text-sm text-gray-500 mb-1">Order Number</p>
        <h1 className="text-2xl font-bold text-gray-900 font-mono mb-4">{order.order_number}</h1>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.color}`}>
          {statusInfo.icon}
          {statusInfo.label}
        </div>
      </div>

      {/* Progress Stepper */}
      {!isTerminal && (
        <div className="relative">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const isDone = currentStepIndex > idx
              const isCurrent = currentStepIndex === idx
              const info = STATUS_CONFIG[step]
              return (
                <div key={step} className="flex-1 flex flex-col items-center relative">
                  {/* Connector line (skip first) */}
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

      {/* Rejected file re-upload */}
      {rejectedFiles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">File Re-upload Required</h2>
          {rejectedFiles.map((file) => (
            <RejectedFileUpload key={file.id} file={file} orderNumber={order.order_number} />
          ))}
        </section>
      )}

      {/* Design Proof Review */}
      <DesignProofReview orderNumber={order.order_number} />

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
                {(currentStatus === 'shipped' || currentStatus === 'delivered') && (
                  <div className="mt-2">
                    <ReviewButton
                      orderId={order.id}
                      productId={item.product_id}
                      productName={item.product_name_en}
                      defaultName={order.shipping_name}
                    />
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
        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-blue-600">${order.total_usd.toFixed(2)} USD</span>
        </div>
      </section>

      {/* Tracking (라벨 발급 이후만 표시) */}
      {shipments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5" /> Tracking
          </h2>
          <div className="space-y-3">
            {shipments.map((sh) => {
              const url = sh.tracking_number ? trackingUrl(sh.carrier, sh.tracking_number) : null
              return (
                <div key={sh.id} className="border border-gray-200 rounded-xl p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="uppercase text-xs font-semibold text-gray-500">{sh.carrier}</span>
                      <span className="font-mono font-semibold text-gray-900">{sh.tracking_number ?? '—'}</span>
                    </div>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                      >
                        Track on {sh.carrier.toUpperCase()} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {(sh.shipped_at || sh.delivered_at) && (
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                      {sh.shipped_at && (
                        <span>Shipped: {new Date(sh.shipped_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}</span>
                      )}
                      {sh.delivered_at && (
                        <span>Delivered: {new Date(sh.delivered_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Shipping Information */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Shipping Information</h2>
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
          <p className="font-medium">{order.shipping_name}</p>
          <p>{order.shipping_address_line1}</p>
          {order.shipping_address_line2 && <p>{order.shipping_address_line2}</p>}
          <p>{order.shipping_city}{order.shipping_state ? `, ${order.shipping_state}` : ''} {order.shipping_postal_code}</p>
          <p>{order.shipping_country}</p>
        </div>
      </section>

      {/* 재주문 CTA */}
      <div className="flex justify-center">
        <ReorderButton
          orderNumber={order.order_number}
          variant="primary"
          label="Reorder this"
          className="px-5 py-2.5 text-base"
        />
      </div>

      {/* Order Date */}
      <p className="text-xs text-gray-400 text-center">
        Ordered: {new Date(order.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
      </p>
    </div>
  )
}
