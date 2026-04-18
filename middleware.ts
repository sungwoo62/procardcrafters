import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // 세션 새로고침 (쿠키 유지)
  const { data: { session } } = await supabase.auth.getSession()

  // /mypage 보호: 미인증 시 로그인 페이지로 리다이렉트
  if (req.nextUrl.pathname.startsWith('/mypage') && !session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 이미 로그인한 사용자가 auth 페이지 접근 시 마이페이지로 리다이렉트
  if (req.nextUrl.pathname.startsWith('/auth/login') && session) {
    return NextResponse.redirect(new URL('/mypage', req.url))
  }

  return res
}

export const config = {
  matcher: ['/mypage/:path*', '/auth/login'],
}
