'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, Menu, X, ChevronDown, ArrowRight } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import AuthButton from './AuthButton'
import { PRODUCT_GROUPS } from '@/config/product-nav'
import type { ProductCardData } from '@/app/layout'

const NAV_LINKS = [
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]

const FEATURED_PER_GROUP = 3

interface Props {
  productData?: Record<string, ProductCardData>
}

export default function Header({ productData = {} }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(null)
  const [activeGroupKey, setActiveGroupKey] = useState<string>(PRODUCT_GROUPS[0].key)
  const pathname = usePathname()
  const productsRef = useRef<HTMLDivElement>(null)

  const activeGroup = PRODUCT_GROUPS.find(g => g.key === activeGroupKey) ?? PRODUCT_GROUPS[0]

  const closeMega = useCallback(() => setProductsOpen(false), [])

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

  useEffect(() => {
    setProductsOpen(false)
    setMobileOpen(false)
  }, [pathname])

  // 활성 그룹의 featured 아이템 — image 있는 게 우선, 부족하면 그냥 첫 N개
  const featured = (() => {
    const withImage = activeGroup.items.filter(i => productData[i.slug]?.image).slice(0, FEATURED_PER_GROUP)
    if (withImage.length >= FEATURED_PER_GROUP) return withImage
    const rest = activeGroup.items.filter(i => !productData[i.slug]?.image).slice(0, FEATURED_PER_GROUP - withImage.length)
    return [...withImage, ...rest]
  })()

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
            <span>Procardcrafters</span>
          </Link>

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
                  className="absolute top-full left-1/2 -translate-x-1/2 bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-gray-300/40 z-50 w-[min(1100px,calc(100vw-2rem))] overflow-hidden"
                >
                  {/* Moo 매칭 — 3 column side-by-side */}
                  <div className="grid grid-cols-[200px,1fr,360px]">

                    {/* Col 1 — Category 좌측 리스트 */}
                    <div className="bg-gray-50 border-r border-gray-100 py-4 flex flex-col">
                      <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Categories</div>
                      <div className="flex-1">
                        {PRODUCT_GROUPS.map(group => {
                          const isActive = activeGroupKey === group.key
                          return (
                            <button
                              key={group.key}
                              type="button"
                              onMouseEnter={() => setActiveGroupKey(group.key)}
                              onFocus={() => setActiveGroupKey(group.key)}
                              onClick={() => setActiveGroupKey(group.key)}
                              className={`w-full text-left flex items-center justify-between px-5 py-2 text-sm transition-colors ${
                                isActive
                                  ? 'bg-white text-blue-600 font-semibold border-l-2 border-blue-600'
                                  : 'text-gray-700 hover:bg-white hover:text-gray-900 border-l-2 border-transparent'
                              }`}
                            >
                              <span>{group.title}</span>
                              <span className={`text-[11px] ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>{group.items.length}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="border-t border-gray-100 mt-3 pt-3 px-5">
                        <Link
                          href="/products"
                          onClick={closeMega}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Shop all 61 →
                        </Link>
                      </div>
                    </div>

                    {/* Col 2 — Products of active category (2-col compact list) */}
                    <div className="p-5 border-r border-gray-100">
                      <div className="mb-3 flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">All {activeGroup.title}</h3>
                        <span className="text-xs text-gray-400">{activeGroup.description}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 max-h-[360px] overflow-y-auto">
                        {activeGroup.items.map(item => {
                          const onPath = pathname === `/products/${item.slug}`
                          return (
                            <Link
                              key={item.slug}
                              href={`/products/${item.slug}`}
                              onClick={closeMega}
                              className={`block py-1.5 text-sm transition-colors ${
                                onPath
                                  ? 'text-blue-600 font-medium'
                                  : 'text-gray-700 hover:text-blue-600'
                              }`}
                            >
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    </div>

                    {/* Col 3 — Featured 카드 스택 */}
                    <div className="p-5 bg-gradient-to-br from-gray-50 to-white">
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Featured</div>
                      <div className="space-y-3">
                        {featured.map(item => {
                          const data = productData[item.slug]
                          const img = data?.image
                          const desc = data?.description ?? ''
                          return (
                            <Link
                              key={item.slug}
                              href={`/products/${item.slug}`}
                              onClick={closeMega}
                              className="flex gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group"
                            >
                              <div className="relative w-16 h-12 rounded bg-gray-100 overflow-hidden shrink-0">
                                {img ? (
                                  <Image
                                    src={img}
                                    alt={item.label}
                                    fill
                                    sizes="64px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 leading-tight">
                                  {item.label}
                                </div>
                                {desc && (
                                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                                    {desc}
                                  </div>
                                )}
                                <div className="mt-1 text-xs font-medium text-blue-600 group-hover:text-blue-700 inline-flex items-center gap-0.5">
                                  Shop <ArrowRight className="w-3 h-3" />
                                </div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                      <Link
                        href={`/products#${activeGroup.key}`}
                        onClick={closeMega}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Shop all {activeGroup.title} →
                      </Link>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center justify-between">
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-900">61 products</span> · delivered worldwide with FedEx
                    </div>
                    <Link
                      href="/products"
                      onClick={closeMega}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
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
