import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createSsrBrowserClient } from '@supabase/auth-helpers-nextjs'

// 범용 클라이언트 사이드 클라이언트 (anon key)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 서버 전용 클라이언트 (service_role key — RLS 우회)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 인증 포함 클라이언트 컴포넌트용 (쿠키 기반 세션)
export function createAuthBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // 빌드 시 환경변수 미설정 — 사용 전 초기화됨
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  return createSsrBrowserClient(url, key)
}
