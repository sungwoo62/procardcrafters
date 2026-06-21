// OMO-3684 · Ad Studio 갤러리: 인스타 30 / 메타광고 30 / 레퍼런스 탭 + 필터 + 카드뉴스 모달.
'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Hash, Target, Layers } from 'lucide-react'
import {
  INSTAGRAM_POSTS,
  META_AD_SETS,
  REFERENCE_BOARDS,
  type InstagramPost,
} from '@/config/adStudio'
import { CreativeFrame } from './CreativeFrame'

type Tab = 'instagram' | 'meta' | 'reference'

const CATEGORY_LABEL: Record<string, string> = {
  all: '전체',
  cards: '명함/카드',
  stickers: '스티커',
  marketing: '마케팅(포스트카드·웨딩·메뉴)',
  brand: '브랜드/오퍼',
}

export default function StudioGallery() {
  const [tab, setTab] = useState<Tab>('instagram')
  const [cat, setCat] = useState<string>('all')
  const [active, setActive] = useState<InstagramPost | null>(null)
  const [slide, setSlide] = useState(0)

  const cats = useMemo(() => ['all', ...Array.from(new Set(INSTAGRAM_POSTS.map((p) => p.category)))], [])
  const posts = useMemo(
    () => (cat === 'all' ? INSTAGRAM_POSTS : INSTAGRAM_POSTS.filter((p) => p.category === cat)),
    [cat],
  )

  function open(post: InstagramPost) {
    if (post.format === 'single') return
    setActive(post)
    setSlide(0)
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      {/* 탭 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {([
          ['instagram', `인스타 콘텐츠 (${INSTAGRAM_POSTS.length})`],
          ['meta', `메타 광고세트 (${META_AD_SETS.length})`],
          ['reference', `레퍼런스 (${REFERENCE_BOARDS.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 인스타 탭 */}
      {tab === 'instagram' && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  cat === c ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {CATEGORY_LABEL[c] ?? c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {posts.map((post) => (
              <div key={post.id} className="group">
                <button
                  onClick={() => open(post)}
                  className={`block w-full text-left ${post.format !== 'single' ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <CreativeFrame post={post} compact />
                </button>
                <div className="mt-2 px-1">
                  <p className="text-xs font-semibold text-slate-700">
                    <span className="text-slate-400">{post.id}</span> · {post.productLabel}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{post.caption}</p>
                  <p className="mt-1 flex flex-wrap gap-1 text-[10px] text-blue-500">
                    {post.hashtags.slice(0, 3).map((h) => (
                      <span key={h}>#{h}</span>
                    ))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 메타 광고 탭 */}
      {tab === 'meta' && (
        <div className="grid gap-4 md:grid-cols-2">
          {META_AD_SETS.map((ad) => (
            <div key={ad.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">{ad.id} · {ad.campaign}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{ad.adsetName}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  {ad.structure}
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">{ad.headline}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{ad.primaryText}</p>
                <p className="mt-2 text-[11px] text-slate-400">{ad.description}</p>
                <div className="mt-2 inline-block rounded bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white">
                  {ad.ctaButton}
                </div>
              </div>

              <dl className="mt-3 space-y-1.5 text-[11px] text-slate-500">
                <div className="flex gap-2"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span><b className="text-slate-600">목적</b> {ad.objective}</span></div>
                <div className="flex gap-2"><Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span><b className="text-slate-600">타겟</b> {ad.audience}</span></div>
                <div className="flex gap-2"><Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span><b className="text-slate-600">노출</b> {ad.placements} · <b className="text-slate-600">크리에이티브</b> {ad.creativeRef} · <b className="text-slate-600">랜딩</b> /{ad.destination}</span></div>
                <div className="flex gap-2"><span className="mt-0.5 h-3.5 w-3.5 shrink-0 text-center text-slate-400">₩</span><span><b className="text-slate-600">예산</b> {ad.budgetRule} · <b className="text-slate-600">지표</b> {ad.primaryMetric}</span></div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {/* 레퍼런스 탭 */}
      {tab === 'reference' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REFERENCE_BOARDS.map((r) => (
            <div key={r.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-800">{r.label}</p>
              <p className="mt-2 text-xs text-slate-500">{r.note}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-xs text-slate-500">
            보드 지시(OMO-3684): 핀터레스트·타사 인스타를 비주얼 디렉션 벤치마크로 삼아 각 크리에이티브의 visualDirection에 반영. 실사 촬영/AI 배경 합성은 키작업 이후 적용.
          </div>
        </div>
      )}

      {/* 카드뉴스/캐러셀 모달 */}
      {active && active.slides && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setActive(null)}>
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setActive(null)} className="absolute -top-10 right-0 text-white">
              <X className="h-6 w-6" />
            </button>
            <div className="rounded-2xl bg-white p-6 shadow-2xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">{active.id} · {active.format === 'cardnews' ? '카드뉴스' : '캐러셀'}</p>
              <div className="mt-3 flex min-h-48 flex-col justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white">
                <p className="text-xl font-extrabold leading-tight">{active.slides[slide].title}</p>
                <p className="mt-3 text-sm text-slate-200">{active.slides[slide].text}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setSlide((s) => Math.max(0, s - 1))}
                  disabled={slide === 0}
                  className="rounded-full bg-slate-100 p-2 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-semibold text-slate-500">{slide + 1} / {active.slides.length}</span>
                <button
                  onClick={() => setSlide((s) => Math.min(active.slides!.length - 1, s + 1))}
                  disabled={slide === active.slides.length - 1}
                  className="rounded-full bg-slate-100 p-2 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
