'use client'

import { useEffect, useState, useCallback } from 'react'
import { OrderStatus } from '@/types/database'
import { Download } from 'lucide-react'

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

const ALL_STATUSES: OrderStatus[] = [
  'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
]

const BULK_TARGET_STATUSES: OrderStatus[] = [
  'paid', 'processing', 'shipped', 'delivered', 'cancelled',
]

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  total_usd: number
  status: OrderStatus
  created_at: string
}

export default function AdminOrdersPage() {
  const [secret, setSecret] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 벌크 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('processing')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMessage, setBulkMessage] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/admin/orders?${params}`, {
      headers: { 'x-admin-secret': secret },
    })

    if (res.status === 401) {
      setAuthenticated(false)
      setError('인증 실패. 비밀번호를 확인하세요.')
      setLoading(false)
      return
    }

    const data = await res.json()
    setOrders(data.orders ?? [])
    setTotal(data.total ?? 0)
    setSelectedIds(new Set())
    setLoading(false)
  }, [secret, page, statusFilter])

  useEffect(() => {
    if (authenticated) fetchOrders()
  }, [authenticated, fetchOrders])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthenticated(true)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)))
    }
  }

  async function handleBulkUpdate() {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    setBulkMessage('')

    const res = await fetch('/api/admin/orders/bulk', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': secret,
      },
      body: JSON.stringify({ ids: Array.from(selectedIds), status: bulkStatus }),
    })

    const data = await res.json()
    if (!res.ok) {
      setBulkMessage(`오류: ${data.error}`)
    } else {
      setBulkMessage(`${data.updated}건 상태가 업데이트되었습니다.`)
      fetchOrders()
    }
    setBulkLoading(false)
  }

  function exportCSV() {
    const header = ['주문번호', '고객명', '이메일', '금액(USD)', '상태', '주문일시']
    const rows = orders.map((o) => [
      o.order_number,
      o.customer_name,
      o.customer_email,
      o.total_usd.toFixed(2),
      STATUS_LABELS[o.status],
      new Date(o.created_at).toLocaleString('ko-KR'),
    ])

    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders_page${page}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow w-80 space-y-4">
          <h1 className="text-xl font-bold text-center">Admin Login</h1>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="w-full bg-black text-white rounded py-2 text-sm font-medium hover:bg-gray-800"
          >
            Login
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Orders Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Total: {total}</span>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              CSV 내보내기
            </button>
          </div>
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => { setStatusFilter(''); setPage(1) }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              statusFilter === '' ? 'bg-black text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                statusFilter === s ? 'bg-black text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* 벌크 업데이트 툴바 */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <span className="text-sm font-medium text-blue-800">{selectedIds.size}건 선택됨</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm text-gray-800 focus:outline-none"
            >
              {BULK_TARGET_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              onClick={handleBulkUpdate}
              disabled={bulkLoading}
              className="rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {bulkLoading ? '처리 중...' : '상태 변경'}
            </button>
            {bulkMessage && (
              <span className="text-sm text-blue-700">{bulkMessage}</span>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No orders found.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 ${selectedIds.has(order.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{order.order_number}</td>
                    <td className="px-4 py-3">
                      <div>{order.customer_name}</div>
                      <div className="text-gray-400 text-xs">{order.customer_email}</div>
                    </td>
                    <td className="px-4 py-3">${order.total_usd.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/admin/orders/${order.id}?secret=${encodeURIComponent(secret)}`}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={orders.length < 20}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
