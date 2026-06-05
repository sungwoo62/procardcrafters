'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, GripVertical, Quote, Save, Star, ToggleLeft, ToggleRight } from 'lucide-react'

interface Product {
  id: string
  name_en: string
  name_ko: string
}

interface Review {
  id: string
  reviewer_name: string
  rating: number
  body: string
  featured_quote: string | null
  featured_sort: number
  is_homepage_featured: boolean
  status: string
  source: string
  created_at: string
  product: Product | null
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </span>
  )
}

interface ReviewCardProps {
  review: Review
  index: number
  onToggleFeatured: (id: string) => void
  onUpdateQuote: (id: string, quote: string) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (index: number) => void
  isDragging: boolean
  isDragOver: boolean
}

function ReviewCard({
  review,
  index,
  onToggleFeatured,
  onUpdateQuote,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDragOver,
}: ReviewCardProps) {
  const [editingQuote, setEditingQuote] = useState(false)
  const [quote, setQuote] = useState(review.featured_quote ?? '')
  const [saved, setSaved] = useState(false)

  // 원문 보존: 원본 body를 항상 표시
  const originalBody = review.body

  function saveQuote() {
    onUpdateQuote(review.id, quote)
    setEditingQuote(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function cancelQuote() {
    setQuote(review.featured_quote ?? '')
    setEditingQuote(false)
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      className={`bg-white rounded-xl border p-4 transition-all cursor-grab active:cursor-grabbing select-none
        ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
        ${isDragOver ? 'border-blue-400 shadow-lg ring-2 ring-blue-200' : 'border-gray-200 shadow-sm'}
        ${review.is_homepage_featured ? 'ring-1 ring-amber-200' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <GripVertical className="h-5 w-5 text-gray-300" />
          <span className="text-xs text-gray-400 font-mono w-5 text-center">{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 text-sm">{review.reviewer_name}</span>
                <StarRating rating={review.rating} />
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {review.product?.name_en ?? '—'} ·{' '}
                {new Date(review.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </div>
            </div>

            {/* Featured toggle */}
            <button
              onClick={() => onToggleFeatured(review.id)}
              title={review.is_homepage_featured ? '메인 노출 해제' : '메인 노출 설정'}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                review.is_homepage_featured
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-amber-50 hover:text-amber-600'
              }`}
            >
              {review.is_homepage_featured ? (
                <>
                  <ToggleRight className="h-4 w-4" />
                  메인 노출 중
                </>
              ) : (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  비활성
                </>
              )}
            </button>
          </div>

          {/* 원문 (보존) */}
          <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border-l-2 border-gray-200">
            <p className="text-xs text-gray-400 mb-1">원문</p>
            <p className="leading-relaxed">{originalBody}</p>
          </div>

          {/* 발췌 인용 편집 */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Quote className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-gray-700">발췌 인용문 (메인 표시용)</span>
              </div>
              {!editingQuote && (
                <button
                  onClick={() => setEditingQuote(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {review.featured_quote ? '수정' : '발췌 추가'}
                </button>
              )}
              {saved && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3 w-3" />
                  저장됨
                </span>
              )}
            </div>

            {editingQuote ? (
              <div className="space-y-2">
                <textarea
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  rows={3}
                  placeholder="원문의 일부를 발췌하여 입력하세요..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveQuote}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
                  >
                    저장
                  </button>
                  <button
                    onClick={cancelQuote}
                    className="px-3 py-1.5 border rounded-lg text-xs hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : review.featured_quote ? (
              <blockquote className="border-l-2 border-blue-400 pl-3 text-sm text-blue-800 italic">
                "{review.featured_quote}"
              </blockquote>
            ) : (
              <p className="text-xs text-gray-400 italic">발췌 없음 — 원문 전체가 표시됩니다</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminFeaturedReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Local mutation tracking (quote edits, toggle changes)
  const [localQuotes, setLocalQuotes] = useState<Record<string, string | null>>({})
  const [localFeatured, setLocalFeatured] = useState<Record<string, boolean>>({})

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/reviews/featured')
    if (res.status === 401) { window.location.href = '/admin/login'; return }
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? '로드 실패'); setLoading(false); return }
    setReviews(data.data ?? [])
    setLocalQuotes({})
    setLocalFeatured({})
    setLoading(false)
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  function toggleFeatured(id: string) {
    setLocalFeatured((prev) => {
      const current = prev[id] ?? reviews.find((r) => r.id === id)?.is_homepage_featured ?? false
      return { ...prev, [id]: !current }
    })
  }

  function updateQuote(id: string, quote: string) {
    setLocalQuotes((prev) => ({ ...prev, [id]: quote.trim() || null }))
  }

  function getEffectiveFeatured(review: Review): boolean {
    return localFeatured[review.id] ?? review.is_homepage_featured
  }

  function getEffectiveQuote(review: Review): string | null {
    return review.id in localQuotes ? localQuotes[review.id] : review.featured_quote
  }

  // Drag-and-drop handlers
  function handleDragStart(index: number) {
    dragIndexRef.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(dropIndex: number) {
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === dropIndex) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    const next = [...reviews]
    const [dragged] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, dragged)
    setReviews(next)
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  async function saveAll() {
    setSaving(true)
    setError('')
    try {
      const updates = reviews.map((review, index) => ({
        id: review.id,
        featured_sort: index,
        is_homepage_featured: getEffectiveFeatured(review),
        featured_quote: getEffectiveQuote(review),
      }))

      const res = await fetch('/api/admin/reviews/featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        fetchReviews()
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 오류')
    } finally {
      setSaving(false)
    }
  }

  const featuredCount = reviews.filter((r) => getEffectiveFeatured(r)).length
  const hasChanges =
    Object.keys(localQuotes).length > 0 || Object.keys(localFeatured).length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/reviews"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            리뷰 목록
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Featured 큐레이션</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              드래그로 순서 조정 · 발췌 인용문 편집 · 메인 노출 토글
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <Star className="h-3.5 w-3.5 inline mr-1 fill-current" />
            {featuredCount}건 메인 노출
          </span>
          <button
            onClick={saveAll}
            disabled={saving || saved}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-60`}
          >
            {saved ? (
              <><Check className="h-4 w-4" />저장됨</>
            ) : (
              <><Save className="h-4 w-4" />{saving ? '저장 중...' : '순서 + 변경 저장'}</>
            )}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-3xl mx-auto">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-white rounded-xl border animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">승인된 리뷰가 없습니다.</p>
            <p className="text-xs mt-1">
              <Link href="/admin/reviews" className="text-blue-500 hover:underline">
                리뷰 모더레이션
              </Link>
              에서 먼저 리뷰를 승인하세요.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <GripVertical className="h-4 w-4 text-blue-400" />
              카드를 드래그하여 순서를 조정하고, &ldquo;순서 + 변경 저장&rdquo;을 누르면 메인 페이지에 반영됩니다.
            </div>

            <div
              className="space-y-3"
              onDragLeave={() => setDragOverIndex(null)}
            >
              {reviews.map((review, index) => (
                <ReviewCard
                  key={review.id}
                  review={{
                    ...review,
                    is_homepage_featured: getEffectiveFeatured(review),
                    featured_quote: getEffectiveQuote(review),
                  }}
                  index={index}
                  onToggleFeatured={toggleFeatured}
                  onUpdateQuote={updateQuote}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={dragIndexRef.current === index}
                  isDragOver={dragOverIndex === index}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={saveAll}
                disabled={saving || saved}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {saved ? (
                  <><Check className="h-4 w-4" />저장됨</>
                ) : (
                  <><Save className="h-4 w-4" />{saving ? '저장 중...' : '모두 저장'}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
