// OMO-3684 · Ad Studio 크리에이티브 렌더러("locked frame").
// 테마별 그라데이션 배경 + CSS 제품(명함/스티커) 목업 + 헤드라인/서브/CTA.
// ⚠️ 실사 제품촬영/AI 배경은 키작업 이후 교체. 현재는 컨셉 프루프용 in-browser 렌더.
'use client'

import type { InstagramPost, ThemeKey, CreativeRatio } from '@/config/adStudio'

const THEME: Record<ThemeKey, { bg: string; card: string; text: string; sub: string; accent: string }> = {
  goldFoil: { bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-neutral-900', card: 'bg-neutral-950 ring-1 ring-amber-300/40', text: 'text-amber-50', sub: 'text-amber-200/80', accent: 'text-amber-300' },
  letterpress: { bg: 'bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200', card: 'bg-stone-50 ring-1 ring-stone-300', text: 'text-stone-800', sub: 'text-stone-500', accent: 'text-stone-700' },
  transparent: { bg: 'bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100', card: 'bg-white/30 ring-1 ring-white/60 backdrop-blur', text: 'text-slate-800', sub: 'text-slate-500', accent: 'text-sky-600' },
  pearl: { bg: 'bg-gradient-to-br from-rose-50 via-fuchsia-50 to-indigo-50', card: 'bg-gradient-to-br from-white to-rose-100 ring-1 ring-white', text: 'text-slate-700', sub: 'text-slate-400', accent: 'text-fuchsia-500' },
  metallic: { bg: 'bg-gradient-to-br from-zinc-700 via-slate-600 to-zinc-800', card: 'bg-gradient-to-br from-zinc-300 to-zinc-500 ring-1 ring-white/40', text: 'text-white', sub: 'text-zinc-200', accent: 'text-cyan-200' },
  navy: { bg: 'bg-gradient-to-br from-blue-950 via-indigo-900 to-slate-900', card: 'bg-slate-950 ring-1 ring-blue-400/30', text: 'text-blue-50', sub: 'text-blue-200/70', accent: 'text-amber-300' },
  studio: { bg: 'bg-gradient-to-br from-slate-50 via-white to-slate-100', card: 'bg-white ring-1 ring-slate-200 shadow-lg', text: 'text-slate-800', sub: 'text-slate-400', accent: 'text-blue-600' },
  kraft: { bg: 'bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200', card: 'bg-amber-700/90 ring-1 ring-amber-900/30', text: 'text-amber-950', sub: 'text-amber-800/70', accent: 'text-amber-900' },
  holographic: { bg: 'bg-gradient-to-br from-fuchsia-300 via-cyan-200 to-violet-300', card: 'bg-gradient-to-tr from-fuchsia-200 via-cyan-100 to-amber-100 ring-1 ring-white/60', text: 'text-slate-800', sub: 'text-slate-600', accent: 'text-violet-600' },
  wedding: { bg: 'bg-gradient-to-br from-rose-50 via-white to-emerald-50', card: 'bg-white ring-1 ring-rose-200 shadow', text: 'text-stone-700', sub: 'text-stone-400', accent: 'text-rose-400' },
  amber: { bg: 'bg-gradient-to-br from-amber-300 via-orange-200 to-amber-400', card: 'bg-white ring-1 ring-amber-200 shadow', text: 'text-amber-950', sub: 'text-amber-800/70', accent: 'text-orange-600' },
  mono: { bg: 'bg-gradient-to-br from-neutral-900 via-neutral-800 to-black', card: 'bg-neutral-100 ring-1 ring-white/20', text: 'text-white', sub: 'text-neutral-400', accent: 'text-neutral-300' },
}

const RATIO_CLASS: Record<CreativeRatio, string> = {
  '4:5': 'aspect-[4/5]',
  '1:1': 'aspect-square',
  '9:16': 'aspect-[9/16]',
}

export function CreativeFrame({ post, compact = false }: { post: InstagramPost; compact?: boolean }) {
  const t = THEME[post.theme]
  const isSticker = post.category === 'stickers'
  const hasImage = !!post.imageUrl // OMO-3690: 실사/AI 프로덕션 이미지 적재 시 컨셉 목업 대체

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl ${RATIO_CLASS[post.ratio]} ${t.bg}`}>
      {/* 실사/AI 프로덕션 이미지 레이어(있을 때만). 상하 스크림으로 헤드라인/CTA 가독성 확보. */}
      {hasImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase signed URL 동적, next/image 도메인 화이트리스트 회피 */}
          <img src={post.imageUrl} alt={post.headline} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/55 to-transparent" />
        </>
      )}

      {/* 상단 헤드라인 */}
      <div className="absolute inset-x-0 top-0 p-5">
        <p className={`whitespace-pre-line text-xl font-extrabold leading-tight tracking-tight ${hasImage ? 'text-white drop-shadow' : t.text} ${compact ? 'text-lg' : 'sm:text-2xl'}`}>
          {post.headline}
        </p>
        <p className={`mt-2 text-xs font-medium ${hasImage ? 'text-white/85 drop-shadow' : t.sub} sm:text-sm`}>{post.subhead}</p>
      </div>

      {/* 중앙 제품 목업 (명함 = 기울인 카드, 스티커 = 원형 배지). 실사 이미지 적재 시 생략. */}
      {!hasImage && (
      <div className="absolute inset-0 flex items-center justify-center">
        {isSticker ? (
          <div className={`flex h-28 w-28 rotate-6 items-center justify-center rounded-full ${t.card} sm:h-36 sm:w-36`}>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${t.accent}`}>Procard</span>
          </div>
        ) : (
          <div className={`relative h-28 w-44 -rotate-6 rounded-lg ${t.card} sm:h-32 sm:w-52`}>
            <div className="absolute left-3 top-4 flex flex-col gap-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${t.accent}`}>Your Brand</span>
              <span className={`h-1 w-16 rounded ${t.sub} opacity-40`} />
              <span className={`mt-2 h-1 w-20 rounded ${t.sub} opacity-25`} />
              <span className={`h-1 w-14 rounded ${t.sub} opacity-25`} />
            </div>
            {/* 두 번째 카드(겹침)로 입체감 */}
            <div className={`absolute -right-4 -top-4 -z-10 h-28 w-44 rotate-3 rounded-lg ${t.card} opacity-50 sm:h-32 sm:w-52`} />
          </div>
        )}
      </div>
      )}

      {/* 하단 CTA + 브랜드 (locked footer) */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-5">
        <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${hasImage ? 'bg-white text-slate-900' : `${t.card} ${t.accent}`}`}>{post.cta} →</span>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${hasImage ? 'text-white/85 drop-shadow' : t.sub}`}>Procardcrafters</span>
      </div>

      {/* 캐러셀/카드뉴스 배지 */}
      {post.format !== 'single' && (
        <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          {post.format === 'cardnews' ? `Card news · ${post.slides?.length ?? 0}` : `Carousel · ${post.slides?.length ?? 0}`}
        </div>
      )}
    </div>
  )
}
