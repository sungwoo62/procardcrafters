'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, Menu, X, ChevronDown, ArrowRight } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import AuthButton from './AuthButton'
import { PRODUCT_GROUPS } from '@/config/product-nav'

const NAV_LINKS = [
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]

const ITEMS_PER_GROUP = 6

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(null)
  const pathname = usePathname()
  const productsRef = useRef<HTMLDivElement>(null)

  const closeMega = useCallback(() => setProductsOpen(false), [])

  // 클릭 바깥 + Escape 시 닫기
  useEffect(() => {
    if (!productsOpen) return
    const onDown = (e: MouseEvent) => {
      if (productsRef.current && !productsRef.current.contains(e.target as Node)) closeMega()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMega() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [productsOpen, closeMega])

  // 라우트 변경 시 메뉴 닫기
  useEffect(() => {
    setProductsOpen(false)
    setMobileOpen(false)
  }, [pathname])

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
            <div ref={productsRef} className="relative">
              <button
                type="button"
                onClick={() => setProductsOpen(v => !v)}
                onMouseEnter={() => setProductsOpen(true)}
                aria-expanded={productsOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  productsOpen || pathname.startsWith('/products')
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Products <ChevronDown className={`w-3.5 h-3.5 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
              </button>

              {productsOpen && (
                <div
                  onMouseLeave={() => setProductsOpen(false)}
                  className="absolute top-full left-1/2 -translate-x-1/2 bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-gray-300/40 z-50 w-[min(960px,calc(100vw-2rem))] overflow-hidden"
                >
                  {/* 1px invisible bridge to keep hover continuous between trigger and panel */}
                  <div className="grid grid-cols-3 gap-x-6 gap-y-8 p-7">
                    {PRODUCT_GROUPS.map(group => {
                      const items = group.items.slice(0, ITEMS_PER_GROUP)
                      const remaining = group.items.length - items.length
                      return (
                        <div key={group.key}>
                          <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-gray-100">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-900">
                              {group.title}
                            </h3>
                            <span className="text-[10px] text-gray-400">{group.items.length}</span>
                          </div>
                          <ul className="space-y-0.5">
                            {items.map(item => (
                              <li key={item.slug}>
                                <Link
                                  href={`/products/${item.slug}`}
                                  onClick={closeMega}
                                  className={`block py-1 text-sm transition-colors ${
                                    pathname === `/products/${item.slug}`
                                      ? 'text-blue-600 font-medium'
                                      : 'text-gray-600 hover:text-blue-600'
                                  }`}
                                >
                                  {item.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                          {remaining > 0 && (
                            <Link
                              href={`/products#${group.key}`}
                              onClick={closeMega}
                              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              +{remaining} more <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Bottom strip — Moo 식 footer CTA */}
                  <div className="bg-gray-50 border-t border-gray-100 px-7 py-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">61 products</span> · printed in LA, delivered worldwide
                    </div>
                    <Link
                      href="/products"
                      onClick={closeMega}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Shop all products <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
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
              type="button"
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
              Shop all products
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
