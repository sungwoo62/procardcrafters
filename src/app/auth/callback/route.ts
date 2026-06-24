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
      url.searchParams.set('error', 'This sign-in link has expired or is invalid. Please try again.')
      return NextResponse.redirect(url)
    }
  }

  if (type === 'recovery') {
    const recoveryRedirect = searchParams.get('redirectTo') ?? '/auth/reset-password'
    const url = new URL(`${origin}${recoveryRedirect}`)
    const next = searchParams.get('next')
    if (next) {
      url.searchParams.set('next', next)
    }
    return NextResponse.redirect(url)
  }

  const redirectTo = searchParams.get('redirectTo') ?? '/mypage'
  return NextResponse.redirect(`${origin}${redirectTo}`)
}
