'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  const supabase = createAuthBrowserClient()

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setHasSession(Boolean(data.session))
      setSessionChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message || '비밀번호 변경에 실패했습니다. 다시 시도해주세요.')
      return
    }

    setDone(true)
    setTimeout(() => {
      router.push('/mypage')
      router.refresh()
    }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-gray-900">
            <Package className="w-7 h-7 text-blue-600" />
            Procardcrafters
          </Link>
          <p className="mt-2 text-sm text-gray-500">새 비밀번호 설정</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {!sessionChecked ? (
            <p className="text-center text-sm text-gray-500">확인 중...</p>
          ) : !hasSession ? (
            <div className="text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">링크가 만료되었거나 유효하지 않습니다</h2>
              <p className="mt-2 text-sm text-gray-600">
                비밀번호 재설정 메일의 링크는 1시간 후 만료됩니다. 다시 요청해주세요.
              </p>
              <Link
                href="/auth/forgot-password"
                className="mt-6 inline-flex items-center justify-center w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                재설정 링크 다시 받기
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">비밀번호가 변경되었습니다</h2>
              <p className="mt-2 text-sm text-gray-600">마이페이지로 이동 중...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  새 비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="8자 이상"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                  새 비밀번호 확인
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="confirm"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="다시 입력"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
