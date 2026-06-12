'use client'

// OMO-3019 [Part B] 제품별 인쇄 규격 템플릿 다운로드.
//
// 보드 요청: "각 제품 페이지마다 해당하는 템플릿을 다운받을 수 있게."
// 기존 /api/template (OMO-2709) 가 트림/블리드/세이프 가이드가 들어간
// PDF/AI/SVG 를 spec 기준으로 생성한다. 여기서는 제품 카테고리로 resolve 된
// 규격을 노출하고 해당 포맷 다운로드를 트리거한다.
//
// 우리 템플릿으로 작업하면 재단/블리드 사고가 구조적으로 없어진다(보드 전제:
// "우리템플릿을 쓰면 그 문제는 없어야하니까"). 고객 자가 파일 업로드 시에만
// 결제 단계의 File Responsibility Agreement(OMO-3019 Part A)가 적용된다.

import { useState } from 'react'
import { Download, Loader2, FileText, Ruler, ShieldCheck } from 'lucide-react'
import { resolveSpecDims, type TemplateFormat } from '@/config/printSpecs'

const FORMATS: { value: TemplateFormat; label: string; hint: string }[] = [
  { value: 'pdf', label: 'PDF', hint: 'Universal · print-ready' },
  { value: 'ai', label: 'AI', hint: 'Adobe Illustrator' },
  { value: 'svg', label: 'SVG', hint: 'Vector editors' },
]

export default function ProductTemplateDownload({
  productCategory,
  productLabel,
}: {
  productCategory: string
  productLabel: string
}) {
  const [downloading, setDownloading] = useState<TemplateFormat | null>(null)
  const dims = resolveSpecDims(productCategory)

  function download(format: TemplateFormat) {
    setDownloading(format)
    const params = new URLSearchParams({ product: productCategory, format, label: productLabel })
    const a = document.createElement('a')
    a.href = `/api/template?${params.toString()}`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 다운로드는 새 네비게이션 없이 트리거되므로 짧게 스피너만 보여준다.
    setTimeout(() => setDownloading(null), 1200)
  }

  return (
    <div className="bg-blue-50/40 border-t border-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Ruler className="w-5 h-5 text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Print Template</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Download the exact print template</h2>
        <p className="text-gray-500 text-sm mt-1 max-w-2xl">
          Design directly on our template and your file will already have the correct trim size, bleed and
          safe area — no resolution or cut-line surprises. Open it in your design tool, place your artwork, and
          re-upload a single flattened file at checkout.
        </p>

        {/* 규격 요약 */}
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 font-medium text-gray-700">
            Trim {dims.widthMm}×{dims.heightMm} mm
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 font-medium text-gray-700">
            Bleed {dims.bleedMm} mm
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 font-medium text-gray-700">
            Safe zone {dims.safeMm} mm
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 font-medium text-gray-700">
            CMYK · 300 DPI
          </span>
        </div>

        {/* 포맷별 다운로드 */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => download(f.value)}
              disabled={downloading !== null}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-50"
            >
              {downloading === f.value ? (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
              ) : (
                <Download className="w-5 h-5 text-blue-600 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{f.label} template</span>
                <span className="block text-[11px] text-gray-400 truncate">{f.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-gray-500 max-w-2xl">
          <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <span>
            Files built on this template pass our preflight automatically. If you upload your own artwork instead,
            you&apos;ll confirm resolution, bleed and proofing in the{' '}
            <span className="inline-flex items-center gap-1 font-medium text-gray-700">
              <FileText className="w-3 h-3" /> File Responsibility step
            </span>{' '}
            at checkout.
          </span>
        </p>
      </div>
    </div>
  )
}
