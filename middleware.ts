import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { isAllowedAdmin } from '@/lib/admin-access'

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

  // ===== 어드민 인증 =====
  if (pathname.startsWith('/admin')) {
    if (!pathname.startsWith('/admin/login')) {
      if (!user) {
        const loginUrl = new URL('/admin/login', req.url)
        loginUrl.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // Fail-closed: 화이트리스트가 비어 있으면 모두 거부(설정 누락 = 접근 불가).
      if (!isAllowedAdmin(user.email, process.env.ADMIN_EMAILS)) {
        const loginUrl = new URL('/admin/login', req.url)
        loginUrl.searchParams.set('error', 'unauthorized')
        return NextResponse.redirect(loginUrl)
      }
    } else if (user) {
      // 이미 로그인된 어드민이 /admin/login 접근 시 대시보드로 리다이렉트.
      // Fail-closed: 허용 목록에 있을 때만 대시보드로 보냄(비면 로그인 화면 유지).
      if (isAllowedAdmin(user.email, process.env.ADMIN_EMAILS)) {
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
  matcher: ['/admin/:path*', '/mypage/:path*', '/auth/login'],
}
