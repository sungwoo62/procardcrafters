import Link from 'next/link'
import { ArrowRight, Printer, Truck, Star } from 'lucide-react'

const PRODUCTS = [
  { slug: 'business-cards', name: 'Business Cards', emoji: '🪪', desc: 'Professional cards that make a lasting impression.' },
  { slug: 'stickers', name: 'Stickers', emoji: '⭐', desc: 'Custom stickers in any shape or size.' },
  { slug: 'flyers', name: 'Flyers', emoji: '📄', desc: 'Eye-catching flyers for promotions and events.' },
  { slug: 'postcards', name: 'Postcards', emoji: '💌', desc: 'Beautiful postcards for every occasion.' },
  { slug: 'posters', name: 'Posters', emoji: '🖼️', desc: 'Large-format posters with vibrant colors.' },
]

const FEATURES = [
  { icon: Printer, title: 'Korean Quality', desc: 'Printed in Korea with top-tier equipment and materials.' },
  { icon: Truck, title: 'Global Delivery', desc: 'Fast international shipping via FedEx and partners.' },
  { icon: Star, title: 'Competitive Pricing', desc: 'Premium quality at fair prices with transparent rates.' },
]

export default function HomePage() {
  return (
    <>
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Premium Print, <span className="text-blue-600">Worldwide</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            High-quality printing from Korea — business cards, stickers, flyers, postcards, and posters — delivered to your door.
          </p>
          <Link
            href="/products/business-cards"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Shop Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 상품 그리드 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Our Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRODUCTS.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all bg-white"
            >
              <div className="text-4xl mb-3">{product.emoji}</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                {product.name}
              </h3>
              <p className="text-sm text-gray-500">{product.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-sm text-blue-600 font-medium">
                Configure & Order <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 특징 섹션 */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Why Procardcrafters?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
