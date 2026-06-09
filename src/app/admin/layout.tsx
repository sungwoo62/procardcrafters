'use client'

// OMO-2737: 어드민 공통 레이아웃 — 사이드바 셸을 모든 어드민 라우트에 적용.
// 인증 라우트(로그인/비밀번호)와 프린트 라우트(packing-slip)는 셸 없이 그대로 렌더한다.
import { usePathname } from 'next/navigation'
import AdminShell from '@/components/admin/AdminShell'

// 셸을 적용하지 않을 라우트 (인증 게이트 전 화면 + 프린트 전용 화면)
const BARE_ROUTES = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']

function isBare(pathname: string): boolean {
  if (BARE_ROUTES.includes(pathname)) return true
  // 프린트용 패킹 슬립 등은 셸/내비 없이 인쇄 친화적으로 렌더
  if (pathname.endsWith('/packing-slip')) return true
  return false
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (isBare(pathname)) return <>{children}</>
  return <AdminShell>{children}</AdminShell>
}
