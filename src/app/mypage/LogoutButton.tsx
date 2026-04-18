'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createAuthBrowserClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100"
    >
      <LogOut className="w-4 h-4" />
      로그아웃
    </button>
  )
}
