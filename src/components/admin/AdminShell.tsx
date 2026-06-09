'use client'

// OMO-2737: 어드민 공통 레이아웃 셸 — 좌측 고정 사이드바 + 상단 바 + 콘텐츠.
// 모든 어드민 라우트에 일관 내비/디자인 토큰을 제공한다. (인증/프린트 라우트는 layout에서 제외)
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart2,
  ShoppingBag,
  Truck,
  FileText,
  MessageCircle,
  Package,
  Users,
  Star,
  Tag,
  TrendingDown,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'

interface NavItem {
  href: string
  label: string
  icon: typeof BarChart2
  // exact: '/admin' 처럼 하위 라우트가 많은 항목은 정확 매칭으로 활성 판정
  exact?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: '개요',
    items: [{ href: '/admin', label: '대시보드', icon: BarChart2, exact: true }],
  },
  {
    title: '운영',
    items: [
      { href: '/admin/orders', label: '주문', icon: ShoppingBag },
      { href: '/admin/shipping', label: '배송', icon: Truck },
      { href: '/admin/files', label: '파일 검수', icon: FileText },
    ],
  },
  {
    title: '고객',
    items: [
      { href: '/admin/customers', label: '고객', icon: Users },
      { href: '/admin/reviews', label: '리뷰', icon: Star },
      { href: '/admin/chats', label: '챗봇 로그', icon: MessageCircle },
    ],
  },
  {
    title: '마케팅',
    items: [
      { href: '/admin/promotions', label: '프로모션', icon: Tag },
      { href: '/admin/competitor-prices', label: '경쟁사 가격', icon: TrendingDown },
      { href: '/admin/portfolio', label: '포트폴리오', icon: Package },
    ],
  },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    try {
      const supabase = createAuthBrowserClient()
      await supabase.auth.signOut()
    } catch {
      // 무시: 세션이 이미 없는 경우에도 로그인으로 이동
    }
    router.push('/admin/login')
  }

  const brand = (
    <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-xs font-bold text-white">
        A
      </div>
      <span className="text-sm font-semibold text-gray-900">AllPack Admin</span>
    </div>
  )

  const signOutBtn = (
    <div className="border-t border-gray-200 p-3">
      <button
        onClick={handleSignOut}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        로그아웃
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop 사이드바 (고정) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        {brand}
        <NavLinks pathname={pathname} />
        {signOutBtn}
      </aside>

      {/* Mobile 상단 바 */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="메뉴 열기"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-900 text-[10px] font-bold text-white">
            A
          </div>
          <span className="text-sm font-semibold text-gray-900">AllPack Admin</span>
        </div>
      </header>

      {/* Mobile 드로어 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-gray-200 px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-xs font-bold text-white">
                  A
                </div>
                <span className="text-sm font-semibold text-gray-900">AllPack Admin</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            {signOutBtn}
          </aside>
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <main className="lg:pl-64">{children}</main>
    </div>
  )
}
