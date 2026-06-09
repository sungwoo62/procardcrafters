'use client'


// OMO-2629: 인증/관리자 페이지는 인증 게이트·비SEO → 정적 프리렌더 제외(빌드 안정성).
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, RefreshCw, Users, Mail, Phone, ShoppingBag, DollarSign } from 'lucide-react'

interface Customer {
  email: string
  name: string
  phone: string | null
  firstOrder: string
  lastOrder: string
  orderCount: number
  totalSpent: number
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)

    const res = await fetch(`/api/admin/customers?${params}`, {
    })
    if (res.status === 401) { window.location.href = '/admin/login'; return }
    const data = await res.json()
    setCustomers(data.customers ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setLoading(false)
  }, [page, q])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])


  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setQ(searchInput)
    setPage(1)
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href={`/admin`} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">고객 관리</h1>
              <p className="text-sm text-gray-500">총 {total}건 주문 (고객별)</p>
            </div>
          </div>
          <button onClick={fetchCustomers} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="이름 또는 이메일로 검색"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl">
            검색
          </button>
          {q && (
            <button
              type="button"
              onClick={() => { setQ(''); setSearchInput(''); setPage(1) }}
              className="px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50"
            >
              초기화
            </button>
          )}
        </form>

        {loading ? (
          <div className="flex justify-center py-20 text-gray-400 text-sm">불러오는 중...</div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Users className="w-10 h-10" />
            <p className="text-sm">{q ? '결과 없음' : '고객 데이터 없음'}</p>
          </div>
        ) : (
          <>
            {/* Customer grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {customers.map(customer => (
                <div key={customer.email} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  {/* Customer info */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{customer.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{customer.email}</p>
                    </div>
                    <div className="shrink-0 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center ml-2">
                      <span className="text-sm font-bold text-gray-600">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Contact */}
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      {customer.phone}
                    </div>
                  )}

                  {/* Order stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <ShoppingBag className="w-3 h-3" />
                        <span className="text-xs font-medium">주문</span>
                      </div>
                      <p className="text-lg font-bold text-blue-800">{customer.orderCount}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 text-green-600 mb-1">
                        <DollarSign className="w-3 h-3" />
                        <span className="text-xs font-medium">총 결제액</span>
                      </div>
                      <p className="text-lg font-bold text-green-800">${customer.totalSpent.toFixed(0)}</p>
                    </div>
                  </div>

                  {/* Order dates */}
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>첫 주문: {formatDate(customer.firstOrder)}</span>
                    <span>마지막 주문: {formatDate(customer.lastOrder)}</span>
                  </div>

                  {/* Email link */}
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" /> 이메일 보내기
                  </a>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  이전
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
