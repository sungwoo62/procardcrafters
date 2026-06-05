'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const supabase = createAuthBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message || '비밀번호 재설정 메일 전송에 실패했습니다.')
      return
    }

    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-gray-900">
            <Package className="w-7 h-7 text-blue-600" />
            Procardcrafters
          </Link>
          <p className="mt-2 text-sm text-gray-500">비밀번호 재설정</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">메일을 확인하세요</h2>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium">{email}</span> 로 비밀번호 재설정 링크를 보냈습니다.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                메일이 안 오면 스팸함을 확인하거나, 가입된 이메일이 맞는지 확인해주세요.
              </p>
              <Link
                href="/auth/login"
                className="mt-6 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <ArrowLeft size={14} /> 로그인 페이지로 돌아가기
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-gray-600">
                가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    이메일
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="hello@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '전송 중...' : '재설정 링크 받기'}
                </button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">
              로그인으로 돌아가기
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
