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
} from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import ProductImage from '@/components/ProductImage'

const PRODUCTS = [
  { slug: 'business-cards', category: 'business_cards', name: 'Business Cards', desc: 'Professional cards that make a lasting impression.', tag: 'Most Popular', tagColor: 'bg-blue-100 text-blue-700', gradient: 'from-blue-50 to-indigo-100', accent: 'border-blue-200' },
  { slug: 'premium-business-cards', category: 'premium_business_cards', name: 'Premium Business Cards', desc: 'Luxury cards on linen, pearl, and specialty paper.', tag: 'Premium', tagColor: 'bg-indigo-100 text-indigo-700', gradient: 'from-indigo-50 to-slate-100', accent: 'border-indigo-200' },
  { slug: 'stickers', category: 'stickers', name: 'Stickers', desc: 'Custom stickers in any shape or size.', tag: 'Fast Turnaround', tagColor: 'bg-yellow-100 text-yellow-700', gradient: 'from-yellow-50 to-orange-50', accent: 'border-yellow-200' },
  { slug: 'die-cut-stickers', category: 'die_cut_stickers', name: 'Die-Cut Stickers', desc: 'Custom-shaped stickers cut to your exact design.', tag: null, tagColor: '', gradient: 'from-amber-50 to-yellow-100', accent: 'border-amber-200' },
  { slug: 'flyers', category: 'flyers', name: 'Flyers', desc: 'Eye-catching flyers for promotions and events.', tag: null, tagColor: '', gradient: 'from-green-50 to-emerald-100', accent: 'border-green-200' },
  { slug: 'brochures', category: 'brochures', name: 'Brochures', desc: 'Folded brochures and leaflets for professional presentations.', tag: null, tagColor: '', gradient: 'from-teal-50 to-cyan-100', accent: 'border-teal-200' },
  { slug: 'postcards', category: 'postcards', name: 'Postcards', desc: 'Beautiful postcards for every occasion.', tag: null, tagColor: '', gradient: 'from-pink-50 to-rose-100', accent: 'border-pink-200' },
  { slug: 'posters', category: 'posters', name: 'Posters', desc: 'Large-format posters with vibrant colors.', tag: 'Best Value', tagColor: 'bg-purple-100 text-purple-700', gradient: 'from-purple-50 to-violet-100', accent: 'border-purple-200' },
  { slug: 'banners', category: 'banners', name: 'Banners', desc: 'Mini banners and signage for events and retail.', tag: null, tagColor: '', gradient: 'from-red-50 to-orange-100', accent: 'border-red-200' },
]

const STATS = [
  { value: '10,000+', label: 'Orders Delivered' },
  { value: '40+', label: 'Countries Served' },
  { value: '4.9★', label: 'Average Rating' },
  { value: '3–5 Days', label: 'Production Time' },
]

const FEATURES = [
  {
    icon: Printer,
    title: 'Print Quality',
    desc: 'Professional offset and digital press printing with CMYK+1 color options. Distributed from Los Angeles.',
  },
  {
    icon: Truck,
    title: 'Global FedEx Delivery',
    desc: 'Express shipping from Los Angeles. Most destinations receive orders in 7–12 business days door-to-door.',
  },
  {
    icon: Star,
    title: 'Transparent Pricing',
    desc: 'Live KRW→USD exchange rates built in. Final price is shown before checkout — zero hidden fees, guaranteed.',
  },
]

const HOW_IT_WORKS = [
  { icon: Settings, step: '1', title: 'Configure', desc: 'Choose product, size, quantity, and finish options. Price updates in real time.' },
  { icon: Upload, step: '2', title: 'Upload', desc: 'Upload your design file (PDF, AI, or PSD). We verify print-readiness.' },
  { icon: CreditCard, step: '3', title: 'Pay', desc: 'Secure Stripe checkout. Production begins as soon as payment clears.' },
  { icon: CheckCircle, step: '4', title: 'Receive', desc: 'Printed and delivered worldwide in 7–12 business days.' },
]

const TESTIMONIALS = [
  {
    name: 'Sarah M.',
    role: 'Freelance Designer',
    initials: 'SM',
    color: 'bg-blue-600',
    body: 'The quality blew me away. My clients always ask where I get my business cards printed — I keep it as my secret weapon.',
  },
  {
    name: 'James K.',
    role: 'Small Business Owner',
    initials: 'JK',
    color: 'bg-green-600',
    body: 'Ordered 500 stickers and they arrived in under two weeks. Crisp colors, perfect cuts. Will definitely reorder.',
  },
  {
    name: 'Priya S.',
    role: 'Event Planner',
    initials: 'PS',
    color: 'bg-purple-600',
    body: "The pricing is incredibly fair and there's zero guesswork. I can tell clients exact costs right away.",
  },
]

const GUARANTEES = [
  { icon: Shield, text: 'Quality Guarantee' },
  { icon: Zap, text: '3–5 Day Production' },
  { icon: Globe, text: 'Worldwide Shipping' },
  { icon: Package, text: 'Secure Packaging' },
]

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

export default async function HomePage() {
  const featuredPortfolio = await getFeaturedPortfolio()
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 py-28 px-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-medium px-4 py-1.5 rounded-full mb-8 backdrop-blur-sm">
            <Star className="w-3.5 h-3.5 fill-blue-300 text-blue-300" /> Trusted by 10,000+ customers in 40+ countries
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
            Premium Print,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
              Delivered Worldwide
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-blue-100/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            Business cards, stickers, flyers, postcards, and posters —
            printed with precision. Real-time pricing, no surprises.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-900 px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-50 transition-colors text-base shadow-lg shadow-blue-900/20"
            >
              Shop Now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-colors text-base backdrop-blur-sm"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Badges */}
      <section className="bg-white border-b border-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Product Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Products</h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Every product is fully configurable — pick your options and get an instant USD price.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRODUCTS.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className={`group relative border ${product.accent} rounded-2xl overflow-hidden bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
            >
              {/* Thumbnail */}
              <div className={`h-44 bg-gradient-to-br ${product.gradient} flex items-center justify-center relative`}>
                <div className="w-40 h-32 group-hover:scale-105 transition-transform duration-300">
                  <ProductImage category={product.category} />
                </div>
                {product.tag && (
                  <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${product.tagColor}`}>
                    {product.tag}
                  </span>
                )}
              </div>

              <div className="p-5">
                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-lg mb-1.5">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{product.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Configure & get instant price</span>
                  <span className="flex items-center gap-1 text-sm text-blue-600 font-semibold">
                    Order <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-500 text-lg">Order in minutes, delivered in days.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, idx) => (
              <div key={step.step} className="relative">
                {/* Connector */}
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-[calc(100%-0.75rem)] w-full h-0.5 bg-blue-100 z-0" />
                )}
                <div className="relative bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full font-bold text-sm mb-4 shadow-md shadow-blue-200">
                    {step.step}
                  </div>
                  <div className="flex justify-center mb-3">
                    <step.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-base">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Procardcrafters?</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              We combine manufacturing excellence with LA-based distribution.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group text-center px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-6 group-hover:bg-blue-100 transition-colors">
                  <feature.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-3 text-lg">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quality Guarantee Badges */}
      <section className="bg-blue-50 border-y border-blue-100 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-x-12 gap-y-4">
          {GUARANTEES.map((g) => (
            <div key={g.text} className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <g.icon className="w-4 h-4" />
              {g.text}
            </div>
          ))}
        </div>
      </section>

      {/* Portfolio Preview Section */}
      {featuredPortfolio.length > 0 && (
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Our Work</p>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Recent Print Projects</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                See what we&apos;ve printed for customers around the world.
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
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

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-white mb-4">What Customers Say</h2>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-gray-400">4.9 out of 5 from 800+ verified reviews</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-5">"{t.body}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 ${t.color} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{t.name}</div>
                    <div className="text-gray-400 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-4 text-center bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-6">
            <Printer className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to Print?</h2>
          <p className="text-gray-500 mb-8 text-lg leading-relaxed">
            Configure your order online and get an instant quote.
            No account required to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-base shadow-lg shadow-blue-200"
            >
              Browse Products <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-8 py-4 rounded-xl font-semibold hover:border-gray-300 transition-colors text-base"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
