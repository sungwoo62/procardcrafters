// OMO-3027: 인쇄 템플릿 갤러리 — 전 제품 템플릿을 한 페이지에서 미리보기 + 다운로드.
//
// 보드 요청: "전체 템플릿 스크린샷 떠서 웹페이지 하나 만들고 배포 후 풀링크 보고."
// 래스터 스크린샷 대신 PrintTemplatePreview(SVG)로 각 템플릿을 라이브 렌더한다
// (다운로드 PDF 와 동일 기하). 규격(print_spec, OMO-3026) 있는 제품만 미리보기·다운로드,
// 없는 제품은 "준비중"으로 graceful 표기. 성원/타사 자산 미사용(OMO-2975).

import type { Metadata } from 'next'
import Link from 'next/link'
import { FileDown, Ruler } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import type { PrintSpec } from '@/lib/print-spec'
import PrintTemplatePreview from '@/components/PrintTemplatePreview'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

export const metadata: Metadata = {
  title: 'Free Print Templates | Procardcrafters',
  description:
    'Download blank, print-ready PDF templates with crop marks, bleed and safe-zone guides for every product. Set up to exact specs — no resolution or cut-line surprises.',
  alternates: { canonical: `${SITE_URL}/print-templates` },
}

interface ProductRow {
  slug: string
  name_en: string
  category: string
  print_spec: PrintSpec | null
}

export default async function PrintTemplatesPage() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_products')
    .select('slug, name_en, category, print_spec')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name_en', { ascending: true })

  const products = (data as ProductRow[] | null) ?? []
  const withSpec = products.filter((p) => p.print_spec)
  const withoutSpec = products.filter((p) => !p.print_spec)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-2 mb-3">
            <Ruler className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Print Templates</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Free print-ready templates</h1>
          <p className="text-gray-500 text-sm sm:text-base mt-3 max-w-2xl leading-relaxed">
            Every template is a blank PDF set up to the product&apos;s exact trim size, with crop marks, bleed and
            safe-zone guides. Open it in your design tool, place your artwork inside the guides, and upload a single
            flattened file at checkout — no resolution or cut-line surprises.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-red-50 border border-red-100 font-medium text-red-700">Red — bleed</span>
            <span className="px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 font-medium text-gray-700">Black — trim / cut line</span>
            <span className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 font-medium text-blue-700">Blue — safe zone</span>
          </div>
        </div>
      </div>

      {/* Template grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Available templates ({withSpec.length})</h2>
        <p className="text-gray-500 text-sm mb-6">Click any card to download the print-ready PDF for that product.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {withSpec.map((p) => {
            const spec = p.print_spec as PrintSpec
            return (
              <div key={p.slug} className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
                {/* SVG preview */}
                <div className="bg-gray-100 p-6 flex items-center justify-center" style={{ minHeight: '180px' }}>
                  <PrintTemplatePreview
                    spec={spec}
                    className="w-full h-auto max-h-44 drop-shadow-sm"
                  />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-semibold text-gray-900">{p.name_en}</h3>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-gray-500">
                    <span>Trim <strong className="text-gray-700">{spec.width_mm}×{spec.height_mm}mm</strong></span>
                    <span>Bleed <strong className="text-gray-700">{spec.bleed_mm}mm</strong></span>
                    <span>Safe <strong className="text-gray-700">{spec.safe_mm}mm</strong></span>
                    <span>{spec.color_mode} · <strong className="text-gray-700">{spec.min_dpi}dpi</strong></span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <a
                      href={`/api/products/${p.slug}/template`}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      PDF
                    </a>
                    <Link
                      href={`/products/${p.slug}`}
                      className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-indigo-600 px-3 py-2"
                    >
                      View product
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Coming soon */}
        {withoutSpec.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Coming soon ({withoutSpec.length})</h2>
            <p className="text-gray-500 text-sm mb-4">
              Templates for these products are being prepared. Design online in our editor in the meantime.
            </p>
            <div className="flex flex-wrap gap-2">
              {withoutSpec.map((p) => (
                <Link
                  key={p.slug}
                  href={`/products/${p.slug}`}
                  className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  {p.name_en}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
