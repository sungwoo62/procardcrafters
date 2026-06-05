'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowRight, Copy, Check, Clock } from 'lucide-react'

export const SEASON_EMOJI: Record<string, string> = {
  black_friday: '🛍️',
  christmas_new_year: '🎄',
  wedding_boost: '💍',
  valentine: '💝',
  mothers_day: '🌸',
  graduation: '🎓',
  fathers_day: '👔',
  back_to_school: '📚',
  halloween: '🎃',
}

interface CountdownState {
  d: number
  h: number
  m: number
  s: number
}

function Countdown({ cutoffAt }: { cutoffAt: string }) {
  const [remaining, setRemaining] = useState<CountdownState | null>(null)

  useEffect(() => {
    const update = () => {
      const diff = new Date(cutoffAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining(null); return }
      setRemaining({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      })
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [cutoffAt])

  if (!remaining) return null

  const parts = [
    { label: 'd', value: remaining.d },
    { label: 'h', value: remaining.h },
    { label: 'm', value: remaining.m },
    { label: 's', value: remaining.s },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
      <Clock className="w-4 h-4 text-blue-300 shrink-0" />
      <span className="text-blue-200 text-sm">Order by:</span>
      {parts.map(({ label, value }, i) => (
        <span key={label} className="flex items-center gap-1">
          <span className="bg-white/10 backdrop-blur-sm border border-white/20 text-white font-mono font-bold text-xl px-3 py-1.5 rounded-lg min-w-[2.75rem] text-center">
            {String(value).padStart(2, '0')}
          </span>
          <span className="text-blue-300 text-xs">{label}</span>
          {i < parts.length - 1 && (
            <span className="text-blue-400 font-bold mx-0.5 select-none">·</span>
          )}
        </span>
      ))}
    </div>
  )
}

interface Props {
  campaignKey: string
  campaignSlug: string
  headlineEn: string
  heroImageUrl: string | null
  promoCode: string | null
  cutoffAt: string | null
}

export default function CampaignHero({
  campaignKey,
  campaignSlug,
  headlineEn,
  heroImageUrl,
  promoCode,
  cutoffAt,
}: Props) {
  const emoji = SEASON_EMOJI[campaignKey] ?? '🎉'
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!promoCode) return
    await navigator.clipboard.writeText(promoCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shopHref = `/promotions/${campaignSlug}${promoCode ? `?promo=${promoCode}` : ''}`

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 py-28 px-4">
      {heroImageUrl ? (
        <Image
          src={heroImageUrl}
          alt={headlineEn}
          fill
          className="object-cover opacity-20"
          priority
        />
      ) : (
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-400 rounded-full blur-3xl" />
        </div>
      )}

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
          <span aria-hidden="true">{emoji}</span>
          <span>Limited-time promotion</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
          {headlineEn}
        </h1>

        {promoCode && (
          <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 border border-white/30 backdrop-blur-sm rounded-xl px-5 py-3">
              <span className="text-white/60 text-sm">Code:</span>
              <span className="text-white font-bold tracking-widest text-lg font-mono">{promoCode}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-white text-blue-900 px-4 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors text-sm shadow-lg"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {cutoffAt && <Countdown cutoffAt={cutoffAt} />}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={shopHref}
            className="inline-flex items-center justify-center gap-2 bg-white text-blue-900 px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-50 transition-colors text-base shadow-lg shadow-blue-900/20"
          >
            Shop the Sale <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-colors text-base backdrop-blur-sm"
          >
            All Products
          </Link>
        </div>
      </div>
    </section>
  )
}
