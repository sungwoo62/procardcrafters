'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, Menu, X, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'
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

  // 그룹 바뀌면 그 그룹 첫 아이템으로 활성 아이템 자동 이동
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
                  className="absolute top-full left-1/2 -translate-x-1/2 bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-gray-300/40 z-50 w-[min(1040px,calc(100vw-2rem))] overflow-hidden"
                >
                  <div className="grid grid-cols-[220px,260px,1fr]">
                    {/* Col 1: 카테고리 */}
                    <div className="bg-gray-50 border-r border-gray-100 py-3 flex flex-col">
                      <div className="px-4 mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Category</div>
                      <div className="flex-1">
                        {PRODUCT_GROUPS.map(group => {
                          const isActive = activeGroupKey === group.key
                          return (
                            <button
                              key={group.key}
                              type="button"
                              onMouseEnter={() => selectGroup(group.key)}
                              onFocus={() => selectGroup(group.key)}
                              onClick={() => selectGroup(group.key)}
                              className={`w-full text-left flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                                isActive
                                  ? 'bg-white text-blue-600 font-semibold'
                                  : 'text-gray-700 hover:bg-white hover:text-gray-900'
                              }`}
                            >
                              <div>
                                <div className="leading-tight">{group.title}</div>
                                <div className={`text-[11px] mt-0.5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>{group.items.length} products</div>
                              </div>
                              <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-opacity ${isActive ? 'opacity-100 text-blue-500' : 'opacity-40'}`} />
                            </button>
                          )
                        })}
                      </div>
                      <div className="border-t border-gray-100 mt-2 pt-2 px-4">
                        <Link
                          href="/products"
                          onClick={closeMega}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Shop all 61 →
                        </Link>
                      </div>
                    </div>

                    {/* Col 2: 활성 카테고리의 제품 리스트 */}
                    <div className="border-r border-gray-100 py-3 flex flex-col overflow-hidden">
                      <div className="px-4 mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">{activeGroup.title}</div>
                      <div className="flex-1 overflow-y-auto max-h-[440px]">
                        {activeGroup.items.map(item => {
                          const isActive = activeItemSlug === item.slug
                          const onPath = pathname === `/products/${item.slug}`
                          return (
                            <Link
                              key={item.slug}
                              href={`/products/${item.slug}`}
                              onMouseEnter={() => setActiveItemSlug(item.slug)}
                              onFocus={() => setActiveItemSlug(item.slug)}
                              onClick={closeMega}
                              className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                                onPath
                                  ? 'text-blue-600 bg-blue-50 font-medium'
                                  : isActive
                                    ? 'text-blue-600 bg-blue-50/50'
                                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                              }`}
                            >
                              <span>{item.label}</span>
                              {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-500" />}
                            </Link>
                          )
                        })}
                      </div>
                    </div>

                    {/* Col 3: 썸네일 + 정보 */}
                    <div className="bg-gradient-to-br from-gray-50 to-white p-6 flex flex-col">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">Preview</div>
                      <div className="relative aspect-[4/3] w-full bg-white rounded-xl border border-gray-100 overflow-hidden shadow-md">
                        {previewImageUrl ? (
                          <Image
                            key={activeItem.slug}
                            src={previewImageUrl}
                            alt={activeItem.label}
                            fill
                            sizes="(max-width:1100px) 100vw, 460px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                            <div className="text-center px-4">
                              <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-xs text-gray-400">Photography in progress</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <div className="text-base font-bold text-gray-900">{activeItem.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{activeGroup.title} · {activeGroup.description}</div>
                        <Link
                          href={`/products/${activeItem.slug}`}
                          onClick={closeMega}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                          View details <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Footer strip */}
                  <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center justify-between">
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-900">61 products</span> · printed in LA, delivered worldwide
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
