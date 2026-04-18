import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// 클라이언트 사이드 클라이언트 (lazy 생성)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 서버 전용 클라이언트 (service_role key 사용)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 인증 포함 클라이언트 컴포넌트용 (쿠키 기반 세션)
export function createAuthBrowserClient() {
  return createClientComponentClient()
}

// 인증 포함 서버 컴포넌트용 (쿠키 기반 세션)
export async function createAuthServerClient() {
  const cookieStore = await cookies()
  return createServerComponentClient({ cookies: () => cookieStore })
}

// 인증 포함 Route Handler용 (쿠키 기반 세션)
export async function createAuthRouteClient() {
  const cookieStore = await cookies()
  return createRouteHandlerClient({ cookies: () => cookieStore })
}
