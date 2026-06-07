import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createSsrBrowserClient } from '@supabase/auth-helpers-nextjs'

// General-purpose client-side client (anon key)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 모든 서버 쿼리에 기본 타임아웃을 강제 — Supabase 백엔드가 느리거나 도달 불가일 때
// 쿼리가 무한 대기(hang)하면 정적 생성이 60s 페이지 한계까지 멈춰 빌드 전체가 실패한다.
// abort 로 쿼리를 빠르게 정착(settle)시켜 페이지가 폴백으로 렌더되고 빌드가 결정적으로
// 완료되도록 한다. (OMO-2629 — 빌드 시 Supabase REST/DB 도달 불가로 빌드 차단되던 사고)
const SERVER_QUERY_TIMEOUT_MS = 15000
function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SERVER_QUERY_TIMEOUT_MS) })
}

// Server-only client (service_role key — bypasses RLS)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: timeoutFetch } }
  )
}

// Auth-aware client component client (cookie-based session)
export function createAuthBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Env vars not set at build time — initialized before use
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  return createSsrBrowserClient(url, key)
}
