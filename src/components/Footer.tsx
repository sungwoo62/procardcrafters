import Link from 'next/link'
import { Package } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* 브랜드 */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-gray-900 mb-3">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Procardcrafters</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Premium print products made in Korea, delivered worldwide.
            </p>
          </div>

          {/* 상품 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Products</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/products/business-cards" className="hover:text-gray-900 transition-colors">Business Cards</Link></li>
              <li><Link href="/products/stickers" className="hover:text-gray-900 transition-colors">Stickers</Link></li>
              <li><Link href="/products/flyers" className="hover:text-gray-900 transition-colors">Flyers</Link></li>
              <li><Link href="/products/postcards" className="hover:text-gray-900 transition-colors">Postcards</Link></li>
              <li><Link href="/products/posters" className="hover:text-gray-900 transition-colors">Posters</Link></li>
            </ul>
          </div>

          {/* 회사 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/about" className="hover:text-gray-900 transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-gray-900 transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* 고객지원 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/orders" className="hover:text-gray-900 transition-colors">Order Status</Link></li>
              <li><Link href="/faq" className="hover:text-gray-900 transition-colors">FAQ</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span>© {new Date().getFullYear()} Procardcrafters. All rights reserved.</span>
          <span>Printed in Korea · Delivered Worldwide</span>
        </div>
      </div>
    </footer>
  )
}
