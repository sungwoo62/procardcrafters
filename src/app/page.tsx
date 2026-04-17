import Link from 'next/link'
import { ArrowRight, Printer, Truck, Star, Upload, Settings, CreditCard, CheckCircle } from 'lucide-react'

const PRODUCTS = [
  { slug: 'business-cards', name: 'Business Cards', emoji: '🪪', desc: 'Professional cards that make a lasting impression.' },
  { slug: 'stickers', name: 'Stickers', emoji: '⭐', desc: 'Custom stickers in any shape or size.' },
  { slug: 'flyers', name: 'Flyers', emoji: '📄', desc: 'Eye-catching flyers for promotions and events.' },
  { slug: 'postcards', name: 'Postcards', emoji: '💌', desc: 'Beautiful postcards for every occasion.' },
  { slug: 'posters', name: 'Posters', emoji: '🖼️', desc: 'Large-format posters with vibrant colors.' },
]

const FEATURES = [
  { icon: Printer, title: 'Korean Quality', desc: 'Printed in Korea with top-tier equipment and premium materials.' },
  { icon: Truck, title: 'Global Delivery', desc: 'Fast international shipping via FedEx — delivered to your door.' },
  { icon: Star, title: 'Transparent Pricing', desc: 'Real-time exchange rates. No hidden fees. Firm price before you pay.' },
]

const HOW_IT_WORKS = [
  { icon: Settings, step: '1', title: 'Configure', desc: 'Choose your product, size, quantity, and finish options.' },
  { icon: Upload, step: '2', title: 'Upload', desc: 'Upload your design file (PDF, AI, or PSD).' },
  { icon: CreditCard, step: '3', title: 'Pay', desc: 'Secure checkout via Stripe. Production starts immediately.' },
  { icon: CheckCircle, step: '4', title: 'Receive', desc: 'Printed in Korea and delivered worldwide in 7–12 days.' },
]

const TESTIMONIALS = [
  {
    name: 'Sarah M.',
    role: 'Freelance Designer',
    body: 'The quality blew me away. My clients always ask where I get my business cards printed — I keep it as my secret weapon.',
  },
  {
    name: 'James K.',
    role: 'Small Business Owner',
    body: 'Ordered 500 stickers and they arrived in under two weeks. Crisp colors, perfect cuts. Will definitely reorder.',
  },
  {
    name: 'Priya S.',
    role: 'Event Planner',
    body: "The pricing is incredibly fair and there's zero guesswork. I can tell clients exact costs right away.",
  },
]

export default function HomePage() {
  return (
    <>
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Star className="w-3.5 h-3.5" /> Trusted by 10,000+ customers in 40+ countries
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Premium Print,{' '}
            <span className="text-blue-600">Shipped From Korea</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Business cards, stickers, flyers, postcards, and posters — printed with
            Korean precision and delivered worldwide. Real-time pricing, no surprises.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-7 py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-base"
            >
              Shop Now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-7 py-3.5 rounded-lg font-semibold hover:border-gray-400 transition-colors text-base"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* 신뢰 배지 */}
      <section className="border-y border-gray-100 bg-white py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-gray-500 font-medium">
          <span>✓ 3–5 day production</span>
          <span>✓ FedEx international shipping</span>
          <span>✓ PDF / AI / PSD accepted</span>
          <span>✓ Secure Stripe payments</span>
          <span>✓ Quality guarantee</span>
        </div>
      </section>

      {/* 상품 그리드 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Our Products</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Every product is configurable — pick your options and get an instant price.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRODUCTS.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group border border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all bg-white"
            >
              <div className="text-5xl mb-4">{product.emoji}</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-lg mb-1">
                {product.name}
              </h3>
              <p className="text-sm text-gray-500 mb-4">{product.desc}</p>
              <div className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                Configure & Order <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How It Works</h2>
            <p className="text-gray-500">Order in minutes, delivered in days.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full font-bold text-sm mb-4">
                  {step.step}
                </div>
                <div className="flex justify-center mb-3">
                  <step.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 특징 섹션 */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Why Procardcrafters?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="text-center px-4">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-2xl mb-5">
                  <feature.icon className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 후기 섹션 */}
      <section className="bg-blue-600 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">What Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{t.body}"</p>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                  <div className="text-gray-400 text-xs">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Print?</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Configure your order online and get an instant quote. No account required to get started.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-base"
        >
          Browse Products <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </>
  )
}
