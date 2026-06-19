import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Star, Zap, Sparkles } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import ProductImage from '@/components/ProductImage'
import CompetitorPriceBadge from '@/components/CompetitorPriceBadge'

export const dynamic = 'force-dynamic'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import { PCCF_PRODUCT_SLUGS } from '@/config/pccf-catalog'
import { PRODUCT_GROUPS } from '@/config/product-nav'
import type { PrintProduct, CompetitorPriceSummary } from '@/types/database'

const CATEGORY_GRADIENT: Record<string, string> = {
  business_cards: 'from-blue-50 to-indigo-100',
  premium_business_cards: 'from-indigo-50 to-slate-100',
  premium_foil_cards: 'from-amber-50 to-yellow-100',
  letterpress_cards: 'from-stone-50 to-stone-100',
  greeting_cards: 'from-pink-50 to-rose-100',
  stickers: 'from-yellow-50 to-orange-50',
  die_cut_stickers: 'from-amber-50 to-yellow-100',
  eco_stickers: 'from-green-50 to-emerald-100',
  labels: 'from-amber-50 to-orange-100',
  flyers: 'from-green-50 to-emerald-100',
  brochures: 'from-teal-50 to-cyan-100',
  booklets: 'from-cyan-50 to-sky-100',
  postcards: 'from-pink-50 to-rose-100',
  envelopes: 'from-violet-50 to-purple-100',
  forms: 'from-gray-50 to-slate-100',
  posters: 'from-purple-50 to-violet-100',
  banners: 'from-red-50 to-orange-100',
  pop: 'from-yellow-50 to-amber-100',
  boxes: 'from-orange-50 to-red-100',
  paper_bags: 'from-amber-50 to-yellow-100',
  notebooks: 'from-yellow-50 to-amber-100',
  memo_pads: 'from-yellow-50 to-yellow-100',
  calendars: 'from-sky-50 to-blue-100',
  sample_pack: 'from-blue-50 to-cyan-100',
}

const CATEGORY_ACCENT: Record<string, string> = {
  business_cards: 'border-blue-200',
  premium_business_cards: 'border-indigo-200',
  premium_foil_cards: 'border-amber-200',
  letterpress_cards: 'border-stone-200',
  greeting_cards: 'border-pink-200',
  stickers: 'border-yellow-200',
  die_cut_stickers: 'border-amber-200',
  eco_stickers: 'border-green-200',
  labels: 'border-amber-200',
  flyers: 'border-green-200',
  brochures: 'border-teal-200',
  booklets: 'border-cyan-200',
  postcards: 'border-pink-200',
  envelopes: 'border-violet-200',
  forms: 'border-gray-200',
  posters: 'border-purple-200',
  banners: 'border-red-200',
  pop: 'border-amber-200',
  boxes: 'border-orange-200',
  paper_bags: 'border-amber-200',
  notebooks: 'border-yellow-200',
  memo_pads: 'border-yellow-200',
  calendars: 'border-sky-200',
  sample_pack: 'border-blue-200',
}

const CATEGORY_TAG: Record<string, { label: string; color: string } | null> = {
  business_cards: { label: 'Most Popular', color: 'bg-blue-100 text-blue-700' },
  premium_business_cards: { label: 'Premium', color: 'bg-indigo-100 text-indigo-700' },
  premium_foil_cards: { label: 'Luxury', color: 'bg-amber-100 text-amber-800' },
  letterpress_cards: { label: 'Artisan', color: 'bg-stone-200 text-stone-800' },
  stickers: { label: 'Fast Turnaround', color: 'bg-yellow-100 text-yellow-700' },
  eco_stickers: { label: 'Eco', color: 'bg-green-100 text-green-700' },
  posters: { label: 'Best Value', color: 'bg-purple-100 text-purple-700' },
  sample_pack: { label: 'Free Shipping', color: 'bg-blue-100 text-blue-700' },
}

// `||`: 빈 문자열 env 도 canonical 도메인으로 폴백 (`??` 는 ""를 통과시켜 canonical 깨짐 유발).
const PRODUCTS_CANONICAL = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'}/products`

export const metadata = {
  title: 'Custom Printing Products — Business Cards, Brochures, Flyers & More',
  description:
    'Custom printing online: business cards, brochures, stickers, flyers, postcards, posters, labels, and banners. Premium quality, fast worldwide FedEx delivery.',
  keywords: [
    'custom printing',
    'business cards',
    'brochure printing',
    'flyer printing',
    'sticker printing',
    'online printing',
    'print on demand',
  ],
  alternates: { canonical: PRODUCTS_CANONICAL },
  openGraph: {
    type: 'website',
    title: 'Custom Printing Products — Procardcrafters',
    description:
      'Business cards, brochures, stickers, flyers, postcards, posters, and more — premium quality printing delivered worldwide.',
    url: PRODUCTS_CANONICAL,
    siteName: 'Procardcrafters',
  },
}

export default async function ProductsPage() {
  const supabase = createServerClient()
  const exchangeRate = await getKrwToUsdRate()

  let query = supabase
    .from('print_products')
    .select('*')
    .eq('is_active', true)
  if (PCCF_PRODUCT_SLUGS) {
    query = query.in('slug', [...PCCF_PRODUCT_SLUGS])
  }
  const [{ data: products }, { data: competitorRows }] = await Promise.all([
    query.order('sort_order', { ascending: true }),
    supabase
      .from('print_competitor_price_summary')
      .select('*')
      .eq('is_fresh', true),
  ])
  const items = (products as PrintProduct[] | null) ?? []
  const bySlug = new Map(items.map(p => [p.slug, p]))
  // slug → fresh competitor prices (best deal per product)
  const competitorBySlug = new Map<string, CompetitorPriceSummary[]>()
  for (const row of (competitorRows as CompetitorPriceSummary[] | null) ?? []) {
    const list = competitorBySlug.get(row.sku_slug) ?? []
    list.push(row)
    competitorBySlug.set(row.sku_slug, list)
  }

  return (
    <>
      {/* Page Header */}
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
          {/* OMO-3265: AI 큐레이션 진입 — "뭘 골라야 할지 모르겠다" 고객을 추천 플로우로 */}
          <Link
            href="/curate"
            className="inline-flex items-center gap-2 mt-6 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-full hover:bg-blue-50 transition"
          >
            <Sparkles className="w-4 h-4" /> Not sure what to pick? Try AI Curation
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white border-b border-gray-100 py-4 px-4">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-x-10 gap-y-2 text-sm text-gray-500 font-medium">
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> 3–5 day production</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> FedEx international shipping</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> PDF / AI / PSD accepted</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> Secure Stripe payments</span>
          <span className="flex items-center gap-1.5"><span className="text-green-500 font-bold">✓</span> Quality guarantee</span>
        </div>
      </section>

      {/* Category Sections */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Loading products...</div>
        ) : (
          PRODUCT_GROUPS.map(group => {
            const groupProducts = group.items
              .map(item => bySlug.get(item.slug))
              .filter((p): p is PrintProduct => Boolean(p))
            if (groupProducts.length === 0) return null
            return (
              <div key={group.key} id={group.key}>
                <div className="flex items-end justify-between mb-5 border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{group.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                  </div>
                  <span className="text-sm text-gray-400">{groupProducts.length} products</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupProducts.map(product => {
                    const baseUsd = calculateItemPriceUsd({
                      basePriceKrw: product.base_price_krw,
                      marginMultiplier: product.margin_multiplier,
                      extraPricesKrw: [],
                      exchangeRate,
                    })
                    const tag = CATEGORY_TAG[product.category]
                    const gradient = CATEGORY_GRADIENT[product.category] ?? 'from-gray-50 to-gray-100'
                    const accent = CATEGORY_ACCENT[product.category] ?? 'border-gray-200'
                    const cardCompetitorPrices = competitorBySlug.get(product.slug) ?? []
                    return (
                      <Link
                        key={product.slug}
                        href={`/products/${product.slug}`}
                        className={`group relative border ${accent} rounded-2xl overflow-hidden bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
                      >
                        <div className={`h-44 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                          {product.hero_image_url ? (
                            <Image
                              src={product.hero_image_url}
                              alt={product.name_en}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-40 h-32 group-hover:scale-105 transition-transform duration-300">
                              <ProductImage category={product.category} />
                            </div>
                          )}
                          {tag && (
                            <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${tag.color}`}>
                              {tag.label}
                            </span>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-lg">
                              {product.name_en}
                            </h3>
                            {product.badge_text_en && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                                product.is_premium ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                              }`}>
                                {product.badge_text_en}
                              </span>
                            )}
                          </div>
                          {product.description_en && (
                            <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                              {product.description_en}
                            </p>
                          )}
                          {cardCompetitorPrices.length > 0 && (
                            <div className="mb-3">
                              <CompetitorPriceBadge prices={cardCompetitorPrices} />
                            </div>
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
              </div>
            )
          })
        )}
      </section>

      {/* Bottom Info */}
      <section className="bg-gray-50 border-t border-gray-100 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Not sure which product to choose?</h3>
          <p className="text-gray-500 text-sm mb-4">
            Our team is happy to help. Reach out via our contact page and we&apos;ll guide you.
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
