import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 새로고침 (쿠키 유지)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname

  // 인가된 어드민 여부(fail-closed): 인증됨 + (ADMIN_EMAILS 미설정이면 모든 인증사용자 / 설정되면 화이트리스트).
  const isAllowedAdmin = (() => {
    if (!user) return false
    const allowedEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    if (allowedEmails.length === 0) return true
    return allowedEmails.includes(user.email?.toLowerCase() ?? '')
  })()

  // ===== 성원(Swadpia) 내부 데이터 보호 (OMO-3593, 보드 지시 OMO-3562) =====
  // /reports/* (성원·프린트시티·애드피아몰 공급가 리포트) 와 /api/swadpia* 는
  // 도매 KRW·매핑·category_code 를 노출하므로 어드민 전용. fail-closed:
  //   미인증/비인가 → API 는 401 JSON, 페이지는 /admin/login 리다이렉트.
  // /api/swadpia 접두로 일반화 → swadpia-mapping·swadpia-price(원오너 노출) 모두 차단.
  if (pathname.startsWith('/reports') || pathname.startsWith('/api/swadpia')) {
    if (!isAllowedAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }

  // ===== 어드민 인증 =====
  if (pathname.startsWith('/admin')) {
    if (!pathname.startsWith('/admin/login')) {
      if (!user) {
        const loginUrl = new URL('/admin/login', req.url)
        loginUrl.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(loginUrl)
      }

      const allowedEmails = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)

      const userEmail = user.email?.toLowerCase() ?? ''
      if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail)) {
        const loginUrl = new URL('/admin/login', req.url)
        loginUrl.searchParams.set('error', 'unauthorized')
        return NextResponse.redirect(loginUrl)
      }
    } else if (user) {
      // 이미 로그인된 어드민이 /admin/login 접근 시 대시보드로 리다이렉트
      const allowedEmails = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
      const userEmail = user.email?.toLowerCase() ?? ''
      if (allowedEmails.length === 0 || allowedEmails.includes(userEmail)) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
    }
    return supabaseResponse
  }

  // ===== 일반 사용자 인증 =====
  // /mypage 보호: 미인증 시 로그인 페이지로 리다이렉트
  if (pathname.startsWith('/mypage') && !user) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 이미 로그인한 사용자가 auth 페이지 접근 시 마이페이지로 리다이렉트
  if (pathname.startsWith('/auth/login') && user) {
    return NextResponse.redirect(new URL('/mypage', req.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/mypage/:path*',
    '/auth/login',
    // OMO-3593: 성원 내부 데이터(공급가 리포트·매핑/가격 API) 게이트.
    '/reports/:path*',
    '/api/swadpia/:path*',
    '/api/swadpia-mapping/:path*',
    '/api/swadpia-price/:path*',
  ],
}
