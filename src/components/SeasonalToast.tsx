'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, ArrowRight } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'
import { SEASON_EMOJI } from '@/components/CampaignHero'
import type { Campaign } from '@/lib/promotion-engine'

const TIER_DISCOUNT: Record<string, number> = {
  top: 20,
  standard: 15,
  always_on: 10,
  bestseller: 10,
}

function formatCutoff(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

function isSuppressed(campaignId: string): boolean {
  try {
    if (localStorage.getItem(`pccf_promo_seen_${campaignId}`)) return true
    return document.cookie.split(';').some(c => c.trim().startsWith(`pccf_promo_${campaignId}=`))
  } catch {
    return false
  }
}

function setSuppression(campaignId: string) {
  try {
    localStorage.setItem(`pccf_promo_seen_${campaignId}`, '1')
    const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `pccf_promo_${campaignId}=1; expires=${exp}; path=/; SameSite=Lax`
  } catch {
    // 접근 불가 환경 무시
  }
}

interface Props {
  campaign: Campaign
  promoCode?: string | null
}

export default function SeasonalToast({ campaign, promoCode }: Props) {
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible'>('hidden')
  const [userName, setUserName] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameRef = useRef<number>(0)

  const emoji = SEASON_EMOJI[campaign.calendar.key] ?? '🎉'
  const label = campaign.calendar.name_en
  const pct = TIER_DISCOUNT[campaign.calendar.default_discount_tier] ?? 15
  const cutoff = campaign.order_cutoff_at ? formatCutoff(campaign.order_cutoff_at) : null
  const days = campaign.order_cutoff_at ? daysUntil(campaign.order_cutoff_at) : null
  const lpHref = `/promotions/${campaign.calendar.key}`
  const shopHref = promoCode ? `${lpHref}?promo=${promoCode}` : lpHref

  useEffect(() => {
    if (isSuppressed(campaign.id)) return

    const supabase = createAuthBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      const name: string | undefined = session?.user?.user_metadata?.full_name?.split(' ')[0]
      setUserName(name ?? null)
    })

    timerRef.current = setTimeout(() => {
      setPhase('entering')
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = requestAnimationFrame(() => setPhase('visible'))
      })
    }, 3000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [campaign.id])

  function handleClose() {
    setPhase('hidden')
    setSuppression(campaign.id)
  }

  if (phase === 'hidden') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] transition-all duration-300 ${
        phase === 'visible' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-200/60 p-4 flex gap-3">
        <div className="text-2xl shrink-0 mt-0.5" aria-hidden="true">{emoji}</div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {userName
              ? `Hi ${userName}!`
              : `${label} — ${pct}% off`}
          </p>

          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {userName ? (
              <>
                Your {pct}% {label} discount applies automatically at checkout.
                {cutoff && ` Order by ${cutoff}.`}
              </>
            ) : promoCode ? (
              <>
                Use code{' '}
                <code className="font-mono font-semibold bg-gray-100 px-1 py-0.5 rounded text-blue-700">
                  {promoCode}
                </code>{' '}
                or it applies automatically.{cutoff && ` Order cutoff: ${cutoff}.`}
              </>
            ) : (
              <>
                {pct}% off applies automatically at checkout.{cutoff && ` Order by ${cutoff}.`}
              </>
            )}
          </p>

          {/* 실제 마감일 기준 N일 남음 — 7일 이하일 때만 표시 (fake urgency 금지) */}
          {days !== null && days > 0 && days <= 7 && (
            <p className="text-xs text-amber-600 font-medium mt-1">
              {days} day{days !== 1 ? 's' : ''} left to order
            </p>
          )}

          <Link
            href={shopHref}
            onClick={handleClose}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Shop {label} Cards <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Close promotion"
          className="shrink-0 self-start p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
