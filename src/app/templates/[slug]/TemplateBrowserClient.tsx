'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Pencil, ArrowRight } from 'lucide-react'
import type { PrintProduct } from '@/types/database'
import {
  TEMPLATE_CATEGORY_LABELS,
  getTemplatesForProduct,
  type TemplateCategory,
  type TemplateDef,
} from '@/config/templates'
import TemplatePreview from '@/components/TemplatePreview'

interface Props {
  product: PrintProduct
}

function TemplateCard({ template, productSlug }: { template: TemplateDef; productSlug: string }) {
  return (
    <Link
      href={`/design/${productSlug}?template=${encodeURIComponent(template.name)}&bg=${encodeURIComponent(template.bg)}`}
      className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-200"
    >
      {/* Template preview */}
      <div className="h-40 relative flex items-center justify-center bg-gray-50 p-4">
        <TemplatePreview template={template} className="max-h-full max-w-full rounded-md shadow-sm" />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5" />
            Use This Template
          </span>
        </div>
      </div>

      {/* Template info */}
      <div className="p-4 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
              {template.name}
            </h3>
            {template.description && (
              <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
            )}
          </div>
          <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
            {TEMPLATE_CATEGORY_LABELS[template.category]}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function TemplateBrowserClient({ product }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all')

  const productTemplates = useMemo(() => getTemplatesForProduct(product.category), [product.category])

  const availableCategories = useMemo(() => {
    const cats = new Set<TemplateCategory>()
    productTemplates.forEach(t => cats.add(t.category))
    return Array.from(cats)
  }, [productTemplates])

  const filtered = useMemo(() => {
    return productTemplates.filter(t => {
      const matchesCategory = activeCategory === 'all' || t.category === activeCategory
      const matchesSearch = !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [productTemplates, activeCategory, search])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href={`/products/${product.slug}`}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {product.name_en}
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {product.name_en} Templates
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {filtered.length} templates — click to open in editor
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({productTemplates.length})
            </button>
            {availableCategories.map(cat => {
              const count = productTemplates.filter(t => t.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {TEMPLATE_CATEGORY_LABELS[cat]} ({count})
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Template Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-600 font-medium">No templates found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter</p>
            <button
              onClick={() => { setSearch(''); setActiveCategory('all') }}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Start from scratch */}
            <Link
              href={`/design/${product.slug}`}
              className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-dashed border-gray-200 bg-white"
            >
              <div className="h-40 flex items-center justify-center bg-gray-50 group-hover:bg-gray-100 transition-colors">
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-200 transition-colors">
                    <Pencil className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 group-hover:text-blue-600 transition-colors">
                    Start Blank
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                  Blank Canvas
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Design from scratch</p>
              </div>
            </Link>

            {filtered.map(template => (
              <TemplateCard key={template.name} template={template} productSlug={product.slug} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-gray-100 bg-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="font-bold text-gray-900 mb-2">
            Ready to order without designing?
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Upload your print-ready file and skip the editor.
          </p>
          <Link
            href={`/order?product=${product.slug}`}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Upload File & Order
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
