'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Edit2,
  ExternalLink,
  Lock,
  Pause,
  Play,
  Plus,
  Tag,
  Trash2,
  Unlock,
  X,
  Zap,
} from 'lucide-react'

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface ProductPreview {
  product_slug: string
  sort_order: number
  custom_hero_url: string | null
  product: {
    name_ko: string
    name_en: string
    base_price_krw: number
    margin_multiplier: number
    thumbnail_url: string | null
  } | null
}

interface PromoCode {
  id: string
  code: string
  discount_pct: number
  discount_tier: string
  status: string
}

interface CalendarInfo {
  key: string
  name_ko: string
  name_en: string
  default_discount_tier: string
}

interface Campaign {
  id: string
  year: number
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  promo_start_at: string | null
  promo_end_at: string | null
  peak_start_at: string | null
  order_cutoff_at: string | null
  headline_ko: string | null
  headline_en: string | null
  hero_image_url: string | null
  approved_by: string | null
  approved_at: string | null
  calendar: CalendarInfo | null
  products: ProductPreview[]
  promo_codes: PromoCode[]
  discountPct: number
  tierCap: number
  avgMarginPct: number | null
  isLossMaking: boolean
}

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Campaign['status'], string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<Campaign['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  ended: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
}

const TIER_COLOR: Record<string, string> = {
  top: 'text-yellow-700 bg-yellow-50',
  standard: 'text-blue-700 bg-blue-50',
  always_on: 'text-teal-700 bg-teal-50',
  bestseller: 'text-purple-700 bg-purple-50',
}

const KNOWN_PRODUCT_SLUGS = [
  'business-cards',
  'premium-business-cards',
  'stickers',
  'die-cut-stickers',
  'flyers',
  'brochures',
  'postcards',
  'posters',
  'banners',
  'greeting_cards',
  'invitations',
  'premium-foil-cards',
]

const ALL_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: '전체' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'ended', label: 'Ended' },
]

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── 편집 모달 ──────────────────────────────────────────────────────────────────

interface EditModalProps {
  campaign: Campaign
  onClose: () => void
  onSaved: () => void
}

function EditModal({ campaign, onClose, onSaved }: EditModalProps) {
  const isLive = campaign.status === 'live'
  const cap = campaign.tierCap

  const [headlineKo, setHeadlineKo] = useState(campaign.headline_ko ?? '')
  const [headlineEn, setHeadlineEn] = useState(campaign.headline_en ?? '')
  const [heroUrl, setHeroUrl] = useState(campaign.hero_image_url ?? '')
  const [discountPct, setDiscountPct] = useState(campaign.discountPct)
  const [products, setProducts] = useState<string[]>(
    campaign.products.map((p) => p.product_slug)
  )
  const [addingSlug, setAddingSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showLossConfirm, setShowLossConfirm] = useState(false)

  function isProjectedLoss(): boolean {
    if (!campaign.avgMarginPct) return false
    const baseMult = campaign.products[0]?.product?.margin_multiplier ?? 3.3
    const sellPrice = 100
    const effectiveSell = sellPrice * (1 - discountPct / 100)
    const factoryCost = sellPrice / baseMult
    const margin = effectiveSell - factoryCost
    return margin / effectiveSell < 0
  }

  async function submit(confirmed = false) {
    if (!confirmed && isProjectedLoss()) {
      setShowLossConfirm(true)
      return
    }

    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        headline_ko: headlineKo,
        headline_en: headlineEn,
        hero_image_url: heroUrl || null,
      }
      if (!isLive) {
        body.discount_pct = discountPct
        body.products = products
      }

      const res = await fetch(`/api/admin/promotions/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            캠페인 편집 — {campaign.calendar?.name_ko} {campaign.year}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {isLive && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              라이브 캠페인 — headline 텍스트와 hero 이미지만 수정 가능합니다.
            </div>
          )}

          {/* Headline */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">헤드라인 (한국어)</label>
            <input
              value={headlineKo}
              onChange={(e) => setHeadlineKo(e.target.value)}
              placeholder="예) 봄 시즌 특가 인쇄"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">헤드라인 (영어)</label>
            <input
              value={headlineEn}
              onChange={(e) => setHeadlineEn(e.target.value)}
              placeholder="e.g. Spring Season Print Sale"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Hero image */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Hero 이미지 URL</label>
            <input
              value={heroUrl}
              onChange={(e) => setHeroUrl(e.target.value)}
              placeholder="https://… (Supabase Storage promotion-assets/)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400">
              Supabase Storage의 <code>promotion-assets/</code> 버킷에 업로드 후 URL 붙여넣기
            </p>
          </div>

          {/* Discount slider — only for non-live */}
          {!isLive && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                할인율
                <span className="ml-2 text-xs text-gray-500">
                  ({campaign.calendar?.default_discount_tier ?? 'standard'} tier, 최대 {cap}%)
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={cap}
                  step={0.5}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span className="w-12 text-right font-mono text-sm font-semibold text-blue-700">
                  {discountPct}%
                </span>
              </div>
              {discountPct >= cap && (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> tier cap ({cap}%) 적용 중
                </p>
              )}
            </div>
          )}

          {/* Products — only for non-live */}
          {!isLive && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">대상 상품</label>
              <div className="space-y-1.5">
                {products.map((slug) => (
                  <div
                    key={slug}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5"
                  >
                    <span className="text-sm font-mono text-gray-700">{slug}</span>
                    <button
                      onClick={() => setProducts((p) => p.filter((s) => s !== slug))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">상품 없음</p>
                )}
              </div>

              <div className="flex gap-2">
                <select
                  value={addingSlug}
                  onChange={(e) => setAddingSlug(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">상품 선택...</option>
                  {KNOWN_PRODUCT_SLUGS.filter((s) => !products.includes(s)).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (addingSlug && !products.includes(addingSlug)) {
                      setProducts((p) => [...p, addingSlug])
                      setAddingSlug('')
                    }
                  }}
                  disabled={!addingSlug}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={() => submit()}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Loss-making confirm overlay */}
      {showLossConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900">Loss-making 경고</h3>
                <p className="text-sm text-gray-600 mt-1">
                  현재 할인율({discountPct}%)을 적용하면 일부 상품의 마진이 음수(-)가 될 수 있습니다.
                  계속 진행하시겠습니까?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLossConfirm(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowLossConfirm(false)
                  submit(true)
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                손실 감수 후 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 캠페인 카드 ───────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign
  onRefresh: () => void
}

function CampaignCard({ campaign, onRefresh }: CampaignCardProps) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function action(type: 'approve' | 'force_live' | 'pause' | 'end' | 'cancel') {
    setLoading(true)
    setMsg('')
    try {
      if (type === 'approve') {
        const res = await fetch(`/api/admin/promotions/${campaign.id}/approve`, {
          method: 'POST',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMsg('승인 완료 — scheduled')
      } else if (type === 'force_live') {
        const res = await fetch(`/api/admin/promotions/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'live' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMsg('라이브 전환 완료')
      } else if (type === 'pause') {
        const res = await fetch(`/api/admin/promotions/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'scheduled' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMsg('일시 중지 (scheduled 로 전환)')
      } else if (type === 'end') {
        const res = await fetch(`/api/admin/promotions/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ended' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMsg('캠페인 종료')
      } else if (type === 'cancel') {
        if (!confirm('이 캠페인을 취소하시겠습니까?')) return
        const res = await fetch(`/api/admin/promotions/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMsg('취소 완료')
      }
      setTimeout(() => {
        onRefresh()
        setMsg('')
      }, 800)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  const thumbs = campaign.products.slice(0, 5)
  const tier = campaign.calendar?.default_discount_tier ?? 'standard'
  const marginColor =
    campaign.avgMarginPct === null
      ? 'text-gray-400'
      : campaign.avgMarginPct < 0
        ? 'text-red-600'
        : campaign.avgMarginPct < 15
          ? 'text-orange-500'
          : 'text-green-600'

  return (
    <>
      <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">
                {campaign.calendar?.name_ko ?? '—'}
                <span className="text-gray-400 font-normal ml-1 text-sm">{campaign.year}</span>
              </h3>
              <span className="text-xs text-gray-400">{campaign.calendar?.name_en}</span>
            </div>
            <span
              className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[campaign.status]}`}
            >
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>
          {campaign.hero_image_url && (
            <img
              src={campaign.hero_image_url}
              alt="hero"
              className="h-14 w-20 object-cover rounded-lg flex-shrink-0"
            />
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="text-gray-500">기간</div>
          <div className="text-gray-800 font-medium">
            {fmt(campaign.promo_start_at)} ~ {fmt(campaign.promo_end_at)}
          </div>
          <div className="text-gray-500">피크 윈도우</div>
          <div className="text-gray-800">{fmt(campaign.peak_start_at)} ~</div>
          <div className="text-gray-500">주문 마감</div>
          <div className="text-gray-800">{fmt(campaign.order_cutoff_at)}</div>
        </div>

        {/* Discount + Margin */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_COLOR[tier] ?? 'text-gray-700 bg-gray-100'}`}
          >
            {tier} tier
          </span>
          <span className="text-sm font-semibold text-blue-700">{campaign.discountPct}% 할인</span>
          <span className="text-xs text-gray-400">cap {campaign.tierCap}%</span>
          <span className="ml-auto text-sm font-medium">
            <span className="text-gray-500">예상 마진: </span>
            <span className={marginColor}>
              {campaign.avgMarginPct !== null ? `${campaign.avgMarginPct.toFixed(1)}%` : '—'}
            </span>
          </span>
          {campaign.isLossMaking && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              Loss-making
            </span>
          )}
        </div>

        {/* Headline */}
        {(campaign.headline_ko || campaign.headline_en) && (
          <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            {campaign.headline_ko && <div>{campaign.headline_ko}</div>}
            {campaign.headline_en && (
              <div className="text-gray-400 text-xs mt-0.5">{campaign.headline_en}</div>
            )}
          </div>
        )}

        {/* Product thumbnails */}
        {thumbs.length > 0 && (
          <div className="flex items-center gap-2">
            {thumbs.map((pp) => (
              <div
                key={pp.product_slug}
                className="h-10 w-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0"
                title={pp.product_slug}
              >
                {pp.product?.thumbnail_url ? (
                  <img
                    src={pp.product.thumbnail_url}
                    alt={pp.product_slug}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400 px-1 text-center leading-tight">
                    {pp.product_slug.slice(0, 6)}
                  </span>
                )}
              </div>
            ))}
            {campaign.products.length > 5 && (
              <span className="text-xs text-gray-500">+{campaign.products.length - 5}개</span>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {campaign.products.length}개 상품
            </span>
          </div>
        )}

        {/* Approved info */}
        {campaign.approved_at && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            승인됨 {fmt(campaign.approved_at)}
          </div>
        )}

        {/* Status message */}
        {msg && (
          <div className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">{msg}</div>
        )}

        {/* 프로모 코드 */}
        {campaign.promo_codes.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">프로모 코드</p>
            {campaign.promo_codes.map((pc) => (
              <div key={pc.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {pc.status === 'locked' ? (
                    <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  ) : (
                    <Tag className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  )}
                  <span className="font-mono text-xs font-medium text-gray-800 truncate">{pc.code}</span>
                  <span className="text-xs text-gray-400">{pc.discount_pct}%</span>
                </div>
                <Link
                  href={`/admin/promotions/${pc.id}`}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 shrink-0"
                >
                  {pc.status === 'locked' ? (
                    <><Unlock className="h-3 w-3" />해제</>
                  ) : (
                    <><Lock className="h-3 w-3" />잠금</>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
          {campaign.status === 'draft' && (
            <>
              <button
                onClick={() => action('approve')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                Approve &amp; Schedule
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => action('cancel')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </>
          )}

          {campaign.status === 'scheduled' && (
            <>
              <button
                onClick={() => action('force_live')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
              >
                <Zap className="h-4 w-4" />
                Force Live Now
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => action('cancel')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </>
          )}

          {campaign.status === 'live' && (
            <>
              <button
                onClick={() => action('pause')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60"
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
              >
                <Edit2 className="h-4 w-4" />
                Edit headline
              </button>
              <button
                onClick={() => action('end')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
              >
                <X className="h-4 w-4" />
                End Now
              </button>
            </>
          )}

          {campaign.status === 'ended' && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              종료됨
            </span>
          )}
        </div>
      </div>

      {editing && (
        <EditModal
          campaign={campaign}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            onRefresh()
          }}
        />
      )}
    </>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function AdminPromotionsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('draft,scheduled,live')

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/admin/promotions?${params}`)
    if (res.status === 401) {
      window.location.href = '/admin/login?redirectTo=/admin/promotions'
      return
    }
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '로드 실패')
    } else {
      setCampaigns(data.campaigns ?? [])
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const liveCampaigns = campaigns.filter((c) => c.status === 'live')
  const draftCount = campaigns.filter((c) => c.status === 'draft').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">프로모션 캠페인</h1>
          <p className="text-sm text-gray-500 mt-0.5">시즌 캠페인 검토 · 승인 · 라이브 관리</p>
        </div>
        <div className="flex items-center gap-3">
          {liveCampaigns.length > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <Play className="h-3.5 w-3.5 fill-current" />
              {liveCampaigns.length}개 라이브 중
            </span>
          )}
          {draftCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
              <ChevronDown className="h-3.5 w-3.5" />
              {draftCount}개 승인 대기
            </span>
          )}
          <a
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ExternalLink className="h-4 w-4" />
            대시보드
          </a>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-0">
          {ALL_STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value || 'draft,scheduled,live')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                (f.value === '' && statusFilter === 'draft,scheduled,live') ||
                statusFilter === f.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-white rounded-xl border animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">해당 상태의 캠페인이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} onRefresh={fetchCampaigns} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
