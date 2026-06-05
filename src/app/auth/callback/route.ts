import { NextRequest, NextResponse } from 'next/server'
import { createAuthRouteClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (errorParam) {
    const url = new URL(`${origin}/auth/login`)
    url.searchParams.set('error', errorDescription ?? errorParam)
    return NextResponse.redirect(url)
  }

  if (code) {
    const supabase = await createAuthRouteClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const url = new URL(`${origin}/auth/login`)
      url.searchParams.set('error', '인증 링크가 만료되었거나 유효하지 않습니다. 다시 시도해주세요.')
      return NextResponse.redirect(url)
    }
  }

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  const redirectTo = searchParams.get('redirectTo') ?? '/mypage'
  return NextResponse.redirect(`${origin}${redirectTo}`)
}
