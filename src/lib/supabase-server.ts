import { createServerClient as createSsrServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Auth-aware server component / Route Handler client (cookie-based session)
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
            // Cannot set cookies in Server Components — ignore
          }
        },
      },
    }
  )
}

// createAuthRouteClient is identical to createAuthServerClient (backward compat)
export const createAuthRouteClient = createAuthServerClient
