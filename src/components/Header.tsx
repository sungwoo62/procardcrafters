'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, Menu, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import AuthButton from './AuthButton'

const PRODUCT_GROUPS = [
  {
    title: 'Cards',
    items: [
      { href: '/products/business-cards', label: 'Business Cards' },
      { href: '/products/premium-business-cards', label: 'Premium Business Cards' },
      { href: '/products/postcards', label: 'Postcards' },
    ],
  },
  {
    title: 'Stickers',
    items: [
      { href: '/products/stickers', label: 'Stickers' },
      { href: '/products/die-cut-stickers', label: 'Die-Cut Stickers' },
    ],
  },
  {
    title: 'Print',
    items: [
      { href: '/products/flyers', label: 'Flyers' },
      { href: '/products/brochures', label: 'Brochures' },
      { href: '/products/posters', label: 'Posters' },
      { href: '/products/banners', label: 'Banners' },
    ],
  },
]

const ALL_PRODUCTS = PRODUCT_GROUPS.flatMap((g) => g.items)

const NAV_LINKS = [
  { href: '/portfolio', label: 'Portfolio' },
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
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
            <span>Procardcrafters</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Products Mega Dropdown */}
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
                Products <ChevronDown className={`w-3.5 h-3.5 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
              </button>

              {productsOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-4 px-2 z-50 w-[480px]">
                  <div className="grid grid-cols-3 gap-1">
                    {PRODUCT_GROUPS.map((group) => (
                      <div key={group.title}>
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          {group.title}
                        </div>
                        {group.items.map((product) => (
                          <Link
                            key={product.href}
                            href={product.href}
                            className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                              pathname === product.href
                                ? 'text-blue-600 bg-blue-50 font-medium'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            {product.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 px-3">
                    <Link
                      href="/products"
                      className="flex items-center justify-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      View All Products
                    </Link>
                  </div>
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <AuthButton />
            <Link
              href="/orders"
              className="hidden sm:inline-flex items-center text-sm text-gray-500 hover:text-gray-900 px-3 py-2 transition-colors"
            >
              Order Status
            </Link>
            <Link
              href="/cart"
              className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white max-h-[80vh] overflow-y-auto">
          <nav className="flex flex-col py-2">
            {PRODUCT_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {group.title}
                </div>
                {group.items.map((product) => (
                  <Link
                    key={product.href}
                    href={product.href}
                    className={`block px-6 py-2.5 text-sm font-medium transition-colors ${
                      pathname === product.href
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {product.label}
                  </Link>
                ))}
              </div>
            ))}
            <Link
              href="/products"
              className="block px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100 mt-1"
              onClick={() => setMobileOpen(false)}
            >
              View All Products
            </Link>
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
              <Link
                href="/mypage"
                className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                My Account
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
