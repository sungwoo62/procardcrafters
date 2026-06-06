import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import { CheckCircle, Clock, Globe, Shield, Star, LayoutTemplate, ArrowRight, Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { getShippingCost } from '@/lib/shipping'
import { fetchSwadpiaCategoryData } from '@/lib/swadpia'
import { isPccfSlug } from '@/config/pccf-catalog'
import { formatProductionWindow } from '@/config/lead-time'
import { getTemplatesForProduct } from '@/config/templates'
import ProductConfigurator from '@/components/ProductConfigurator'
import ProductImage from '@/components/ProductImage'
import ProductGallery from '@/components/ProductGallery'
import ViewItemTracker from '@/components/ViewItemTracker'
import CompetitorPriceBadge from '@/components/CompetitorPriceBadge'
import type { PrintProduct, PrintProductOption, CompetitorPriceSummary } from '@/types/database'
import ProductReviews from '@/components/ProductReviews'
import type { ReviewStats, Review, ReviewPagination } from '@/components/ProductReviews'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!isPccfSlug(slug)) return { title: 'Product Not Found' }
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_products')
    .select('name_en, description_en')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Product Not Found' }

  return {
    title: `${data.name_en} — Procardcrafters`,
    description: data.description_en ?? undefined,
  }
}

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
  business_cards: 'from-blue-100 via-indigo-50 to-blue-50',
  premium_business_cards: 'from-indigo-100 via-slate-50 to-indigo-50',
  stickers: 'from-yellow-100 via-orange-50 to-yellow-50',
  die_cut_stickers: 'from-amber-100 via-yellow-50 to-amber-50',
  flyers: 'from-green-100 via-emerald-50 to-green-50',
  brochures: 'from-teal-100 via-cyan-50 to-teal-50',
  postcards: 'from-pink-100 via-rose-50 to-pink-50',
  posters: 'from-purple-100 via-violet-50 to-purple-50',
  banners: 'from-red-100 via-orange-50 to-red-50',
}

const PRODUCT_FEATURES: Record<string, string[]> = {
  business_cards: ['Premium 350gsm cardstock', 'Matte or gloss lamination', 'Standard & custom sizes', 'UV spot finishing available'],
  premium_business_cards: ['Linen 350gsm or Pearl 300gsm stock', 'Luxury texture and finish', 'Embossing & foil options', 'Premium uncoated feel'],
  stickers: ['Weatherproof vinyl material', 'Custom die-cut shapes', 'Outdoor durable (3+ years)', 'Removable or permanent adhesive'],
  die_cut_stickers: ['Custom shape cutting', 'Contour-cut to your design', 'Durable adhesive vinyl', 'Indoor & outdoor use'],
  flyers: ['100–170gsm coated paper', 'Single or double-sided', 'A4, A5, DL sizes', 'Full-bleed printing available'],
  brochures: ['Folded A4 or A5 formats', 'Tri-fold & saddle-stitch binding', 'Premium coated paper', 'Full-color both sides'],
  postcards: ['300gsm premium stock', 'Gloss or soft-touch finish', 'Perfect for direct mail', 'Standard & large formats'],
  posters: ['170gsm satin poster paper', 'Large format up to A0', 'Vivid color reproduction', 'Rolled or flat delivery'],
  banners: ['Mini banner 60×160cm or 80×200cm', 'Durable PVC material', 'Indoor & outdoor use', 'Retractable stand available'],
  letterpress_cards: ['Crane Lettra 600gsm cotton stock', 'Deep-impression letterpress printing', '1 or 2-color designs', 'Artisan craftsmanship — 30–40+ day production'],
}

const TRUST_ITEMS = [
  { icon: Shield, text: 'Quality Guaranteed' },
  { icon: Clock, text: '3–5 Day Production' },
  { icon: Globe, text: 'FedEx Worldwide' },
  { icon: Star, text: '4.9★ Rating' },
]

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  if (!isPccfSlug(slug)) notFound()
  const supabase = createServerClient()

  const [{ data: productData }, exchangeRate, swadpiaData, { data: competitorData }] = await Promise.all([
    supabase
      .from('print_products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single(),
    getKrwToUsdRate(),
    fetchSwadpiaCategoryData(slug),
    supabase
      .from('print_competitor_price_summary')
      .select('*')
      .eq('sku_slug', slug)
      .eq('is_fresh', true),
  ])

  if (!productData) notFound()

  const product = productData as PrintProduct

  const [
    { data: optionsData },
    { data: reviewStats },
    { data: reviewsData, count: reviewsCount },
  ] = await Promise.all([
    supabase
      .from('print_product_options')
      .select('*')
      .eq('product_id', product.id)
      .order('option_type', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('print_product_review_stats')
      .select('*')
      .eq('product_id', product.id)
      .maybeSingle(),
    supabase
      .from('print_reviews')
      .select('id, reviewer_name, rating, title, body, source, disclosure_note, helpful_count, photos, created_at', { count: 'exact' })
      .eq('product_id', product.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(0, 9),
  ])

  const options = (optionsData as PrintProductOption[] | null) ?? []
  const initialStats = reviewStats as ReviewStats | null
  const initialReviews = (reviewsData ?? []) as Review[]
  const initialPagination: ReviewPagination = {
    page: 1,
    pageSize: 10,
    total: reviewsCount ?? 0,
    totalPages: Math.ceil((reviewsCount ?? 0) / 10),
  }

  const shippingUsd = getShippingCost('US')
  const features = PRODUCT_FEATURES[product.category] ?? []
  const competitorPrices = (competitorData as CompetitorPriceSummary[] | null) ?? []
  const templates = getTemplatesForProduct(product.category).slice(0, 8)

  return (
    <div className="min-h-screen bg-gray-50">
      <ViewItemTracker
        id={product.id}
        name={product.name_en}
        category={product.category}
      />
      {/* Product Main Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: Product Info */}
          <div>
            {/* Product Visual + Gallery */}
            <div className="mb-6">
              <ProductGallery
                heroUrl={product.hero_image_url ?? null}
                galleryUrls={(product as PrintProduct & { gallery_urls?: string[] | null }).gallery_urls ?? null}
                alt={product.name_en}
                fallback={<ProductImage category={product.category} />}
                gradientClass={PRODUCT_GRADIENT[product.category] ?? 'from-blue-50 to-indigo-100'}
              />
            </div>

            {/* Product Name + Badge */}
            <div className="flex items-start justify-between mb-1">
              <h1 className="text-3xl font-bold text-gray-900">{product.name_en}</h1>
              {product.badge_text_en && (
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap ${
                  product.is_premium ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                }`}>
                  {product.badge_text_en}
                </span>
              )}
            </div>
            {competitorPrices.length > 0 && (
              <div className="mb-3">
                <CompetitorPriceBadge prices={competitorPrices} />
              </div>
            )}
            {product.description_en && (
              <p className="text-gray-600 leading-relaxed mb-4">
                {product.description_en}
              </p>
            )}

            {/* Letterpress 전용: 긴 제작기간 안내 */}
            {product.category === 'letterpress_cards' && (
              <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    Production Lead Time: 30–40+ Business Days
                  </p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Letterpress is a fully handcrafted process. Each card is pressed individually on a vintage press — combined with our current order backlog, please allow <strong>30–40 business days</strong> for production before shipping. We appreciate your patience for this artisan product.
                  </p>
                </div>
              </div>
            )}

            {/* Recommended use + production time */}
            {(product.recommended_use_en || product.production_days_max) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-xs">
                {product.recommended_use_en && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <div className="font-semibold text-purple-800 mb-1">Best For</div>
                    <div className="text-purple-700">{product.recommended_use_en}</div>
                  </div>
                )}
                {product.production_days_max > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                    <div className="font-semibold text-orange-800 mb-1">Production Lead Time</div>
                    <div className="text-orange-700">
                      {formatProductionWindow(product, 'standard')}
                      <span className="text-orange-500"> · shipping calculated separately</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Product Features List */}
            {features.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Product Specs</h3>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Partnership Highlight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="font-semibold text-blue-800 text-sm mb-1">Global Factory Network</div>
                <div className="text-blue-600 text-xs leading-relaxed">Produced at the optimal factory worldwide for your order</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="font-semibold text-green-800 text-sm mb-1">Global Delivery</div>
                <div className="text-green-600 text-xs leading-relaxed">FedEx International Priority — 40+ countries</div>
              </div>
            </div>
          </div>

          {/* Right: Options + Price */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Configure Your Order</h2>
            {options.length > 0 ? (
              <ProductConfigurator
                product={product}
                options={options}
                exchangeRate={exchangeRate}
                shippingUsd={shippingUsd}
                swadpiaData={swadpiaData.fetchSuccess ? {
                  papers: swadpiaData.papers,
                  printEntries: swadpiaData.printEntries,
                  sizes: swadpiaData.sizes,
                } : undefined}
              />
            ) : (
              <div className="text-center py-10">
                <div className="text-4xl mb-4">📦</div>
                <p className="text-gray-800 font-semibold text-base mb-2">Custom Quote Required</p>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  This product requires custom specifications.<br />
                  Contact us for pricing and lead time.
                </p>
                <a
                  href="mailto:hello@procardcrafters.com"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  Get a Quote
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Gallery Section */}
      {templates.length > 0 && (
        <div className="bg-white border-t border-gray-100 py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LayoutTemplate className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Design Templates</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Start with a template</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Pick a professionally designed template and customize it in our editor
                </p>
              </div>
              <Link
                href={`/templates/${product.slug}`}
                className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Browse all {getTemplatesForProduct(product.category).length} templates
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {templates.map(template => {
                const isDark = isColorDark(template.bg)
                const textColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                const subColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'
                return (
                  <Link
                    key={template.name}
                    href={`/design/${product.slug}?template=${encodeURIComponent(template.name)}&bg=${encodeURIComponent(template.bg)}`}
                    className="group rounded-xl overflow-hidden border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div
                      className="h-28 relative overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: template.bg }}
                    >
                      {/* Accent circles */}
                      <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }} />
                      <div className="absolute -left-3 -top-3 w-12 h-12 rounded-full" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
                      {/* Simulated card content */}
                      <div className="relative text-center px-4">
                        <div className="w-6 h-1 rounded-full mx-auto mb-2" style={{ backgroundColor: textColor }} />
                        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textColor }}>
                          {template.name.split(' ')[0]}
                        </div>
                        <div className="w-8 h-0.5 rounded-full mx-auto mt-2" style={{ backgroundColor: subColor }} />
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors duration-200 flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-blue-700 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-md">
                          <Pencil className="w-3 h-3" /> Use
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-white">
                      <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                        {template.name}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">{template.description || template.category}</div>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/templates/${product.slug}`}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <LayoutTemplate className="w-4 h-4" />
                Browse all templates
              </Link>
              <Link
                href={`/design/${product.slug}`}
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl text-sm font-semibold hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Start from blank
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Trust Badges */}
      <div className="bg-gray-50 border-t border-gray-100 py-8 px-4">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <item.icon className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="border-t border-gray-100 bg-gray-50">
        <ProductReviews
          slug={product.slug}
          initialStats={initialStats}
          initialReviews={initialReviews}
          initialPagination={initialPagination}
        />
      </div>
    </div>
  )
}

function isColorDark(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}
