import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import type { PrintProduct } from '@/types/database'

const PRODUCT_EMOJI: Record<string, string> = {
  business_cards: '🪪',
  stickers: '⭐',
  flyers: '📄',
  postcards: '💌',
  posters: '🖼️',
}

export const metadata = {
  title: '상품 목록 — Procardcrafters',
}

export default async function ProductsPage() {
  const supabase = createServerClient()
  const exchangeRate = await getKrwToUsdRate()

  const { data: products } = await supabase
    .from('print_products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const items = (products as PrintProduct[] | null) ?? []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Our Products</h1>
      <p className="text-gray-500 mb-10">
        고품질 한국 인쇄 — 전 세계 배송
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((product) => {
          const baseUsd = calculateItemPriceUsd({
            basePriceKrw: product.base_price_krw,
            marginMultiplier: product.margin_multiplier,
            extraPricesKrw: [],
            exchangeRate,
          })

          return (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all overflow-hidden"
            >
              {/* 썸네일 영역 */}
              <div className="h-40 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-6xl">
                {PRODUCT_EMOJI[product.category] ?? '📦'}
              </div>

              <div className="p-5">
                <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-lg mb-1">
                  {product.name_en}
                </h2>
                {product.description_ko && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {product.description_ko}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">부터</span>
                  <span className="text-xl font-bold text-blue-600">
                    ${baseUsd.toFixed(2)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-sm text-blue-600 font-medium">
                  옵션 선택 <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
