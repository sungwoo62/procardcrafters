import { createServerClient as createSsrServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// 인증 포함 서버 컴포넌트 / Route Handler용 (쿠키 기반 세션)
export async function createAuthServerClient() {
  const cookieStore = await cookies()
  return createSsrServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components에서는 쿠키 설정 불가 — 무시
          }
        },
      },
    }
  )
}

// createAuthRouteClient는 createAuthServerClient와 동일 (하위 호환)
export const createAuthRouteClient = createAuthServerClient
