'use client'


// OMO-2629: 인증/관리자 페이지는 인증 게이트·비SEO → 정적 프리렌더 제외(빌드 안정성).
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { OrderStatus, DesignProofStatus } from '@/types/database'
import type { PrintOrderEvent, OrderEventType } from '@/lib/order-events'
import type { FactoryOrderRecord as BaseFactoryOrderRecord } from '@/lib/swadpia-order'
import { OrderShipments } from '@/components/OrderShipments'

type FactoryOrderRecord = BaseFactoryOrderRecord & { checkout_url?: string | null }

interface DesignProofRecord {
  id: string
  order_id: string
  storage_path: string
  original_filename: string
  file_size_bytes: number | null
  mime_type: string | null
  admin_note: string | null
  status: DesignProofStatus
  customer_comment: string | null
  version: number
  uploaded_by: string
  uploaded_at: string
  responded_at: string | null
  signed_url: string | null
}

const PROOF_STATUS_LABELS: Record<DesignProofStatus, string> = {
  pending: '고객 확인 대기',
  approved: '고객 승인 완료',
  revision_requested: '수정 요청',
}

const PROOF_STATUS_COLORS: Record<DesignProofStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  revision_requested: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '대기',
  paid: '결제완료',
  processing: '처리중',
  shipped: '발송됨',
  delivered: '배송완료',
  cancelled: '취소됨',
  refunded: '환불됨',
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
  print_order_events: PrintOrderEvent[]
}

const EVENT_TYPE_LABELS: Record<OrderEventType, string> = {
  status_change: '상태 변경',
  email_sent: '이메일 발송',
  payment_received: '결제 완료',
  payment_failed: '결제 실패',
  fraud_alert: '사기 경보',
  file_uploaded: '파일 업로드',
  file_approved: '파일 승인',
  file_rejected: '파일 거절',
  shipment_created: '송장 생성',
  shipment_label_created: '라벨 발급',
  shipped: '발송',
  delivered: '배송 완료',
  reorder: '재주문',
}

const EVENT_TYPE_COLORS: Record<OrderEventType, string> = {
  status_change: 'bg-blue-100 text-blue-700',
  email_sent: 'bg-gray-100 text-gray-600',
  payment_received: 'bg-green-100 text-green-700',
  payment_failed: 'bg-red-100 text-red-700',
  fraud_alert: 'bg-red-100 text-red-700',
  file_uploaded: 'bg-purple-100 text-purple-700',
  file_approved: 'bg-green-100 text-green-700',
  file_rejected: 'bg-orange-100 text-orange-700',
  shipment_created: 'bg-indigo-100 text-indigo-700',
  shipment_label_created: 'bg-orange-100 text-orange-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  reorder: 'bg-blue-100 text-blue-700',
}

const EVENT_TYPE_DOTS: Record<OrderEventType, string> = {
  status_change: 'bg-blue-500',
  email_sent: 'bg-gray-400',
  payment_received: 'bg-green-500',
  payment_failed: 'bg-red-500',
  fraud_alert: 'bg-red-600',
  file_uploaded: 'bg-purple-500',
  file_approved: 'bg-green-500',
  file_rejected: 'bg-orange-500',
  shipment_created: 'bg-indigo-500',
  shipment_label_created: 'bg-orange-500',
  shipped: 'bg-purple-500',
  delivered: 'bg-green-500',
  reorder: 'bg-blue-500',
}

function formatEventTime(ts: string) {
  return new Date(ts).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const FACTORY_STATUS_LABELS: Record<string, string> = {
  pending:   '발주 대기',
  placing:   '발주 중',
  placed:    '발주 완료',
  failed:    '발주 실패',
  cancelled: '취소',
}

const FACTORY_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  placing:   'bg-yellow-100 text-yellow-700',
  placed:    'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [updateMsg, setUpdateMsg] = useState('')
  const [factoryOrders, setFactoryOrders] = useState<FactoryOrderRecord[]>([])
  const [factoryLoading, setFactoryLoading] = useState(false)
  const [factoryMsg, setFactoryMsg] = useState('')

  const [designProofs, setDesignProofs] = useState<DesignProofRecord[]>([])
  const [proofUploading, setProofUploading] = useState(false)
  const [proofMsg, setProofMsg] = useState('')
  const [proofAdminNote, setProofAdminNote] = useState('')
  const proofFileRef = useRef<HTMLInputElement>(null)

  const fetchFactoryOrders = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${id}/factory-order`)
    if (res.ok) {
      const data = await res.json()
      setFactoryOrders(data.factoryOrders ?? [])
    }
  }, [id])

  const fetchDesignProofs = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${id}/proof`)
    if (res.ok) {
      const data = await res.json()
      setDesignProofs(data.proofs ?? [])
    }
  }, [id])

  useEffect(() => {
    async function fetchOrder() {
      const res = await fetch(`/api/admin/orders/${id}`)
      if (!res.ok) {
        setError('주문을 불러올 수 없습니다.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setOrder(data)
      setNotes(data.notes ?? '')
      setLoading(false)
    }
    fetchOrder()
    fetchFactoryOrders()
    fetchDesignProofs()
  }, [id, fetchFactoryOrders, fetchDesignProofs])

  async function handleUploadProof() {
    const file = proofFileRef.current?.files?.[0]
    if (!file) {
      setProofMsg('파일을 선택해주세요')
      return
    }
    setProofUploading(true)
    setProofMsg('')

    const formData = new FormData()
    formData.append('file', file)
    if (proofAdminNote.trim()) {
      formData.append('adminNote', proofAdminNote.trim())
    }

    const res = await fetch(`/api/admin/orders/${id}/proof`, {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      setProofMsg(`오류: ${data.error}`)
    } else {
      setProofMsg('시안 업로드 완료. 고객에게 이메일 발송됨.')
      setProofAdminNote('')
      if (proofFileRef.current) proofFileRef.current.value = ''
      await fetchDesignProofs()
    }
    setProofUploading(false)
  }

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const updated = await res.json()
    if (!res.ok) {
      setUpdateMsg(`오류: ${updated.error}`)
    } else {
      setOrder((prev) => prev ? { ...prev, ...updated } : updated)
      setNewStatus('')
      setTrackingNumber('')
      setUpdateMsg('업데이트 완료')
    }
    setUpdating(false)
  }

  async function handleQueueFactoryOrder() {
    setFactoryLoading(true)
    setFactoryMsg('')
    const res = await fetch(`/api/admin/orders/${id}/factory-order`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setFactoryMsg(`오류: ${data.error}`)
    } else {
      setFactoryMsg(data.message)
      await fetchFactoryOrders()
    }
    setFactoryLoading(false)
  }

  async function handleCancelFactoryOrder() {
    if (!confirm('발주 대기 중인 항목을 취소하시겠습니까?')) return
    setFactoryLoading(true)
    const res = await fetch(`/api/admin/orders/${id}/factory-order`, { method: 'DELETE' })
    const data = await res.json()
    setFactoryMsg(res.ok ? '발주 취소 완료' : `오류: ${data.error}`)
    await fetchFactoryOrders()
    setFactoryLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-500">불러오는 중...</div>
  if (error || !order) return <div className="p-8 text-center text-red-500">{error || '주문을 찾을 수 없습니다'}</div>

  const nextOptions = NEXT_STATUSES[order.status] ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <a href="/admin/orders" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
              ← 주문 목록으로
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
            <h2 className="font-semibold text-gray-700 mb-3">고객</h2>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-sm text-gray-500">{order.customer_email}</p>
            {order.customer_phone && <p className="text-sm text-gray-500">{order.customer_phone}</p>}
          </div>

          {/* Shipping info */}
          <div className="bg-white rounded-lg shadow p-5 space-y-2">
            <h2 className="font-semibold text-gray-700 mb-3">배송 주소</h2>
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
          <h2 className="font-semibold text-gray-700 mb-4">주문 상품</h2>
          <div className="space-y-4">
            {order.print_order_items.map((item) => (
              <div key={item.id} className="border rounded p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{item.product_name_en}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {Object.entries(item.selected_options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                    <p className="text-sm text-gray-500">수량: {item.quantity}</p>
                  </div>
                  <p className="font-medium">${item.subtotal_usd.toFixed(2)}</p>
                </div>
                {item.print_files && item.print_files.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-gray-500 mb-1">파일:</p>
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
              <span>소계</span>
              <span>${order.subtotal_usd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>배송비</span>
              <span>${order.shipping_usd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>합계</span>
              <span>${order.total_usd.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Status update */}
        {nextOptions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">상태 변경</h2>
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
                placeholder="송장번호 (선택)"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            )}
            <textarea
              placeholder="내부 메모 (선택)"
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
                {updating ? '변경 중...' : '변경'}
              </button>
              {updateMsg && (
                <span className={`text-sm ${updateMsg.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>
                  {updateMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Payment info */}
        {order.stripe_payment_intent_id && (
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-700 mb-2">결제 정보</h2>
            <p className="text-sm text-gray-500 font-mono">{order.stripe_payment_intent_id}</p>
          </div>
        )}

        {/* 시안 확인 */}
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">시안 확인</h2>

          {/* 업로드 폼 */}
          <div className="space-y-3 border border-dashed border-gray-300 rounded-lg p-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">시안 이미지 업로드</label>
              <input
                ref={proofFileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <textarea
              value={proofAdminNote}
              onChange={(e) => setProofAdminNote(e.target.value)}
              placeholder="디자이너 메모 (선택사항)"
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleUploadProof}
                disabled={proofUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-40 hover:bg-blue-700"
              >
                {proofUploading ? '업로드 중...' : '시안 전송'}
              </button>
              {proofMsg && (
                <span className={`text-sm ${proofMsg.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>
                  {proofMsg}
                </span>
              )}
            </div>
          </div>

          {/* 시안 목록 */}
          {designProofs.length === 0 ? (
            <p className="text-sm text-gray-400">업로드된 시안이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {designProofs.map((proof) => (
                <div key={proof.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">v{proof.version}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROOF_STATUS_COLORS[proof.status]}`}>
                        {PROOF_STATUS_LABELS[proof.status]}
                      </span>
                    </div>
                    {proof.signed_url && (
                      <a
                        href={proof.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline"
                      >
                        시안 보기 →
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {proof.original_filename} · {proof.uploaded_by}
                  </p>
                  {proof.admin_note && (
                    <p className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                      메모: {proof.admin_note}
                    </p>
                  )}
                  {proof.status === 'revision_requested' && proof.customer_comment && (
                    <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                      고객 수정요청: {proof.customer_comment}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    업로드: {new Date(proof.uploaded_at).toLocaleString('ko-KR')}
                    {proof.responded_at && ` · 응답: ${new Date(proof.responded_at).toLocaleString('ko-KR')}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 성원애드피아 공장 발주 */}
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">성원애드피아 발주</h2>
            {['paid', 'processing'].includes(order.status) && (
              <div className="flex gap-2">
                {factoryOrders.some((f) => f.status === 'pending') && (
                  <button
                    onClick={handleCancelFactoryOrder}
                    disabled={factoryLoading}
                    className="px-3 py-1.5 text-sm border rounded text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40"
                  >
                    취소
                  </button>
                )}
                <button
                  onClick={handleQueueFactoryOrder}
                  disabled={factoryLoading || factoryOrders.some((f) => ['placing', 'placed'].includes(f.status))}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
                >
                  {factoryLoading ? '처리 중...' : '발주 큐 등록'}
                </button>
              </div>
            )}
          </div>

          {factoryMsg && (
            <p className={`text-sm ${factoryMsg.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>
              {factoryMsg}
            </p>
          )}

          {factoryOrders.length === 0 ? (
            <p className="text-sm text-gray-400">
              {['paid', 'processing'].includes(order.status)
                ? '발주 대기 중. "발주 큐 등록" 후 scripts/place-factory-orders.ts 실행.'
                : '결제 완료(paid) 후 발주 가능합니다.'}
            </p>
          ) : (
            <div className="space-y-3">
              {factoryOrders.map((fo) => (
                <div key={fo.id} className="border rounded p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${FACTORY_STATUS_COLORS[fo.status] ?? 'bg-gray-100'}`}>
                      {FACTORY_STATUS_LABELS[fo.status] ?? fo.status}
                    </span>
                    {fo.checkout_url && (
                      <a
                        href={fo.checkout_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline"
                      >
                        결제 페이지 →
                      </a>
                    )}
                    {fo.swadpia_order_number && !fo.checkout_url && (
                      <span className="text-xs font-mono text-gray-600">
                        Swadpia #{fo.swadpia_order_number}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    카테고리: {fo.category_code} · 수량: {fo.quantity} · 시도: {fo.attempt_count}회
                  </p>
                  {fo.last_error && (
                    <p className="text-xs text-red-500 break-all">오류: {fo.last_error}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {fo.placed_at
                      ? `발주 완료: ${new Date(fo.placed_at).toLocaleString('ko-KR')}`
                      : `등록: ${new Date(fo.queued_at).toLocaleString('ko-KR')}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 배송/송장 관리 */}
        <OrderShipments orderId={order.id} />

        {/* 이벤트 타임라인 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">이벤트 기록</h2>
          {(order.print_order_events ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">기록된 이벤트가 없습니다.</p>
          ) : (
            <ol className="relative border-l border-gray-200 ml-3 space-y-6">
              {(order.print_order_events ?? []).map((ev) => (
                <li key={ev.id} className="ml-4">
                  <div className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-white ${EVENT_TYPE_DOTS[ev.event_type]}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[ev.event_type]}`}>
                        {EVENT_TYPE_LABELS[ev.event_type]}
                      </span>
                      {(ev.old_value || ev.new_value) && (
                        <p className="text-sm text-gray-700">
                          {ev.old_value && <span className="line-through text-gray-400 mr-1">{ev.old_value}</span>}
                          {ev.new_value && <span className="font-medium">{ev.new_value}</span>}
                        </p>
                      )}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <p className="text-xs text-gray-400 font-mono break-all">
                          {Object.entries(ev.metadata)
                            .filter(([, v]) => v !== undefined && v !== null)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{ev.actor}</p>
                    </div>
                    <time className="text-xs text-gray-400 whitespace-nowrap">
                      {formatEventTime(ev.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
