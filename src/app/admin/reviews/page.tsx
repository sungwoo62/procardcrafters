'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  X,
  Eye,
  EyeOff,
  Star,
  Plus,
  ImageIcon,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface Product {
  id: string
  name_en: string
  name_ko: string
}

interface Review {
  id: string
  reviewer_name: string
  rating: number
  title: string | null
  body: string
  source: string
  disclosure_note: string | null
  admin_evidence_url: string | null
  admin_note: string | null
  created_by_admin: boolean
  status: string
  created_at: string
  product: Product | null
}

const STATUS_TABS = [
  { value: 'pending', label: '대기중', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'approved', label: '승인됨', color: 'text-green-700 bg-green-50 border-green-200' },
  { value: 'rejected', label: '반려됨', color: 'text-red-700 bg-red-50 border-red-200' },
  { value: 'hidden', label: '숨김', color: 'text-gray-700 bg-gray-100 border-gray-200' },
  { value: '', label: '전체', color: 'text-blue-700 bg-blue-50 border-blue-200' },
]

const SOURCE_LABEL: Record<string, string> = {
  verified_purchase: '구매확인',
  beta_tester: '베타테스터',
  incentivized: '인센티브',
  imported: '임포트',
  team_member: '팀멤버',
}

const SOURCE_COLOR: Record<string, string> = {
  verified_purchase: 'bg-emerald-100 text-emerald-700',
  beta_tester: 'bg-blue-100 text-blue-700',
  incentivized: 'bg-purple-100 text-purple-700',
  imported: 'bg-gray-100 text-gray-700',
  team_member: 'bg-orange-100 text-orange-700',
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </span>
  )
}

interface RejectModalProps {
  reviewIds: string[]
  onClose: () => void
  onDone: () => void
}

function RejectModal({ reviewIds, onClose, onDone }: RejectModalProps) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!note.trim()) { setError('사유를 입력하세요'); return }
    setLoading(true)
    setError('')
    try {
      const isBulk = reviewIds.length > 1
      const res = isBulk
        ? await fetch('/api/admin/reviews/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: reviewIds, action: 'reject', note }),
          })
        : await fetch(`/api/admin/reviews/${reviewIds[0]}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', note }),
          })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '반려 실패')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">리뷰 반려</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {reviewIds.length}건을 반려합니다. 리뷰어에게 사유 메일이 발송됩니다.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            반려 사유 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="고객에게 전달될 반려 사유를 입력하세요..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={loading || !note.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? '처리 중...' : '반려 + 메일 발송'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string[] | null>(null)

  const LIMIT = 50
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError('')
    setSelected(new Set())
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/admin/reviews?${params}`)
    if (res.status === 401) { window.location.href = '/admin/login'; return }
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? '로드 실패'); setLoading(false); return }
    setReviews(data.data ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [statusFilter, page])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === reviews.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(reviews.map((r) => r.id)))
    }
  }

  async function singleAction(id: string, action: 'approve' | 'hide') {
    setActionLoading(id + action)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fetchReviews()
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setActionLoading(null)
    }
  }

  async function bulkApprove() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setActionLoading('bulk-approve')
    try {
      const res = await fetch('/api/admin/reviews/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fetchReviews()
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = statusFilter === 'pending' ? total : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">리뷰 모더레이션</h1>
          <p className="text-sm text-gray-500 mt-0.5">승인 대기 리뷰 검토 · 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/reviews/featured"
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            <Star className="h-4 w-4 text-amber-500" />
            Featured 관리
          </Link>
          <Link
            href="/admin/reviews/new"
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            직접 입력
          </Link>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 ml-2">
            대시보드
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="bg-white border-b px-6 flex gap-0">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1) }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.value === 'pending' && pendingCount != null && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-blue-700">{selected.size}건 선택됨</span>
          <button
            onClick={bulkApprove}
            disabled={actionLoading === 'bulk-approve'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            일괄 승인
          </button>
          <button
            onClick={() => setRejectTarget(Array.from(selected))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            <X className="h-4 w-4" />
            일괄 반려
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-sm text-blue-600 hover:underline"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-white rounded-xl border animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">해당 상태의 리뷰가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === reviews.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    리뷰어
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    상품
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    평점
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    출처
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-64">
                    내용
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    날짜
                  </th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviews.map((review) => (
                  <tr
                    key={review.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      selected.has(review.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(review.id)}
                        onChange={() => toggleSelect(review.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{review.reviewer_name}</div>
                      {review.created_by_admin && (
                        <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          어드민 입력
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {review.product?.name_en ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StarRating rating={review.rating} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          SOURCE_COLOR[review.source] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {SOURCE_LABEL[review.source] ?? review.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {review.title && (
                        <div className="font-medium text-gray-800 truncate">{review.title}</div>
                      )}
                      <div className="text-gray-500 truncate">{review.body}</div>
                      {review.admin_evidence_url && (
                        <a
                          href={review.admin_evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                        >
                          <ImageIcon className="h-3 w-3" />
                          증거
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {review.status !== 'approved' && (
                          <button
                            onClick={() => singleAction(review.id, 'approve')}
                            disabled={actionLoading === review.id + 'approve'}
                            title="승인"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {review.status !== 'rejected' && (
                          <button
                            onClick={() => setRejectTarget([review.id])}
                            title="반려"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {review.status !== 'hidden' ? (
                          <button
                            onClick={() => singleAction(review.id, 'hide')}
                            title="숨김"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            <EyeOff className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-gray-300">
                            <Eye className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          reviewIds={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null)
            fetchReviews()
          }}
        />
      )}
    </div>
  )
}
