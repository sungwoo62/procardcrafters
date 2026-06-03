'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, Menu, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import AuthButton from './AuthButton'
import { PRODUCT_GROUPS } from '@/config/product-nav'

const NAV_LINKS = [
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(PRODUCT_GROUPS[0]?.key ?? null)
  const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(null)
  const pathname = usePathname()

  const activeGroup = PRODUCT_GROUPS.find(g => g.key === hoveredGroup) ?? PRODUCT_GROUPS[0]

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
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl shadow-gray-200/60 z-50 w-[820px] max-w-[calc(100vw-2rem)] overflow-hidden">
                  <div className="grid grid-cols-[220px,1fr]">
                    {/* 좌측: 상위 그룹 리스트 */}
                    <div className="bg-gray-50 border-r border-gray-100 py-3">
                      {PRODUCT_GROUPS.map(group => (
                        <button
                          key={group.key}
                          type="button"
                          onMouseEnter={() => setHoveredGroup(group.key)}
                          onFocus={() => setHoveredGroup(group.key)}
                          className={`w-full text-left flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                            hoveredGroup === group.key
                              ? 'bg-white text-blue-600 font-semibold'
                              : 'text-gray-700 hover:bg-white hover:text-gray-900'
                          }`}
                        >
                          <div>
                            <div className="leading-tight">{group.title}</div>
                            <div className={`text-[11px] mt-0.5 ${hoveredGroup === group.key ? 'text-blue-500' : 'text-gray-400'}`}>{group.description}</div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        </button>
                      ))}
                    </div>

                    {/* 우측: 활성 그룹의 하위 슬러그 */}
                    <div className="p-5">
                      <div className="mb-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{activeGroup.title}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{activeGroup.description}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        {activeGroup.items.map(item => (
                          <Link
                            key={item.slug}
                            href={`/products/${item.slug}`}
                            className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                              pathname === `/products/${item.slug}`
                                ? 'text-blue-600 bg-blue-50 font-medium'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <Link
                          href="/products"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          View all products <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {NAV_LINKS.map(link => (
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
            {PRODUCT_GROUPS.map(group => {
              const open = mobileGroupOpen === group.key
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    onClick={() => setMobileGroupOpen(open ? null : group.key)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    <span>{group.title}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="pb-2">
                      {group.items.map(item => (
                        <Link
                          key={item.slug}
                          href={`/products/${item.slug}`}
                          className={`block px-7 py-2 text-sm transition-colors ${
                            pathname === `/products/${item.slug}`
                              ? 'text-blue-600 bg-blue-50'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          onClick={() => setMobileOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <Link
              href="/products"
              className="block px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 border-t border-gray-100 mt-1"
              onClick={() => setMobileOpen(false)}
            >
              View all products
            </Link>
            <div className="border-t border-gray-100 mt-1 pt-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/orders"
                className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                Order Status
              </Link>
              <Link
                href="/mypage"
                className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
