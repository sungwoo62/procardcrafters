'use client'

import { useState, useCallback, useTransition, useEffect } from 'react'
import Image from 'next/image'
import { Star, ThumbsUp, X, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'

export interface ReviewStats {
  total_reviews: number
  avg_rating: number
  rating_5: number
  rating_4: number
  rating_3: number
  rating_2: number
  rating_1: number
}

export interface Review {
  id: string
  reviewer_name: string
  rating: number
  title: string | null
  body: string
  source: string
  disclosure_note: string | null
  helpful_count: number
  photos: string[]
  created_at: string
}

export interface ReviewPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type SortKey = 'newest' | 'helpful' | 'highest' | 'lowest'

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  helpful: 'Most helpful',
  highest: 'Highest rated',
  lowest: 'Lowest rated',
}

const DISCLOSURE_COLORS: Record<string, string> = {
  beta_tester: 'bg-violet-50 border-violet-200 text-violet-700',
  incentivized: 'bg-amber-50 border-amber-200 text-amber-700',
  imported: 'bg-sky-50 border-sky-200 text-sky-700',
  team_member: 'bg-rose-50 border-rose-200 text-rose-700',
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
    </span>
  )
}

interface PhotoLightboxProps {
  photos: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

function PhotoLightbox({ photos, index, onClose, onPrev, onNext }: PhotoLightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev() }}
            className="absolute left-4 z-10 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Previous"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext() }}
            className="absolute right-4 z-10 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div
        className="relative max-w-2xl w-full mx-4 sm:mx-16 aspect-square rounded-xl overflow-hidden bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photos[index]}
          alt={`Review photo ${index + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 672px"
          priority
        />
      </div>

      {photos.length > 1 && (
        <span className="absolute bottom-4 text-white/50 text-sm select-none">
          {index + 1} / {photos.length}
        </span>
      )}
    </div>
  )
}

interface Props {
  slug: string
  initialStats: ReviewStats | null
  initialReviews: Review[]
  initialPagination: ReviewPagination
}

export default function ProductReviews({ slug, initialStats, initialReviews, initialPagination }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [pagination, setPagination] = useState<ReviewPagination>(initialPagination)
  const [sort, setSort] = useState<SortKey>('newest')
  const [helpfulVoted, setHelpfulVoted] = useState<Set<string>>(new Set())
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({})
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchReviews = useCallback(async (newSort: SortKey, newPage: number) => {
    const res = await fetch(`/api/products/${slug}/reviews?sort=${newSort}&page=${newPage}`)
    if (!res.ok) return
    const data = await res.json()
    setReviews(data.reviews)
    setPagination(data.pagination)
  }, [slug])

  const handleSort = (newSort: SortKey) => {
    if (newSort === sort) return
    setSort(newSort)
    startTransition(() => fetchReviews(newSort, 1))
  }

  const handlePage = (newPage: number) => {
    startTransition(() => fetchReviews(sort, newPage))
    window.scrollTo({ top: document.getElementById('reviews')?.offsetTop ?? 0, behavior: 'smooth' })
  }

  const handleHelpful = async (reviewId: string, baseCount: number) => {
    if (helpfulVoted.has(reviewId)) return
    setHelpfulVoted((prev) => new Set(prev).add(reviewId))
    setHelpfulCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] ?? baseCount) + 1 }))
    const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: 'POST' })
    if (!res.ok) {
      setHelpfulVoted((prev) => { const s = new Set(prev); s.delete(reviewId); return s })
      setHelpfulCounts((prev) => ({ ...prev, [reviewId]: baseCount }))
    }
  }

  const openLightbox = (photos: string[], idx: number) => {
    setLightboxPhotos(photos)
    setLightboxIndex(idx)
  }
  const closeLightbox = () => setLightboxIndex(null)
  const prevPhoto = () => setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : null))
  const nextPhoto = () => setLightboxIndex((i) => (i !== null ? Math.min(lightboxPhotos.length - 1, i + 1) : null))

  const stats = initialStats

  if (!stats || stats.total_reviews === 0) {
    return (
      <section id="reviews" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Reviews</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Star className="w-10 h-10 text-gray-200 fill-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No reviews yet. Be the first to review this product!</p>
        </div>
      </section>
    )
  }

  const maxDist = Math.max(stats.rating_5, stats.rating_4, stats.rating_3, stats.rating_2, stats.rating_1, 1)

  return (
    <>
      <section id="reviews" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>

        {/* Summary header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex flex-col sm:flex-row gap-6 items-start">
          {/* Average score */}
          <div className="flex flex-col items-center justify-center min-w-[110px]">
            <div className="text-5xl font-bold text-gray-900 leading-none tabular-nums">
              {Number(stats.avg_rating).toFixed(1)}
            </div>
            <div className="mt-2">
              <StarRow rating={stats.avg_rating} size="md" />
            </div>
            <div className="text-xs text-gray-500 mt-1.5">
              {stats.total_reviews.toLocaleString()} reviews
            </div>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 space-y-2 w-full">
            {([5, 4, 3, 2, 1] as const).map((r) => {
              const count = stats[`rating_${r}` as keyof ReviewStats] as number
              const pct = (count / maxDist) * 100
              return (
                <div key={r} className="flex items-center gap-2.5 text-xs">
                  <span className="w-2.5 text-gray-600 shrink-0 tabular-nums">{r}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-5 text-right text-gray-500 shrink-0 tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sort === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Review list */}
        <div className={`space-y-4 transition-opacity duration-150 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
          {reviews.map((review) => {
            const helpfulCount = helpfulCounts[review.id] ?? review.helpful_count
            const hasVoted = helpfulVoted.has(review.id)
            const photos = Array.isArray(review.photos) ? review.photos.filter(Boolean) : []
            const isVerified = review.source === 'verified_purchase'
            const disclosureColorCls = DISCLOSURE_COLORS[review.source] ?? 'bg-gray-50 border-gray-200 text-gray-600'

            return (
              <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StarRow rating={review.rating} size="sm" />
                      {isVerified && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{review.reviewer_name}</span>
                  </div>
                  <time
                    dateTime={review.created_at}
                    className="text-xs text-gray-400 shrink-0 mt-0.5"
                  >
                    {new Date(review.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </div>

                {/* Disclosure label — mandatory for non-verified */}
                {!isVerified && review.disclosure_note && (
                  <div
                    className={`flex items-start gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg mb-3 ${disclosureColorCls}`}
                  >
                    <span className="font-semibold shrink-0">Disclosure:</span>
                    <span>{review.disclosure_note}</span>
                  </div>
                )}

                {/* Title + body */}
                {review.title && (
                  <p className="font-semibold text-gray-900 text-sm mb-1">{review.title}</p>
                )}
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line mb-3">
                  {review.body}
                </p>

                {/* Photo thumbnails */}
                {photos.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {photos.map((url, i) => (
                      <button
                        key={url}
                        onClick={() => openLightbox(photos, i)}
                        className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0 hover:opacity-90 transition-opacity ring-1 ring-gray-200"
                        aria-label={`View photo ${i + 1} larger`}
                      >
                        <Image
                          src={url}
                          alt={`Review photo ${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Helpful button */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                  <button
                    onClick={() => handleHelpful(review.id, review.helpful_count)}
                    disabled={hasVoted}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      hasVoted
                        ? 'bg-blue-50 border-blue-200 text-blue-600 cursor-default'
                        : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 bg-white'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {hasVoted ? 'Helpful ✓' : 'Helpful'}
                    {helpfulCount > 0 && (
                      <span className="text-gray-400 ml-0.5">({helpfulCount})</span>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
            <button
              onClick={() => handlePage(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-40 hover:border-blue-300 transition-colors"
            >
              ← Previous
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((p) => {
                const cur = pagination.page
                return p === 1 || p === pagination.totalPages || Math.abs(p - cur) <= 2
              })
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                acc.push(p)
                return acc
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="text-gray-400 text-sm px-1">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePage(item as number)}
                    disabled={isPending}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      item === pagination.page
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-gray-200 text-gray-600 hover:border-blue-300 bg-white'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => handlePage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-40 hover:border-blue-300 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </section>

      {/* Photo lightbox */}
      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}
    </>
  )
}
