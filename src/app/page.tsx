import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Printer,
  Truck,
  Star,
  Upload,
  Settings,
  CreditCard,
  CheckCircle,
  Globe,
  Shield,
  Zap,
  Package,
  Clock,
  Sparkles,
  BadgeCheck,
  ChevronRight,
} from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate, krwToUsd } from '@/lib/exchange-rate'
import ProductImage from '@/components/ProductImage'
import { getActiveCampaigns, getTopPromoCode, getCampaignPriority } from '@/lib/promotion-engine'
import type { Campaign } from '@/lib/promotion-engine'
import CampaignHero from '@/components/CampaignHero'
import HomepageHeroTyping from '@/components/HomepageHeroTyping'
import HomepageStickyCTA from '@/components/HomepageStickyCTA'
import HomepageOrderTicker from '@/components/HomepageOrderTicker'

const PRODUCTS = [
  { slug: 'business-cards', category: 'business_cards', name: 'Business Cards', desc: 'Professional cards that make a lasting impression.', tag: 'Most Popular', tagColor: 'bg-blue-100 text-blue-700', gradient: 'from-blue-50 to-indigo-100', accent: 'border-blue-200', hot: true },
  { slug: 'premium-business-cards', category: 'premium_business_cards', name: 'Premium Business Cards', desc: 'Luxury cards on linen, pearl, and specialty paper.', tag: 'Premium', tagColor: 'bg-indigo-100 text-indigo-700', gradient: 'from-indigo-50 to-slate-100', accent: 'border-indigo-200', hot: false },
  { slug: 'stickers', category: 'stickers', name: 'Stickers', desc: 'Custom stickers in any shape or size.', tag: 'Fast Turnaround', tagColor: 'bg-yellow-100 text-yellow-700', gradient: 'from-yellow-50 to-orange-50', accent: 'border-yellow-200', hot: true },
  { slug: 'die-cut-stickers', category: 'die_cut_stickers', name: 'Die-Cut Stickers', desc: 'Custom-shaped stickers cut to your exact design.', tag: null, tagColor: '', gradient: 'from-amber-50 to-yellow-100', accent: 'border-amber-200', hot: false },
  { slug: 'flyers', category: 'flyers', name: 'Flyers', desc: 'Eye-catching flyers for promotions and events.', tag: null, tagColor: '', gradient: 'from-green-50 to-emerald-100', accent: 'border-green-200', hot: false },
  { slug: 'brochures', category: 'brochures', name: 'Brochures', desc: 'Folded brochures and leaflets for professional presentations.', tag: null, tagColor: '', gradient: 'from-teal-50 to-cyan-100', accent: 'border-teal-200', hot: false },
  { slug: 'postcards', category: 'postcards', name: 'Postcards', desc: 'Beautiful postcards for every occasion.', tag: null, tagColor: '', gradient: 'from-pink-50 to-rose-100', accent: 'border-pink-200', hot: false },
  { slug: 'posters', category: 'posters', name: 'Posters', desc: 'Large-format posters with vibrant colors.', tag: 'Best Value', tagColor: 'bg-purple-100 text-purple-700', gradient: 'from-purple-50 to-violet-100', accent: 'border-purple-200', hot: false },
  { slug: 'banners', category: 'banners', name: 'Banners', desc: 'Mini banners and signage for events and retail.', tag: null, tagColor: '', gradient: 'from-red-50 to-orange-100', accent: 'border-red-200', hot: false },
]

const STATS = [
  { value: '10,000+', label: 'Orders Placed', icon: '📦' },
  { value: '40+', label: 'Countries Shipped', icon: '🌏' },
  { value: '4.9★', label: 'Avg. Rating', icon: '⭐' },
  { value: '7–10 days', label: 'Production Lead Time', icon: '⚡' },
]

const FEATURES = [
  {
    icon: Printer,
    title: 'Offset Print Quality',
    desc: 'Produced on world-class Heidelberg and HP Indigo presses — multi-million-dollar machines — for professional CMYK+1 color, vibrant tones, and clean cuts.',
    color: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    icon: Truck,
    title: 'FedEx Worldwide Shipping',
    desc: 'FedEx Express worldwide shipping. 7–10 day production + 5–8 day delivery. Door-to-door worldwide.',
    color: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    icon: Star,
    title: 'Transparent Pricing',
    desc: 'Real-time exchange rate. Confirm your final USD price before checkout — no hidden fees.',
    color: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
]

const HOW_IT_WORKS = [
  { icon: Settings, step: '01', title: 'Configure Options', desc: 'Choose product, size, quantity, and finish. Price updates in real time.' },
  { icon: Upload, step: '02', title: 'Upload Your Design', desc: 'Upload PDF, AI, or PSD. Print readiness is auto-checked.' },
  { icon: CreditCard, step: '03', title: 'Secure Payment', desc: 'Secure checkout. Production starts immediately — no hidden fees.' },
  { icon: CheckCircle, step: '04', title: 'Receive Your Order', desc: '7–10 day production + FedEx shipping. Door-to-door anywhere in the world.' },
]

const STATIC_TESTIMONIALS = [
  {
    name: 'Sarah M.',
    role: 'Freelance Designer',
    initials: 'SM',
    color: 'bg-blue-600',
    rating: 5,
    product: 'Premium Business Cards',
    body: 'The quality blew me away. My clients always ask where I print — it\'s my secret weapon.',
  },
  {
    name: 'James K.',
    role: 'Small Business Owner',
    initials: 'JK',
    color: 'bg-green-600',
    rating: 5,
    product: 'Stickers 500pcs',
    body: 'Ordered 500 stickers and they arrived in under two weeks. Vibrant colors, perfect cuts. Will definitely reorder.',
  },
  {
    name: 'Priya S.',
    role: 'Event Planner',
    initials: 'PS',
    color: 'bg-purple-600',
    rating: 5,
    product: 'Flyers',
    body: 'I love the pricing transparency. I can give clients an exact quote right away.',
  },
]

const TRUST_ITEMS = [
  { icon: Shield, text: 'Quality Guarantee', sub: 'Free reprint if defective' },
  { icon: Zap, text: 'Fast Production', sub: '7–10 business days' },
  { icon: Globe, text: 'Worldwide Shipping', sub: 'FedEx Express' },
  { icon: Package, text: 'Safe Packaging', sub: 'Damage-free delivery' },
  { icon: BadgeCheck, text: 'Secure Payments', sub: '256-bit SSL' },
  { icon: Clock, text: 'Order Tracking', sub: 'Real-time updates' },
]

function pickTopCampaign(campaigns: Campaign[]): Campaign | null {
  if (campaigns.length === 0) return null
  return campaigns.reduce((best, c) =>
    getCampaignPriority(c.calendar.key) > getCampaignPriority(best.calendar.key) ? c : best,
  )
}

async function getFeaturedPortfolio() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('print_portfolio')
      .select('id, title, category, image_url, thumbnail_url')
      .eq('is_published', true)
      .eq('is_featured', true)
      .order('sort_order', { ascending: true })
      .limit(6)
    return data ?? []
  } catch {
    return []
  }
}

async function getFeaturedReviews() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('print_reviews')
      .select('id, reviewer_name, rating, featured_quote, body, created_at')
      .eq('is_homepage_featured', true)
      .eq('status', 'approved')
      .order('featured_sort', { ascending: true })
      .limit(3)
    return data ?? []
  } catch {
    return []
  }
}

async function getProductStartingPrices(): Promise<Record<string, number>> {
  try {
    const supabase = createServerClient()
    const slugs = PRODUCTS.map(p => p.slug)
    const [{ data: products }, rate] = await Promise.all([
      supabase
        .from('print_products')
        .select('slug, base_price_krw, margin_multiplier')
        .in('slug', slugs),
      getKrwToUsdRate(),
    ])
    const map: Record<string, number> = {}
    for (const p of products ?? []) {
      const usd = krwToUsd(p.base_price_krw * p.margin_multiplier, rate)
      if (usd > 0) map[p.slug] = usd
    }
    return map
  } catch {
    return {}
  }
}

export default async function HomePage() {
  const [featuredPortfolio, campaigns, reviews, startingPrices] = await Promise.all([
    getFeaturedPortfolio(),
    getActiveCampaigns().catch((): Campaign[] => []),
    getFeaturedReviews(),
    getProductStartingPrices(),
  ])

  const topCampaign = pickTopCampaign(campaigns)
  const promoCode = topCampaign
    ? await getTopPromoCode(topCampaign.id).catch(() => null)
    : null

  const displayReviews = reviews.length >= 2 ? reviews : null

  return (
    <>
      {/* Hero Section */}
      {topCampaign ? (
        <CampaignHero
          campaignKey={topCampaign.calendar.key}
          campaignSlug={topCampaign.calendar.key}
          headlineEn={topCampaign.headline_en ?? topCampaign.calendar.name_en}
          heroImageUrl={topCampaign.hero_image_url ?? null}
          promoCode={promoCode?.code ?? null}
          cutoffAt={topCampaign.order_cutoff_at ?? null}
        />
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 py-28 px-4">
          {/* Animated Background Blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-20 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          </div>

          {/* Grid Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative max-w-5xl mx-auto text-center">
            {/* 신뢰 pill */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-blue-200 text-xs font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              Trusted by 10,000+ customers worldwide
            </div>

            {/* 긴급성 pill */}
            <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/30 text-red-200 text-xs font-medium px-4 py-1.5 rounded-full mb-8 ml-2 backdrop-blur-sm">
              <Clock className="w-3.5 h-3.5" />
              This week closes Thursday 5PM KST
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
              Premium{' '}
              <HomepageHeroTyping />
              <br />
              <span className="text-blue-100/70 text-4xl sm:text-5xl lg:text-6xl font-semibold">
                Delivered Worldwide
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-blue-100/70 mb-10 max-w-2xl mx-auto leading-relaxed">
              Global production · Real-time pricing · No hidden fees · FedEx worldwide delivery
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-white text-blue-900 px-8 py-4 rounded-xl font-bold hover:bg-blue-50 transition-all text-base shadow-2xl shadow-blue-900/30 hover:scale-[1.02]"
              >
                Browse Products <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 bg-blue-600/80 border border-blue-400/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-600 transition-all text-base backdrop-blur-sm"
              >
                Order Now
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mini Stats in Hero */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {STATS.map(stat => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
                  <div className="text-xl mb-0.5">{stat.icon}</div>
                  <div className="text-lg font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-blue-300">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Real-time Order Ticker */}
      <HomepageOrderTicker />

      {/* Trust Badges Strip */}
      <section className="bg-white border-b border-gray-100 py-5 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {TRUST_ITEMS.map(item => (
              <div key={item.text} className="flex items-center gap-2 text-gray-700">
                <item.icon className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="text-sm font-semibold">{item.text}</span>
                  <span className="text-xs text-gray-400 ml-1.5">{item.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">All Products</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            What do you need printed?
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Configure your options and see the USD price instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRODUCTS.map((product) => {
            const startPrice = startingPrices[product.slug]
            return (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className={`group relative border ${product.accent} rounded-2xl overflow-hidden bg-white hover:shadow-2xl hover:shadow-gray-200/80 transition-all duration-300 hover:-translate-y-1`}
              >
                {product.hot && (
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm">
                    🔥 Popular
                  </div>
                )}

                {/* Thumbnail */}
                <div className={`h-44 bg-gradient-to-br ${product.gradient} flex items-center justify-center relative overflow-hidden`}>
                  <div className="w-40 h-32 group-hover:scale-110 transition-transform duration-500">
                    <ProductImage category={product.category} />
                  </div>
                  {product.tag && (
                    <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${product.tagColor}`}>
                      {product.tag}
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-lg leading-tight">
                      {product.name}
                    </h3>
                    {startPrice && startPrice > 0 && (
                      <span className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 whitespace-nowrap">
                        From ${startPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed">{product.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Live pricing · Order instantly</span>
                    <span className="flex items-center gap-1 text-sm text-blue-600 font-semibold group-hover:gap-2 transition-all">
                      Order Now <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 border-2 border-blue-600 text-blue-600 px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-600 hover:text-white transition-all text-sm"
          >
            View Full Product Catalog <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Order in 4 Simple Steps</h2>
            <p className="text-gray-500 text-lg">Set up in minutes, delivered in days.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, idx) => (
              <div key={step.step} className="relative">
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:flex absolute top-8 left-[calc(100%-1rem)] w-8 items-center justify-center z-10">
                    <ChevronRight className="w-5 h-5 text-blue-200" />
                  </div>
                )}
                <div className="relative bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-2xl font-bold text-sm mb-4 shadow-lg shadow-blue-200">
                    {step.step}
                  </div>
                  <div className="flex justify-center mb-3">
                    <step.icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-base">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us — Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Why Procardcrafters?</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Global Production · Worldwide Delivery</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Premium print quality produced at the most suitable global factory, delivered worldwide.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group relative rounded-2xl border border-gray-100 p-8 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-14 h-14 ${feature.color} rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-3 text-lg">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio Preview Section */}
      {featuredPortfolio.length > 0 && (
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Design Samples</p>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Sample Designs &amp; Finishes</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                A showcase of the print styles, stocks, and finishes we offer.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
              {featuredPortfolio.map((item) => (
                <Link
                  key={item.id}
                  href="/portfolio"
                  className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <Image
                    src={item.thumbnail_url ?? item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-white text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center">
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-gray-400 hover:bg-white transition-all text-sm"
              >
                View Full Portfolio <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Reviews Section */}
      <section className="py-20 px-4 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Customer Reviews</p>
            <h2 className="text-4xl font-bold text-white mb-4">What Our Customers Say</h2>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-gray-400">4.9 / 5.0 from 800+ verified reviews</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(displayReviews ?? STATIC_TESTIMONIALS).map((review, i) => {
              const isDb = displayReviews !== null
              const name = isDb ? (review as { reviewer_name: string }).reviewer_name : (review as typeof STATIC_TESTIMONIALS[0]).name
              const rating = isDb ? (review as { rating: number }).rating : (review as typeof STATIC_TESTIMONIALS[0]).rating
              const body = isDb
                ? ((review as { featured_quote?: string; body: string }).featured_quote ?? (review as { body: string }).body)
                : (review as typeof STATIC_TESTIMONIALS[0]).body
              const initials = name.slice(0, 2).toUpperCase()
              const colors = ['bg-blue-600', 'bg-green-600', 'bg-purple-600']
              return (
                <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(rating)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-5 line-clamp-4">"{body}"</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 ${colors[i % colors.length]} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{name}</div>
                      {!isDb && (
                        <div className="text-gray-400 text-xs">{(review as typeof STATIC_TESTIMONIALS[0]).role}</div>
                      )}
                    </div>
                    <div className="ml-auto">
                      <BadgeCheck className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-28 px-4 text-center overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-6 border border-white/30">
            <Printer className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Start Your Order Today</h2>
          <p className="text-blue-100 mb-10 text-lg leading-relaxed">
            Configure your options online and get an instant USD quote.<br />
            No account required to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 px-10 py-4 rounded-xl font-bold hover:bg-blue-50 transition-all text-base shadow-2xl hover:scale-[1.02]"
            >
              Browse Products <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/40 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors text-base backdrop-blur-sm"
            >
              Contact Us
            </Link>
          </div>
          <p className="text-blue-200/70 text-sm mt-6">
            This week closes Thursday 5PM KST · 7–10 day production · FedEx shipping
          </p>
        </div>
      </section>

      <HomepageStickyCTA />
    </>
  )
}
