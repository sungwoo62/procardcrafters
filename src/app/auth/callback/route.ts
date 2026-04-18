import { NextRequest, NextResponse } from 'next/server'
import { createAuthRouteClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/mypage'

  if (code) {
    const supabase = await createAuthRouteClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${redirectTo}`)
}
