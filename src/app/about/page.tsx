import { Metadata } from 'next'
import { Package, Globe, Zap, Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — Procardcrafters',
  description: 'Learn about Procardcrafters — premium printing produced at certified global facilities and delivered worldwide.',
}

const VALUES = [
  {
    icon: Package,
    title: 'Quality Craftsmanship',
    desc: "We partner with top printing facilities — the same production lines used by global brands. Every product meets exacting quality standards.",
  },
  {
    icon: Globe,
    title: 'Global Reach',
    desc: 'We ship worldwide via FedEx Express and premium courier partners — fast, reliable, door-to-door international delivery.',
  },
  {
    icon: Zap,
    title: 'Simple & Transparent',
    desc: 'No hidden fees. Real-time exchange rates. Upload your file, choose your options, and get a firm price before you pay.',
  },
  {
    icon: Shield,
    title: 'Quality Guarantee',
    desc: "If your order doesn't meet our quality standards, we'll reprint or refund — no questions asked.",
  },
]

// ⚠️ 정직화(OMO-2975): 출처불명 합산/평점 stat 금지. 검증가능한 운영 사실만 노출.
const STATS = [
  { value: 'Offset', label: 'Print quality' },
  { value: 'FedEx', label: 'Worldwide shipping' },
  { value: '7–10 days', label: 'Production lead time' },
  { value: 'Secure', label: 'PayPal checkout' },
]

// AEO 인용가능 팩트블록(OMO-4026): 옵션·소재·가격·리드타임을 표로.
// 전 항목 검증된 사실만(finishing-catalog / lead-time.ts / page 데이터 기준). placeholder 금지.
const FACT_ROWS: { label: string; value: string }[] = [
  { label: 'Product categories', value: 'Business cards, premium business cards, stickers, die-cut stickers, flyers, brochures, postcards, posters, banners' },
  { label: 'Premium finishes', value: 'Gold foil stamping, deboss/emboss, epoxy 3D resin, matte/gloss coating, Pantone spot color, rounded corners, die cut' },
  { label: 'Premium paper stocks', value: 'Linen, pearl, and specialty stocks (standard coated/uncoated on Business Cards)' },
  { label: 'Print method', value: 'Offset presses (Heidelberg / HP Indigo), CMYK + spot color' },
  { label: 'Accepted file formats', value: 'PDF (recommended), AI, PSD' },
  { label: 'Production lead time', value: 'Standard ~7–10 business days; Express skips 3 buffer days (+25%)' },
  { label: 'Shipping', value: 'FedEx Express worldwide, door-to-door (typically 5–8 days after production)' },
  { label: 'Pricing', value: 'USD, real-time exchange rate, volume pricing on every product, no hidden fees' },
  { label: 'Payment', value: 'Secure checkout via PayPal and card' },
  { label: 'Service area', value: 'United States and worldwide' },
]

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-6">
            <Package className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Premium Print, Produced for the World
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Procardcrafters was built to give businesses everywhere access to high-quality
            printing — at fair prices, with no guesswork. Produced at the most suitable factory in our global network.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-white py-10 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-blue-600 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Story</h2>
        <div className="prose prose-gray max-w-none space-y-4 text-gray-600 leading-relaxed">
          <p>
            We use professional-grade printing equipment and premium materials. Each order is
            produced at the most suitable factory in our global network, ensuring quality and fast delivery worldwide.
          </p>
          <p>
            Procardcrafters handles all the logistics and delivers your finished prints wherever
            you are in the world. Our online configurator gives you instant pricing so there are
            no surprises at checkout.
          </p>
          <p>
            Whether you're a solo designer ordering 50 business cards or a brand needing thousands
            of promotional pieces, we treat every order with the same attention to detail.
          </p>
        </div>
      </section>

      {/* At a Glance — AI 인용가능 팩트블록(OMO-4026) */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pro Card Crafters at a Glance</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <tbody>
                {FACT_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? 'bg-gray-50/60' : 'bg-white'}>
                    <th scope="row" className="align-top px-5 py-3 font-semibold text-gray-900 whitespace-nowrap w-1/3">
                      {row.label}
                    </th>
                    <td className="px-5 py-3 text-gray-600 leading-relaxed">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">What We Stand For</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg mb-4">
                  <v.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Order?</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Browse our products, configure your options, and get an instant price — no account required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Browse Products
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:border-gray-400 transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </>
  )
}
