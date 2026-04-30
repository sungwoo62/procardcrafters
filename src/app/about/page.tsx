import { Metadata } from 'next'
import { Package, Globe, Zap, Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — Procardcrafters',
  description: 'Learn about Procardcrafters — premium printing distributed from Los Angeles and delivered worldwide.',
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
    desc: 'Customers in 40+ countries trust us for fast, reliable international delivery via FedEx and premium courier partners.',
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

const STATS = [
  { value: '40+', label: 'Countries served' },
  { value: '10k+', label: 'Orders fulfilled' },
  { value: '3–5', label: 'Day production' },
  { value: '4.9★', label: 'Average rating' },
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
            Premium Print, Distributed from LA
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Procardcrafters was built to give businesses everywhere access to high-quality
            printing — at fair prices, with no guesswork. Distributed from our Los Angeles facility.
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
            We use professional-grade printing equipment and premium materials. Our LA distribution
            center ensures fast delivery across the United States and worldwide.
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
