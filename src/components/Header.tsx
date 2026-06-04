'use client'

import Link from 'next/link'
import Image from 'next/image'
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

interface Props {
  productImages?: Record<string, string>
}

export default function Header({ productImages = {} }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(null)
  const [activeGroupKey, setActiveGroupKey] = useState<string>(PRODUCT_GROUPS[0].key)
  const [activeItemSlug, setActiveItemSlug] = useState<string>(PRODUCT_GROUPS[0].items[0].slug)
  const pathname = usePathname()
  const productsRef = useRef<HTMLDivElement>(null)

  const activeGroup = PRODUCT_GROUPS.find(g => g.key === activeGroupKey) ?? PRODUCT_GROUPS[0]
  const activeItem = activeGroup.items.find(i => i.slug === activeItemSlug) ?? activeGroup.items[0]
  const previewImageUrl = productImages[activeItem.slug] ?? null

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

  const selectGroup = (key: string) => {
    const g = PRODUCT_GROUPS.find(x => x.key === key)
    if (!g) return
    setActiveGroupKey(key)
    setActiveItemSlug(g.items[0].slug)
  }

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
                  className="absolute top-full left-1/2 -translate-x-1/2 bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-gray-300/40 z-50 w-[min(1100px,calc(100vw-2rem))] overflow-hidden flex flex-col"
                >
                  {/* 가로 3단 — 위에서 아래로 stack */}

                  {/* 단 1: Category — 가로 탭 */}
                  <div className="border-b border-gray-100 bg-gray-50/60">
                    <div className="px-6 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Category</div>
                    <div className="px-3 pb-3 flex gap-1 overflow-x-auto">
                      {PRODUCT_GROUPS.map(group => {
                        const isActive = activeGroupKey === group.key
                        return (
                          <button
                            key={group.key}
                            type="button"
                            onMouseEnter={() => selectGroup(group.key)}
                            onFocus={() => selectGroup(group.key)}
                            onClick={() => selectGroup(group.key)}
                            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600'
                            }`}
                          >
                            {group.title}
                            <span className={`ml-1.5 text-[11px] ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>{group.items.length}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 단 2: Products — 가로 그리드 (활성 카테고리 제품들) */}
                  <div className="px-6 pt-5 pb-2 border-b border-gray-100">
                    <div className="mb-3 flex items-baseline justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">{activeGroup.title}</div>
                      <div className="text-xs text-gray-500">{activeGroup.description}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pb-2">
                      {activeGroup.items.map(item => {
                        const isActive = activeItemSlug === item.slug
                        const onPath = pathname === `/products/${item.slug}`
                        const thumb = productImages[item.slug]
                        return (
                          <Link
                            key={item.slug}
                            href={`/products/${item.slug}`}
                            onMouseEnter={() => setActiveItemSlug(item.slug)}
                            onFocus={() => setActiveItemSlug(item.slug)}
                            onClick={closeMega}
                            className={`group flex items-center gap-2 p-2 rounded-lg border transition-all ${
                              onPath
                                ? 'border-blue-300 bg-blue-50'
                                : isActive
                                  ? 'border-blue-200 bg-blue-50/40'
                                  : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="relative w-12 h-9 rounded bg-gray-100 overflow-hidden shrink-0">
                              {thumb ? (
                                <Image
                                  src={thumb}
                                  alt={item.label}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <span className={`text-xs leading-tight ${
                              onPath || isActive ? 'text-blue-700 font-medium' : 'text-gray-700 group-hover:text-blue-600'
                            }`}>
                              {item.label}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>

                  {/* 단 3: Featured thumbnail */}
                  <div className="px-6 py-5 bg-gradient-to-br from-gray-50 to-white">
                    <div className="grid grid-cols-[260px,1fr] gap-5 items-center">
                      <div className="relative aspect-[4/3] w-full bg-white rounded-xl border border-gray-100 overflow-hidden shadow-md">
                        {previewImageUrl ? (
                          <Image
                            key={activeItem.slug}
                            src={previewImageUrl}
                            alt={activeItem.label}
                            fill
                            sizes="260px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                            <div className="text-center px-4">
                              <Package className="w-9 h-9 mx-auto mb-2 text-gray-300" />
                              <p className="text-[11px] text-gray-400">Photography in progress</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-1">Featured</div>
                        <div className="text-xl font-bold text-gray-900">{activeItem.label}</div>
                        <div className="text-sm text-gray-500 mt-1">{activeGroup.title} · {activeGroup.description}</div>
                        <div className="mt-4 flex items-center gap-3">
                          <Link
                            href={`/products/${activeItem.slug}`}
                            onClick={closeMega}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                          >
                            View details <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            href="/products"
                            onClick={closeMega}
                            className="text-sm font-medium text-gray-600 hover:text-blue-600"
                          >
                            Shop all 61 →
                          </Link>
                        </div>
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
