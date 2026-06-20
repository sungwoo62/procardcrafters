import Link from 'next/link'
import { Package, Mail, Globe } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-white mb-4">
              <Package className="w-5 h-5 text-blue-400" />
              <span>Procardcrafters</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Premium print products produced at certified global facilities,
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

          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Products</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/products/business-cards" className="hover:text-white transition-colors">Business Cards</Link></li>
              <li><Link href="/products/premium-business-cards" className="hover:text-white transition-colors">Premium Business Cards</Link></li>
              <li><Link href="/products/stickers" className="hover:text-white transition-colors">Stickers</Link></li>
              <li><Link href="/products/die-cut-stickers" className="hover:text-white transition-colors">Die-Cut Stickers</Link></li>
              <li><Link href="/products/flyers" className="hover:text-white transition-colors">Flyers</Link></li>
              <li><Link href="/products/brochures" className="hover:text-white transition-colors">Brochures</Link></li>
              <li><Link href="/products/postcards" className="hover:text-white transition-colors">Postcards</Link></li>
              <li><Link href="/products/posters" className="hover:text-white transition-colors">Posters</Link></li>
              <li><Link href="/products/banners" className="hover:text-white transition-colors">Banners</Link></li>
            </ul>

            {/* 직업별 명함 — 니치 랜딩 sitewide 인바운드 링크(OMO-2994, orphan 해소) */}
            <h3 className="text-sm font-semibold text-white mb-4 mt-8">Business Cards by Profession</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/business-cards/for/realtors" className="hover:text-white transition-colors">For Realtors</Link></li>
              <li><Link href="/business-cards/for/lawyers" className="hover:text-white transition-colors">For Lawyers</Link></li>
              <li><Link href="/business-cards/for/photographers" className="hover:text-white transition-colors">For Photographers</Link></li>
              <li><Link href="/business-cards/for/contractors" className="hover:text-white transition-colors">For Contractors</Link></li>
              <li><Link href="/business-cards/for/tattoo-artists" className="hover:text-white transition-colors">For Tattoo Artists</Link></li>
              <li><Link href="/business-cards/for" className="hover:text-white transition-colors font-medium text-gray-300">All professions →</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/refund" className="hover:text-white transition-colors">Refund &amp; Cancellation</Link></li>
              <li><Link href="/shipping" className="hover:text-white transition-colors">Shipping &amp; Customs</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Support</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/orders" className="hover:text-white transition-colors">Order Status</Link></li>
              <li><Link href="/shipping" className="hover:text-white transition-colors">Shipping &amp; Customs</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">File Upload Guide</Link></li>
            </ul>
            <div className="mt-6 bg-blue-600/20 border border-blue-500/30 rounded-xl p-3.5">
              <p className="text-xs text-blue-300 leading-relaxed">
                <span className="font-semibold block mb-1">Production Lead Time</span>
                7–10 business days standard<br />
                Express upgrade available at checkout. Shipping billed separately.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <span>© {new Date().getFullYear()} Procardcrafters. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <span>Global Production</span>
            <span>·</span>
            <span>Delivered Worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
