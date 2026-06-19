'use client'

// OMO-3159: 비회원 견적 빌더 (클라이언트).
// 제품/옵션/수량 선택 → /api/quote(json) 라이브 가격 → /api/quote(pdf) 견적서 다운로드.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

export interface QuoteProductOption {
  option_type: string
  label_en: string
  value: string
  is_default: boolean
}

export interface QuoteProduct {
  slug: string
  name_en: string
  category: string
  min_order_quantity: number
  options: QuoteProductOption[]
}

interface PriceState {
  itemPriceUsd: number
  shippingUsd: number
  totalUsd: number
  effectiveQty: number
  quantity: number
  unitPriceUsd: number
  press: string | null
}

const QTY_TYPES = ['paper_qty', 'quantity']

const TYPE_LABEL: Record<string, string> = {
  paper_code: 'Paper',
  paper: 'Paper',
  size: 'Size',
  sides: 'Sides',
  finish: 'Finish',
  finishing: 'Finishing',
  paper_qty: 'Quantity',
  quantity: 'Quantity',
}

function prettyType(t: string): string {
  return TYPE_LABEL[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function QuoteBuilder({ products }: { products: QuoteProduct[] }) {
  const [slug, setSlug] = useState(products[0]?.slug ?? '')
  const product = useMemo(() => products.find((p) => p.slug === slug) ?? products[0], [products, slug])

  // option_type → [options]
  const grouped = useMemo(() => {
    const map = new Map<string, QuoteProductOption[]>()
    if (!product) return map
    for (const o of product.options) {
      if (!map.has(o.option_type)) map.set(o.option_type, [])
      map.get(o.option_type)!.push(o)
    }
    return map
  }, [product])

  const [selections, setSelections] = useState<Record<string, string>>({})

  // 제품 바뀌면 기본 선택 초기화
  useEffect(() => {
    const sel: Record<string, string> = {}
    grouped.forEach((opts, type) => {
      const def = opts.find((o) => o.is_default) ?? opts[0]
      if (def) sel[type] = def.value
    })
    setSelections(sel)
  }, [grouped])

  const [price, setPrice] = useState<PriceState | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPrice = useCallback(async () => {
    if (!product) return
    setLoadingPrice(true)
    setError(null)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ slug: product.slug, selections, format: 'json' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to fetch price')
      }
      const j = await res.json()
      setPrice(j.quote)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch price')
      setPrice(null)
    } finally {
      setLoadingPrice(false)
    }
  }, [product, selections])

  // selections 변경 → 디바운스 후 가격 조회
  useEffect(() => {
    if (!product || Object.keys(selections).length === 0) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchPrice, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [selections, product, fetchPrice])

  async function downloadPdf() {
    if (!product) return
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, selections, format: 'pdf' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('X-Quote-Number')
        ? `pccf-quote-${res.headers.get('X-Quote-Number')}.pdf`
        : `pccf-quote-${product.slug}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (!product) {
    return <p className="text-gray-500">No products available for quoting.</p>
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_360px]">
      {/* 선택 패널 */}
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700">Product</label>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name_en}
              </option>
            ))}
          </select>
        </div>

        {[...grouped.entries()].map(([type, opts]) => (
          <div key={type}>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              {prettyType(type)}
              {QTY_TYPES.includes(type) && <span className="ml-1 text-xs text-gray-400">(quantity)</span>}
            </label>
            <select
              value={selections[type] ?? ''}
              onChange={(e) => setSelections((s) => ({ ...s, [type]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {opts.map((o) => (
                <option key={`${type}:${o.value}`} value={o.value}>
                  {o.label_en}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* 가격 / 다운로드 카드 */}
      <div className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-blue-600">Your Estimate</h3>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Print" value={price ? `$${price.itemPriceUsd.toFixed(2)}` : '—'} loading={loadingPrice} />
          <Row
            label="Shipping"
            value={price ? (price.shippingUsd > 0 ? `$${price.shippingUsd.toFixed(2)}` : 'FREE') : '—'}
            loading={loadingPrice}
          />
          {price && price.effectiveQty !== price.quantity && (
            <p className="text-xs text-amber-600">
              Min. order rounds {price.quantity} → {price.effectiveQty} units.
            </p>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-2xl font-bold text-blue-700">
            {price ? `$${price.totalUsd.toFixed(2)}` : '—'}
          </span>
        </div>

        <button
          onClick={downloadPdf}
          disabled={downloading || !price}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
          {downloading ? 'Generating…' : 'Download Quote PDF'}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-gray-400">
          No sign-up required. USD pricing. Quote valid for 14 days.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : value}
      </span>
    </div>
  )
}
