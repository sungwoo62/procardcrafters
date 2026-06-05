'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Check, Star } from 'lucide-react'

interface Product {
  id: string
  name_en: string
  name_ko: string
}

const ADMIN_SOURCES = [
  { value: 'beta_tester', label: '베타테스터 (Beta Tester)' },
  { value: 'incentivized', label: '인센티브 리뷰 (Incentivized) — 쿠폰 발급' },
  { value: 'imported', label: '임포트 (Imported) — 외부 수집' },
  { value: 'team_member', label: '팀멤버 (Team Member)' },
]

const DISCLOSURE_TEMPLATES: Record<string, string> = {
  beta_tester:
    'This review was written by a beta tester who received the product in exchange for honest feedback.',
  incentivized:
    'This reviewer received a discount coupon as an incentive for providing an honest review, in accordance with FTC guidelines.',
  imported:
    'This review was imported from a third-party platform where the reviewer purchased our product.',
  team_member:
    'This review was written by a team member or associate of Procardcrafters and reflects their genuine experience.',
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <span className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="focus:outline-none"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              s <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300 hover:text-amber-300'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-gray-600 self-center">{value}점</span>
      )}
    </span>
  )
}

export default function AdminNewReviewPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [recentAdminCount, setRecentAdminCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [productId, setProductId] = useState('')
  const [source, setSource] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [rating, setRating] = useState(0)
  const [titleText, setTitleText] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [disclosureNote, setDisclosureNote] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [adminNote, setAdminNote] = useState('')

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/admin/reviews?page=1&limit=1')
    if (!res.ok) return
    // 기존 리뷰에서 상품 목록 추출은 별도 API가 없으므로,
    // reviews 목록의 product 정보를 집계하거나 단순 입력
    // 여기서는 fetch approved reviews to collect product list
    const approvedRes = await fetch('/api/admin/reviews?limit=200')
    if (!approvedRes.ok) return
    const data = await approvedRes.json()
    const seen = new Map<string, Product>()
    for (const r of data.data ?? []) {
      if (r.product) seen.set(r.product.id, r.product)
    }
    setProducts(Array.from(seen.values()))
  }, [])

  const fetchRecentAdminCount = useCallback(async () => {
    // IP 단시간 다수 입력 경고: 최근 1시간 어드민 직접 생성 건수 조회
    const res = await fetch('/api/admin/reviews?status=pending,approved&limit=200')
    if (!res.ok) return
    const data = await res.json()
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const recent = (data.data ?? []).filter(
      (r: { created_by_admin: boolean; created_at: string }) =>
        r.created_by_admin && new Date(r.created_at).getTime() > oneHourAgo
    )
    setRecentAdminCount(recent.length)
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchRecentAdminCount()
  }, [fetchProducts, fetchRecentAdminCount])

  // source 변경 시 disclosure_note 템플릿 자동 채우기
  useEffect(() => {
    if (source && !disclosureNote) {
      setDisclosureNote(DISCLOSURE_TEMPLATES[source] ?? '')
    }
  }, [source]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { setError('상품을 선택하세요'); return }
    if (!source) { setError('출처를 선택하세요'); return }
    if (!reviewerName.trim()) { setError('리뷰어 이름을 입력하세요'); return }
    if (rating === 0) { setError('평점을 선택하세요'); return }
    if (!bodyText.trim()) { setError('리뷰 본문을 입력하세요'); return }
    if (!disclosureNote.trim()) { setError('공개 의무 고지 텍스트(disclosure_note)를 입력하세요'); return }
    if (!evidenceUrl.trim()) { setError('증거 URL을 입력하세요'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          source,
          reviewer_name: reviewerName,
          rating,
          title: titleText || undefined,
          body_text: bodyText,
          disclosure_note: disclosureNote,
          admin_evidence_url: evidenceUrl,
          admin_note: adminNote || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setSuccess(true)
      // reset
      setProductId(''); setSource(''); setReviewerName('')
      setRating(0); setTitleText(''); setBodyText('')
      setDisclosureNote(''); setEvidenceUrl(''); setAdminNote('')
      fetchRecentAdminCount()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link
          href="/admin/reviews"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          리뷰 목록
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">리뷰 직접 입력</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            베타테스터·인센티브·임포트·팀멤버 출처 한정 — verified_purchase 불가
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* IP 단시간 다수 입력 경고 */}
        {recentAdminCount >= 5 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">다수 입력 경고</p>
              <p className="text-sm text-amber-700 mt-0.5">
                최근 1시간 내 어드민 직접 입력 리뷰가 {recentAdminCount}건입니다.
                단기 다량 등록은 리뷰 신뢰도에 영향을 줄 수 있으니 신중하게 입력하세요.
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
            <Check className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              리뷰가 등록되었습니다. 모더레이션 큐에서 승인 후 게시됩니다.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          {/* 상품 선택 */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">기본 정보</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                상품 <span className="text-red-500">*</span>
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">상품 선택...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_en} ({p.name_ko})
                  </option>
                ))}
              </select>
              {products.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  등록된 상품이 없거나 불러오는 중입니다. 상품 ID를 직접 입력하려면 아래 상품 UUID를 입력하세요.
                </p>
              )}
              {products.length === 0 && (
                <input
                  type="text"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="상품 UUID (예: 550e8400-...)"
                  className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                출처 <span className="text-red-500">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">출처 선택...</option>
                {ADMIN_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                <AlertTriangle className="h-3 w-3 text-gray-400" />
                verified_purchase(구매확인)는 어드민 직접 입력 불가 — 실구매 주문 연결만 허용
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                리뷰어 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="예) John D. 또는 김철수"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                평점 <span className="text-red-500">*</span>
              </label>
              <StarPicker value={rating} onChange={setRating} />
            </div>
          </div>

          {/* 리뷰 내용 */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">리뷰 내용</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                제목 <span className="text-gray-400 text-xs">(선택)</span>
              </label>
              <input
                type="text"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                placeholder="예) Great quality cards!"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                리뷰 본문 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={5}
                placeholder="리뷰 내용을 입력하세요..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-400">{bodyText.length}자</p>
            </div>
          </div>

          {/* 공개 의무 고지 + 증거 */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">규정 준수 정보</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                공개 의무 고지 (disclosure_note){' '}
                <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  FTC 가이드라인 — 리뷰와 함께 공개됨
                </span>
              </label>
              <textarea
                value={disclosureNote}
                onChange={(e) => setDisclosureNote(e.target.value)}
                rows={3}
                placeholder="예) This reviewer received a product sample in exchange for an honest review."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                증거 URL <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  스크린샷, 주문확인서, 계약서 링크 등
                </span>
              </label>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                어드민 노트 <span className="text-gray-400 text-xs">(내부용, 비공개)</span>
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                placeholder="내부 참고 메모..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Link
              href="/admin/reviews"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? '저장 중...' : '리뷰 등록 (pending)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
