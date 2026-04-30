'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { OrderStatus } from '@/types/database'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  paid: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
}

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
}

interface OrderItem {
  id: string
  product_name_en: string
  selected_options: Record<string, string>
  quantity: number
  unit_price_usd: number
  subtotal_usd: number
  print_files?: { id: string; original_filename: string; storage_path: string }[]
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  shipping_name: string
  shipping_address_line1: string
  shipping_address_line2: string | null
  shipping_city: string
  shipping_state: string | null
  shipping_country: string
  shipping_postal_code: string
  subtotal_usd: number
  shipping_usd: number
  total_usd: number
  stripe_payment_intent_id: string | null
  status: OrderStatus
  notes: string | null
  created_at: string
  print_order_items: OrderItem[]
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const secret = searchParams.get('secret') ?? ''

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [updateMsg, setUpdateMsg] = useState('')

  useEffect(() => {
    async function fetchOrder() {
      const res = await fetch(`/api/admin/orders/${id}`, {
        headers: { 'x-admin-secret': secret },
      })
      if (!res.ok) {
        setError('Failed to load order.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setOrder(data)
      setNotes(data.notes ?? '')
      setLoading(false)
    }
    fetchOrder()
  }, [id, secret])

  async function handleUpdate() {
    if (!newStatus && !notes && !trackingNumber) return
    setUpdating(true)
    setUpdateMsg('')

    const body: Record<string, string> = {}
    if (newStatus) body.status = newStatus
    if (notes !== (order?.notes ?? '')) body.notes = notes
    if (trackingNumber) body.trackingNumber = trackingNumber

    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const updated = await res.json()
    if (!res.ok) {
      setUpdateMsg(`Error: ${updated.error}`)
    } else {
      setOrder((prev) => prev ? { ...prev, ...updated } : updated)
      setNewStatus('')
      setTrackingNumber('')
      setUpdateMsg('Updated successfully')
    }
    setUpdating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>
  if (error || !order) return <div className="p-8 text-center text-red-500">{error || 'Order not found'}</div>

  const nextOptions = NEXT_STATUSES[order.status] ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <a href="/admin/orders" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
              ← Back to Orders
            </a>
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer info */}
          <div className="bg-white rounded-lg shadow p-5 space-y-2">
            <h2 className="font-semibold text-gray-700 mb-3">Customer</h2>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-sm text-gray-500">{order.customer_email}</p>
            {order.customer_phone && <p className="text-sm text-gray-500">{order.customer_phone}</p>}
          </div>

          {/* Shipping info */}
          <div className="bg-white rounded-lg shadow p-5 space-y-2">
            <h2 className="font-semibold text-gray-700 mb-3">Shipping Address</h2>
            <p className="font-medium">{order.shipping_name}</p>
            <p className="text-sm text-gray-500">{order.shipping_address_line1}</p>
            {order.shipping_address_line2 && <p className="text-sm text-gray-500">{order.shipping_address_line2}</p>}
            <p className="text-sm text-gray-500">
              {order.shipping_city}{order.shipping_state ? `, ${order.shipping_state}` : ''} {order.shipping_postal_code}
            </p>
            <p className="text-sm text-gray-500">{order.shipping_country}</p>
          </div>
        </div>

        {/* Order items */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Order Items</h2>
          <div className="space-y-4">
            {order.print_order_items.map((item) => (
              <div key={item.id} className="border rounded p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{item.product_name_en}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {Object.entries(item.selected_options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium">${item.subtotal_usd.toFixed(2)}</p>
                </div>
                {item.print_files && item.print_files.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-gray-500 mb-1">Files:</p>
                    {item.print_files.map((f) => (
                      <p key={f.id} className="text-xs text-blue-600">{f.original_filename}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>${order.subtotal_usd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Shipping</span>
              <span>${order.shipping_usd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>${order.total_usd.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Status update */}
        {nextOptions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Update Status</h2>
            <div className="flex gap-2 flex-wrap">
              {nextOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                    newStatus === s ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
                  }`}
                >
                  → {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {newStatus === 'shipped' && (
              <input
                type="text"
                placeholder="Tracking number (optional)"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            )}
            <textarea
              placeholder="Internal notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpdate}
                disabled={updating || (!newStatus && notes === (order.notes ?? ''))}
                className="px-4 py-2 bg-black text-white rounded text-sm font-medium disabled:opacity-40 hover:bg-gray-800"
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
              {updateMsg && (
                <span className={`text-sm ${updateMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                  {updateMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Payment info */}
        {order.stripe_payment_intent_id && (
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-700 mb-2">Payment</h2>
            <p className="text-sm text-gray-500 font-mono">{order.stripe_payment_intent_id}</p>
          </div>
        )}
      </div>
    </div>
  )
}
