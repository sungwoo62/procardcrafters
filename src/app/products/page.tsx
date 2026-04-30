import Link from 'next/link'
import { ArrowRight, Star, Zap } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import ProductImage from '@/components/ProductImage'

export const dynamic = 'force-dynamic'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import type { PrintProduct } from '@/types/database'

const PRODUCT_EMOJI: Record<string, string> = {
  business_cards: '🪪',
  premium_business_cards: '💎',
  stickers: '⭐',
  die_cut_stickers: '✂️',
  flyers: '📄',
  brochures: '📖',
  postcards: '💌',
  posters: '🖼️',
  banners: '🏳️',
}

const PRODUCT_GRADIENT: Record<string, string> = {
  business_cards: 'from-blue-50 to-indigo-100',
  premium_business_cards: 'from-indigo-50 to-slate-100',
  stickers: 'from-yellow-50 to-orange-50',
  die_cut_stickers: 'from-amber-50 to-yellow-100',
  flyers: 'from-green-50 to-emerald-100',
  brochures: 'from-teal-50 to-cyan-100',
  postcards: 'from-pink-50 to-rose-100',
  posters: 'from-purple-50 to-violet-100',
  banners: 'from-red-50 to-orange-100',
}

const PRODUCT_ACCENT: Record<string, string> = {
  business_cards: 'border-blue-200',
  premium_business_cards: 'border-indigo-200',
  stickers: 'border-yellow-200',
  die_cut_stickers: 'border-amber-200',
  flyers: 'border-green-200',
  brochures: 'border-teal-200',
  postcards: 'border-pink-200',
  posters: 'border-purple-200',
  banners: 'border-red-200',
}

const PRODUCT_TAG: Record<string, { label: string; color: string } | null> = {
  business_cards: { label: 'Most Popular', color: 'bg-blue-100 text-blue-700' },
  premium_business_cards: { label: 'Premium', color: 'bg-indigo-100 text-indigo-700' },
  stickers: { label: 'Fast Turnaround', color: 'bg-yellow-100 text-yellow-700' },
  die_cut_stickers: null,
  flyers: null,
  brochures: null,
  postcards: null,
  posters: { label: 'Best Value', color: 'bg-purple-100 text-purple-700' },
  banners: null,
}

export const metadata = {
  title: 'Products — Procardcrafters',
  description: 'Custom printing services: business cards, stickers, flyers, postcards, and posters — distributed from LA, delivered worldwide.',
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
    <>
      {/* 페이지 헤더 */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" /> Instant pricing — no account required
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Our Products</h1>
          <p className="text-blue-100/80 text-lg max-w-xl mx-auto">
            Configure any product and get your exact USD price in seconds —
            with live KRW exchange rates built in.
          </p>
        </div>
      </section>

      {/* 신뢰 배지 */}
      <section className="bg-white border-b border-gray-100 py-4 px-4">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-x-10 gap-y-2 text-sm text-gray-500 font-medium">
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> 3–5 day production</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> FedEx international shipping</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> PDF / AI / PSD accepted</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> Secure Stripe payments</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> Quality guarantee</span>
        </div>
      </section>

      {/* 상품 그리드 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">상품 정보를 불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((product) => {
              const baseUsd = calculateItemPriceUsd({
                basePriceKrw: product.base_price_krw,
                marginMultiplier: product.margin_multiplier,
                extraPricesKrw: [],
                exchangeRate,
              })

              const tag = PRODUCT_TAG[product.category]

              return (
                <Link
                  key={product.slug}
                  href={`/products/${product.slug}`}
                  className={`group relative border ${PRODUCT_ACCENT[product.category] ?? 'border-gray-200'} rounded-2xl overflow-hidden bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
                >
                  {/* 썸네일 */}
                  <div className={`h-44 bg-gradient-to-br ${PRODUCT_GRADIENT[product.category] ?? 'from-gray-50 to-gray-100'} flex items-center justify-center relative`}>
                    <div className="w-40 h-32 group-hover:scale-105 transition-transform duration-300">
                      <ProductImage category={product.category} />
                    </div>
                    {tag && (
                      <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${tag.color}`}>
                        {tag.label}
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-lg mb-1.5">
                      {product.name_en}
                    </h2>
                    {product.description_ko && (
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                        {product.description_ko}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Starting from</div>
                        <div className="text-xl font-bold text-blue-600">
                          ${baseUsd.toFixed(2)}
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 text-sm text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg">
                        Configure <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 하단 안내 */}
      <section className="bg-gray-50 border-t border-gray-100 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Not sure which product to choose?</h3>
          <p className="text-gray-500 text-sm mb-4">
            Our team is happy to help. Reach out via our contact page and we'll guide you.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-blue-600 font-medium text-sm hover:text-blue-700 transition-colors"
          >
            Contact Us <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </>
  )
}
