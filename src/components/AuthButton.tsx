'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createAuthBrowserClient } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function AuthButton() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createAuthBrowserClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="w-8 h-8" />
  }

  if (user) {
    return (
      <Link
        href="/mypage"
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        title="마이페이지"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline text-xs font-medium truncate max-w-[80px]">
          {user.user_metadata?.full_name?.split(' ')[0] ?? 'My'}
        </span>
      </Link>
    )
  }

  return (
    <Link
      href="/auth/login"
      className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors font-medium"
    >
      로그인
    </Link>
  )
}
