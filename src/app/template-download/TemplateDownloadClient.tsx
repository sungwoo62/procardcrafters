'use client'

// OMO-2709 [Part C] 성원 규격 템플릿 다운로드 UI.
// 사이즈·후가공 선택 → /api/template 으로 PDF/SVG/AI 생성·다운로드.

import { useMemo, useState } from 'react'
import { Download, Loader2, FileText } from 'lucide-react'
import { PRINT_SPEC_DIMS, FINISHING_SPOT_RULES, resolveSpecDims } from '@/config/printSpecs'

// 제품 슬러그 → 표시명. PRINT_SPEC_DIMS 키 기준.
const PRODUCT_LABELS: Record<string, string> = {
  business_cards: '명함 (Business Cards)',
  premium_business_cards: '프리미엄 명함',
  premium_foil_cards: '포일 명함',
  letterpress_cards: '레터프레스 명함',
  stickers: '스티커',
  die_cut_stickers: '다이컷 스티커',
  flyers: '전단 (Flyers)',
  brochures: '브로슈어',
  postcards: '엽서',
  posters: '포스터',
  banners: '배너',
}

const PRODUCTS = Object.keys(PRINT_SPEC_DIMS)
const FINISHINGS = Object.values(FINISHING_SPOT_RULES)

type Format = 'pdf' | 'svg' | 'ai'
const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: 'pdf', label: 'PDF', hint: '범용 · 미리보기' },
  { value: 'ai', label: 'AI', hint: 'Illustrator 작업용' },
  { value: 'svg', label: 'SVG', hint: '벡터 편집' },
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
        <h1 className="text-2xl font-bold text-gray-900">성원 규격 템플릿 다운로드</h1>
        <p className="mt-2 text-sm text-gray-600">
          사이즈·후가공을 선택하면 <strong>트림/블리드/세이프 가이드</strong>와{' '}
          <strong>M100 별색 레이어</strong>가 포함된 인쇄 템플릿을 받을 수 있습니다. 받은 파일을
          일러스트레이터에서 작업한 뒤 단일 합본으로 재업로드하세요.
        </p>
      </header>

      {/* 제품 선택 */}
      <section className="mb-6">
        <label className="mb-2 block text-sm font-semibold text-gray-800">제품 · 사이즈</label>
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
          트림 {dims.widthMm}×{dims.heightMm}mm · 블리드 {dims.bleedMm}mm · 세이프 {dims.safeMm}mm
        </p>
      </section>

      {/* 후가공 선택 */}
      <section className="mb-6">
        <label className="mb-2 block text-sm font-semibold text-gray-800">
          후가공 (별색 레이어로 포함)
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
                {f.label_ko}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          선택한 후가공마다 <span className="font-mono text-pink-600">M100(별색 1도)</span> 레이어가
          생성됩니다. K100·CMYK 금지 (성원 규격).
        </p>
      </section>

      {/* 다운로드 */}
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <FileText className="h-4 w-4" /> 템플릿 다운로드
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
        ※ 가이드 선(트림/블리드/세이프)은 <strong>비인쇄</strong>용입니다. 작업 완료 후 가이드 레이어를
        삭제하고, 별색 요소는 M100 별색 레이어에만 두어 단일 합본으로 업로드하세요.
      </p>
    </main>
  )
}
