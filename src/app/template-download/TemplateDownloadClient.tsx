'use client'

// OMO-2709 [Part C] 성원 규격 템플릿 다운로드 UI.
// 사이즈·후가공 선택 → /api/template 으로 PDF/SVG/AI 생성·다운로드.

import { useMemo, useState } from 'react'
import { Download, Loader2, FileText } from 'lucide-react'
import { PRINT_SPEC_DIMS, FINISHING_SPOT_RULES, resolveSpecDims } from '@/config/printSpecs'

// Product slug → display name. Keyed by PRINT_SPEC_DIMS.
const PRODUCT_LABELS: Record<string, string> = {
  business_cards: 'Business Cards',
  premium_business_cards: 'Premium Business Cards',
  premium_foil_cards: 'Foil Business Cards',
  letterpress_cards: 'Letterpress Cards',
  stickers: 'Stickers',
  die_cut_stickers: 'Die-Cut Stickers',
  flyers: 'Flyers',
  brochures: 'Brochures',
  postcards: 'Postcards',
  posters: 'Posters',
  banners: 'Banners',
}

const PRODUCTS = Object.keys(PRINT_SPEC_DIMS)
const FINISHINGS = Object.values(FINISHING_SPOT_RULES)

type Format = 'pdf' | 'svg' | 'ai'
const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: 'pdf', label: 'PDF', hint: 'Universal · preview' },
  { value: 'ai', label: 'AI', hint: 'For Illustrator' },
  { value: 'svg', label: 'SVG', hint: 'Vector editing' },
]

export default function TemplateDownloadClient() {
  const [product, setProduct] = useState<string>('business_cards')
  const [finishing, setFinishing] = useState<string[]>([])
  const [downloading, setDownloading] = useState<Format | null>(null)

  const dims = useMemo(() => resolveSpecDims(product), [product])

  function toggleFinish(value: string) {
    setFinishing((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function download(format: Format) {
    setDownloading(format)
    const params = new URLSearchParams({ product, format })
    if (finishing.length) params.set('finish', finishing.join(','))
    const label = PRODUCT_LABELS[product]
    if (label) params.set('label', label)
    const url = `/api/template?${params.toString()}`
    // 새 탭 없이 다운로드 트리거.
    const a = document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 브라우저가 즉시 처리 — 짧은 시각적 피드백만.
    window.setTimeout(() => setDownloading(null), 800)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Print Template Download</h1>
        <p className="mt-2 text-sm text-gray-600">
          Pick a size and finishing to download a print template with{' '}
          <strong>trim / bleed / safe guides</strong> and an{' '}
          <strong>M100 spot finishing layer</strong>. Edit the file in Illustrator,
          then re-upload it as a single flattened file.
        </p>
      </header>

      {/* Product selection */}
      <section className="mb-6">
        <label className="mb-2 block text-sm font-semibold text-gray-800">Product · Size</label>
        <select
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        >
          {PRODUCTS.map((slug) => (
            <option key={slug} value={slug}>
              {PRODUCT_LABELS[slug] ?? slug}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-500">
          Trim {dims.widthMm}×{dims.heightMm}mm · Bleed {dims.bleedMm}mm · Safe {dims.safeMm}mm
        </p>
      </section>

      {/* Finishing selection */}
      <section className="mb-6">
        <label className="mb-2 block text-sm font-semibold text-gray-800">
          Finishing (included as a spot layer)
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FINISHINGS.map((f) => {
            const active = finishing.includes(f.value)
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => toggleFinish(f.value)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  active
                    ? 'border-pink-500 bg-pink-50 text-pink-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Each selected finishing adds an <span className="font-mono text-pink-600">M100 (1-color spot)</span> layer.
          Do not use K100 or CMYK (print spec).
        </p>
      </section>

      {/* Download */}
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <FileText className="h-4 w-4" /> Template download
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.value}
              type="button"
              disabled={downloading !== null}
              onClick={() => download(fmt.value)}
              className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-60"
            >
              {downloading === fmt.value ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {fmt.label}
              <span className="text-xs font-normal text-gray-300">{fmt.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="mt-6 text-xs text-gray-500">
        ※ The guide lines (trim/bleed/safe) are <strong>non-printing</strong>. When finished, delete the
        guide layer and keep spot elements only on the M100 spot layer, then upload as a single flattened file.
      </p>
    </main>
  )
}
