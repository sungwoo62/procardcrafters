'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const COMPETITOR_OPTIONS = [
  { value: 'vistaprint', label: 'Vistaprint' },
  { value: 'moo', label: 'MOO' },
]

export default function NewCompetitorPricePage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [form, setForm] = useState({
    sku_slug: '',
    competitor: 'vistaprint',
    sku_variant: '',
    quantity: '',
    competitor_price_usd: '',
    our_price_usd: '',
    spec_notes: '',
    source_url: '',
    captured_by: 'manual',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savingsPct = form.competitor_price_usd && form.our_price_usd
    ? Math.round(
        (parseFloat(form.competitor_price_usd) - parseFloat(form.our_price_usd))
        / parseFloat(form.competitor_price_usd) * 100
      )
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.source_url.startsWith('http')) {
      setError('출처 URL은 http:// 또는 https://로 시작해야 합니다.')
      return
    }

    setSaving(true)
    const { error: dbError } = await supabase
      .from('print_competitor_prices')
      .insert({
        sku_slug: form.sku_slug.trim(),
        competitor: form.competitor,
        sku_variant: form.sku_variant.trim(),
        quantity: form.quantity ? parseInt(form.quantity) : null,
        competitor_price_usd: parseFloat(form.competitor_price_usd),
        our_price_usd: parseFloat(form.our_price_usd),
        spec_notes: form.spec_notes.trim() || null,
        source_url: form.source_url.trim(),
        captured_by: form.captured_by,
        captured_at: new Date().toISOString(),
      })

    setSaving(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    router.push('/admin/competitor-prices')
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/competitor-prices" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">경쟁사 가격 등록</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-700 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>스크린샷 증빙 필수.</strong> 출처 URL은 실제 경쟁사 상품 페이지 URL이어야 합니다.
          7일 후 자동 만료되므로 정기적으로 업데이트하세요.
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SKU 슬러그 *</label>
          <input
            required
            type="text"
            placeholder="예: business_cards"
            value={form.sku_slug}
            onChange={e => setForm(f => ({ ...f, sku_slug: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">print_products.slug 값 (예: business_cards, stickers)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">경쟁사 *</label>
          <select
            required
            value={form.competitor}
            onChange={e => setForm(f => ({ ...f, competitor: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COMPETITOR_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Spec 설명 * (사과 대 사과 비교)</label>
          <input
            required
            type="text"
            placeholder="예: 500 cards, 3.5×2in, 14pt matte, double-sided"
            value={form.sku_variant}
            onChange={e => setForm(f => ({ ...f, sku_variant: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
          <input
            type="number"
            placeholder="예: 500"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">경쟁사 가격 (USD) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.competitor_price_usd}
                onChange={e => setForm(f => ({ ...f, competitor_price_usd: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">우리 가격 (USD) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.our_price_usd}
                onChange={e => setForm(f => ({ ...f, our_price_usd: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {savingsPct !== null && (
          <div className={`text-sm font-semibold p-3 rounded-lg ${savingsPct > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {savingsPct > 0
              ? `✓ 우리가 ${savingsPct}% 저렴 — 배지가 표시됩니다`
              : `✗ 우리가 더 비싸므로 배지가 숨겨집니다 (저장은 가능)`}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Option B spec 우위 설명 (선택)
          </label>
          <textarea
            rows={2}
            placeholder="예: 350gsm vs Vistaprint standard 110lb — thicker, better feel. Free double-sided included."
            value={form.spec_notes}
            onChange={e => setForm(f => ({ ...f, spec_notes: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출처 URL * (스크린샷 촬영 페이지)</label>
          <input
            required
            type="url"
            placeholder="https://www.vistaprint.com/..."
            value={form.source_url}
            onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
          <Link href="/admin/competitor-prices" className="text-sm text-gray-500 hover:text-gray-700">
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
