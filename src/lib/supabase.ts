import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createSsrBrowserClient } from '@supabase/auth-helpers-nextjs'

// General-purpose client-side client (anon key)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Server-only client (service_role key — bypasses RLS)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
