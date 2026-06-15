'use client'

// OMO-3265: AI 큐레이션 UI. 프리셋 후킹 칩(즉시 결정론적 Good/Better/Best) + 자유 입력(AI).
// 전환 강화: 경쟁사 절감 배지(앵커링) · "Most popular" 중간 강조 · 신뢰 스트립 · 리파인 칩 · 퍼널 계측.
import { useEffect, useRef, useState } from 'react'
import { Sparkles, ArrowRight, Crown, Scale, Tag, Loader2, ShieldCheck, TrendingDown, RotateCcw } from 'lucide-react'
import { gtagEvent, metaPixelEvent } from '@/lib/analytics'

interface Pick {
  slug: string
  name: string
  tier: string
  hook: string
  why: string
  finishing: string[]
  finishingLabels: string[]
  quantity: number | null
  fromUsd: number
  savingsPct: number
  imageUrl: string | null
  orderHref: string
  badge: string | null
  highlight: boolean
}
interface Result {
  summary: string
  heuristic: boolean
  picks: Pick[]
}

const PRESETS: { mode: string; label: string; icon: typeof Crown }[] = [
  { mode: 'premium', label: 'Top quality — price no object', icon: Crown },
  { mode: 'value', label: 'Premium look, great value', icon: Scale },
  { mode: 'cheap', label: 'Cheapest I can find', icon: Tag },
]

export default function CurateClient({ group, initialIntent }: { group?: string; initialIntent?: string }) {
  const [intent, setIntent] = useState(initialIntent ?? '')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  // 퍼널 계측: 큐레이션 진입.
  useEffect(() => {
    gtagEvent('curate_view', { group: group ?? 'all' })
  }, [group])

  async function curate(payload: { intent?: string; mode?: string }) {
    setLoading(true)
    setError(null)
    gtagEvent('curate_request', { group: group ?? 'all', mode: payload.mode ?? 'free_text' })
    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, group }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setResult(null)
      } else {
        setResult(data as Result)
        gtagEvent('curate_result', {
          group: group ?? 'all',
          mode: payload.mode ?? 'free_text',
          count: (data as Result).picks.length,
        })
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      }
    } catch {
      setError('Network error. Please try again.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  function handleOrderClick(pick: Pick) {
    gtagEvent('select_promotion', {
      promotion_name: 'ai_curation',
      creative_slot: pick.tier,
      items: [{ item_id: pick.slug, item_name: pick.name, price: pick.fromUsd, currency: 'USD' }],
    })
    metaPixelEvent('Lead', { content_name: pick.name, content_category: 'ai_curation' })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
          <Sparkles className="w-3.5 h-3.5" /> AI Curation
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Tell us what you need — we&apos;ll curate it
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">
          Pick a vibe below, or describe it in your own words. We&apos;ll recommend the perfect setup and take you
          straight to order.
        </p>
      </div>

      {/* 프리셋 후킹 */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {PRESETS.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => curate({ mode })}
            disabled={loading}
            className="flex items-center gap-3 text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:shadow-sm transition disabled:opacity-50"
          >
            <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </span>
            <span className="font-medium text-gray-800 text-sm leading-snug">{label}</span>
          </button>
        ))}
      </div>

      {/* 자유 입력 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-2">
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && intent.trim() && !loading) curate({ intent })
          }}
          placeholder="e.g. I'm a lawyer — I want the most premium business card, money is no object"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800"
        />
        <button
          onClick={() => intent.trim() && curate({ intent })}
          disabled={loading || !intent.trim()}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Curate with AI
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

      {/* 결과 */}
      {result && (
        <div className="mt-10" ref={resultsRef}>
          <p className="text-center text-gray-600 mb-2">{result.summary}</p>

          {/* 신뢰 스트립 — 주문 직전 불안 제거 */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-gray-500 mb-6">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Proofed before printing</span>
            <span className="inline-flex items-center gap-1">✓ Ships in 4–6 business days</span>
            <span className="inline-flex items-center gap-1">✓ No account required</span>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {result.picks.map((pick) => (
              <div
                key={pick.slug + pick.tier}
                className={`flex flex-col rounded-2xl bg-white overflow-hidden transition relative ${
                  pick.highlight
                    ? 'border-2 border-blue-600 shadow-lg md:-translate-y-1'
                    : 'border border-gray-200 hover:shadow-md'
                }`}
              >
                {pick.badge && (
                  <div className="absolute top-0 inset-x-0 bg-blue-600 text-white text-xs font-bold text-center py-1 z-10">
                    {pick.badge}
                  </div>
                )}
                <div className={`relative h-40 bg-gray-100 ${pick.badge ? 'mt-6' : ''}`}>
                  {pick.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pick.imageUrl} alt={pick.name} className="w-full h-full object-cover" loading="lazy" />
                  )}
                  <span className="absolute top-3 left-3 bg-gray-900/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    {pick.tier}
                  </span>
                  {pick.savingsPct > 0 && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      <TrendingDown className="w-3 h-3" /> Save {pick.savingsPct}%
                    </span>
                  )}
                </div>
                <div className="flex flex-col flex-1 p-5">
                  <h3 className="font-bold text-gray-900 leading-snug mb-1">{pick.hook}</h3>
                  <p className="text-sm text-gray-400 mb-2">{pick.name}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{pick.why}</p>
                  {pick.finishingLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {pick.finishingLabels.map((f) => (
                        <span key={f} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto">
                    {pick.fromUsd > 0 && (
                      <p className="text-sm text-gray-500 mb-2">
                        From <span className="font-semibold text-gray-900">${pick.fromUsd}</span>
                        {pick.savingsPct > 0 && (
                          <span className="text-emerald-600 font-medium"> · {pick.savingsPct}% under major brands</span>
                        )}
                      </p>
                    )}
                    <a
                      href={pick.orderHref}
                      onClick={() => handleOrderClick(pick)}
                      className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl font-semibold text-sm transition ${
                        pick.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      Order this setup <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 리파인 칩 — 이탈 대신 재큐레이션 유도 */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <button
              onClick={() => curate({ mode: 'cheap' })}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-50"
            >
              💰 Make it cheaper
            </button>
            <button
              onClick={() => curate({ mode: 'premium' })}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-50"
            >
              💎 More premium
            </button>
            <button
              onClick={() => {
                setResult(null)
                setIntent('')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Start over
            </button>
          </div>

          {result.heuristic && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Tip: describe your needs in the box above for a more tailored AI curation.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
