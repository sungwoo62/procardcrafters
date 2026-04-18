import Link from 'next/link'
import { Package, Mail, Globe } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          {/* 브랜드 */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-white mb-4">
              <Package className="w-5 h-5 text-blue-400" />
              <span>Procardcrafters</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Premium print products made in Korea,
              delivered worldwide with FedEx.
            </p>
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> procardcrafters.com
              </span>
              <Link href="/contact" className="flex items-center gap-2 hover:text-gray-300 transition-colors">
                <Mail className="w-3.5 h-3.5" /> Get in touch
              </Link>
            </div>
          </div>

          {/* 상품 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Products</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/products/business-cards" className="hover:text-white transition-colors">Business Cards</Link></li>
              <li><Link href="/products/stickers" className="hover:text-white transition-colors">Stickers</Link></li>
              <li><Link href="/products/flyers" className="hover:text-white transition-colors">Flyers</Link></li>
              <li><Link href="/products/postcards" className="hover:text-white transition-colors">Postcards</Link></li>
              <li><Link href="/products/posters" className="hover:text-white transition-colors">Posters</Link></li>
            </ul>
          </div>

          {/* 회사 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* 고객지원 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Support</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/orders" className="hover:text-white transition-colors">Order Status</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">Shipping Info</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">File Upload Guide</Link></li>
            </ul>
            <div className="mt-6 bg-blue-600/20 border border-blue-500/30 rounded-xl p-3.5">
              <p className="text-xs text-blue-300 leading-relaxed">
                <span className="font-semibold block mb-1">Production Hours</span>
                Mon–Fri 9:00–18:00 KST<br />
                Orders placed before 15:00 start same day.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <span>© {new Date().getFullYear()} Procardcrafters. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <span>Printed in Korea</span>
            <span>·</span>
            <span>Delivered Worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
