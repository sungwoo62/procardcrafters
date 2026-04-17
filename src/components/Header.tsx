'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, Menu, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const PRODUCTS = [
  { href: '/products/business-cards', label: 'Business Cards', emoji: '🪪' },
  { href: '/products/stickers', label: 'Stickers', emoji: '⭐' },
  { href: '/products/flyers', label: 'Flyers', emoji: '📄' },
  { href: '/products/postcards', label: 'Postcards', emoji: '💌' },
  { href: '/products/posters', label: 'Posters', emoji: '🖼️' },
]

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
            <span>Procardcrafters</span>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            {/* 상품 드롭다운 */}
            <div
              className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/products')
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Products <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {productsOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                  <Link
                    href="/products"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 font-medium hover:text-gray-900 transition-colors border-b border-gray-100"
                  >
                    All Products
                  </Link>
                  {PRODUCTS.map((product) => (
                    <Link
                      key={product.href}
                      href={product.href}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      <span>{product.emoji}</span>
                      {product.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="hidden sm:inline-flex items-center text-sm text-gray-500 hover:text-gray-900 px-3 py-2 transition-colors"
            >
              Order Status
            </Link>
            <Link
              href="/cart"
              className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="장바구니"
            >
              <ShoppingCart className="w-5 h-5" />
            </Link>

            {/* 모바일 메뉴 버튼 */}
            <button
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="메뉴"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="flex flex-col py-2">
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Products
            </div>
            {PRODUCTS.map((product) => (
              <Link
                key={product.href}
                href={product.href}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                <span>{product.emoji}</span>
                {product.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/orders"
                className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Order Status
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
