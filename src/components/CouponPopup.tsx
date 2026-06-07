'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Mail, Tag } from 'lucide-react'
import { gtagEvent, trackGenerateLead } from '@/lib/analytics'

const LS_SHOWN = 'coupon_popup_shown'
const LS_DISMISSED_UNTIL = 'coupon_popup_dismissed_until'

function isNewVisitor(): boolean {
  try {
    if (localStorage.getItem(LS_SHOWN)) return false
    const until = localStorage.getItem(LS_DISMISSED_UNTIL)
    if (until && Date.now() < Number(until)) return false
    return true
  } catch {
    return false
  }
}

function markShown() {
  try { localStorage.setItem(LS_SHOWN, '1') } catch {}
}

function markDismissed() {
  try {
    localStorage.setItem(LS_DISMISSED_UNTIL, String(Date.now() + 30 * 24 * 60 * 60 * 1000))
  } catch {}
}

type State = 'hidden' | 'entering' | 'visible' | 'submitting' | 'success'

export default function CouponPopup() {
  const [state, setState] = useState<State>('hidden')
  const [email, setEmail] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shown = useRef(false)

  const show = useCallback(() => {
    if (shown.current) return
    shown.current = true
    markShown()
    setState('entering')
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setState('visible'))
    )
    gtagEvent('coupon_popup_shown')
  }, [])

  // 트리거: 30초 체류 OR exit-intent
  useEffect(() => {
    if (!isNewVisitor()) return

    timerRef.current = setTimeout(show, 30_000)

    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) show()
    }
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [show])

  // ESC 키 처리
  useEffect(() => {
    if (state === 'hidden' || state === 'success') return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        markDismissed()
        setState('hidden')
        gtagEvent('coupon_popup_dismissed')
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [state])

  // 팝업 표시 시 input focus
  useEffect(() => {
    if (state === 'visible') inputRef.current?.focus()
  }, [state])

  function dismiss() {
    if (state === 'success') {
      setState('hidden')
      return
    }
    markDismissed()
    setState('hidden')
    gtagEvent('coupon_popup_dismissed')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setState('submitting')

    try {
      const res = await fetch('/api/email-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data: { error?: string; couponCode?: string } = await res.json()

      if (!res.ok) {
        setError(data.error ?? '오류가 발생했습니다.')
        setState('visible')
        return
      }

      setCouponCode(data.couponCode ?? '')
      setState('success')
      gtagEvent('coupon_popup_submitted', { coupon_code: data.couponCode })
      // 이메일 구독 = 리드 전환
      trackGenerateLead({ leadType: 'email_signup' })
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      setState('visible')
    }
  }

  if (state === 'hidden') return null

  const isVisible = state === 'visible' || state === 'submitting' || state === 'success'

  return (
    <>
      {/* 백드롭 */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={state !== 'success' ? dismiss : undefined}
        aria-hidden="true"
      />

      {/* 팝업: 모바일 → 하단 시트 / 데스크탑 → 센터 모달 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Get your first order coupon"
        className={[
          'fixed z-50 bg-white shadow-2xl',
          // 모바일: 하단 시트
          'bottom-0 left-0 right-0 rounded-t-2xl max-h-[90svh] overflow-y-auto',
          // 데스크탑: 센터 모달
          'sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2',
          'sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:rounded-2xl sm:w-full sm:max-w-md sm:max-h-none sm:overflow-visible',
          'transition-all duration-300',
          isVisible
            ? 'translate-y-0 sm:opacity-100 sm:scale-100'
            : 'translate-y-full sm:translate-y-0 sm:opacity-0 sm:scale-95',
        ].join(' ')}
      >
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          {state !== 'success' ? (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  New Visitor Offer
                </span>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Get 5% Off Your First Order
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Enter your email and we'll send you a coupon code instantly.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      ref={inputRef}
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      placeholder="Your email address"
                      required
                      disabled={state === 'submitting'}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={state === 'submitting' || !email.trim()}
                    className="px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {state === 'submitting' ? 'Sending…' : 'Get Coupon'}
                  </button>
                </div>

                {error && (
                  <p role="alert" className="mt-2 text-xs text-red-600">
                    {error}
                  </p>
                )}
              </form>

              <p className="mt-4 text-xs text-gray-400 leading-relaxed">
                By subscribing, you agree to receive marketing emails. Unsubscribe at any time.
              </p>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="text-4xl mb-3" aria-hidden="true">🎉</div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Your Coupon is Ready!
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                We've also sent the code to your email.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 mb-5">
                <p className="text-xs text-blue-600 font-semibold mb-1.5">Coupon Code</p>
                <p className="text-2xl font-bold font-mono tracking-widest text-blue-700">
                  {couponCode}
                </p>
                <p className="text-xs text-blue-500 mt-1.5">5% off your first order</p>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                Start Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
