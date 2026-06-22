import type { Metadata } from 'next'
import { Camera, Clock, CheckCircle2, ShieldCheck, CalendarDays } from 'lucide-react'
import plan from '@/data/omo3764-instagram-plan.json'

// OMO-3764(보드 요청): "게시물 어떻게 할건지 60개 뽑아서 웹에다 해서 먼저 보고."
// 30일 × 2건 = 60개 인스타 콘텐츠 초안을 단일 진실원천(src/data/omo3764-instagram-plan.json)에서
// 읽어 피드 프리뷰로 렌더. 발행 전 보드 검토용 read-only 리포트 — 쓰기/발행 동작 없음.
// 자동발행은 별도 게이트(omo3764-ig-publish.mjs, IG_AUTO_PUBLISH 기본 OFF, approved만 발행)에서만.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'OMO-3764 — 프로카드 인스타 30일 콘텐츠 플랜 (검토용)',
  description: '인스타 하루 2건 × 30일 = 60개 게시물 초안 프리뷰. 발행 전 보드 검토용.',
  robots: { index: false, follow: false },
}

type Post = (typeof plan.posts)[number]

const PILLAR_STYLE: Record<string, string> = {
  product_spotlight: 'bg-indigo-100 text-indigo-700',
  use_case: 'bg-emerald-100 text-emerald-700',
  education: 'bg-amber-100 text-amber-800',
  quality: 'bg-sky-100 text-sky-700',
  offer: 'bg-rose-100 text-rose-700',
  engagement: 'bg-violet-100 text-violet-700',
}

const PRODUCT_GRADIENT: Record<string, string> = {
  business_cards: 'from-indigo-200 to-slate-300',
  stickers: 'from-yellow-200 to-orange-200',
  flyers: 'from-green-200 to-emerald-300',
  posters: 'from-fuchsia-200 to-purple-300',
  postcards: 'from-pink-200 to-rose-300',
  brochures: 'from-cyan-200 to-sky-300',
  labels: 'from-amber-200 to-orange-300',
  banners: 'from-teal-200 to-emerald-300',
  mixed: 'from-slate-200 to-gray-300',
}

function PostCard({ post }: { post: Post }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* 이미지 자리 — 실제 크리에이티브는 보드 승인 후 확정. 지금은 이미지 디렉션 표시. */}
      <div className={`relative aspect-square bg-gradient-to-br ${PRODUCT_GRADIENT[post.product] ?? PRODUCT_GRADIENT.mixed} p-4 flex flex-col justify-between`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/70 text-gray-800 px-2 py-0.5 rounded-full">
            Day {post.day} · {post.slot} {post.timeET} ET
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PILLAR_STYLE[post.pillar] ?? 'bg-gray-100 text-gray-700'}`}>
            {post.pillarLabel}
          </span>
        </div>
        <div className="bg-white/75 backdrop-blur-sm rounded-lg p-2">
          <p className="text-[11px] font-medium text-gray-500 mb-0.5">🎨 이미지 디렉션</p>
          <p className="text-xs text-gray-700 leading-snug">{post.imageDirection}</p>
        </div>
      </div>

      {/* 캡션 */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">{post.caption}</p>
        <p className="text-xs text-blue-600 leading-snug">{post.hashtags.join(' ')}</p>
        <div className="mt-auto pt-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 mb-0.5">첫 댓글</p>
          <p className="text-xs text-gray-600">{post.firstComment}</p>
        </div>
      </div>
    </article>
  )
}

export default function Omo3764InstagramReport() {
  const posts = plan.posts as Post[]
  const mix = plan.pillarMix as Record<string, number>
  const pillarLabels: Record<string, string> = {
    product_spotlight: 'Product Spotlight',
    use_case: 'Use-Case / Audience',
    education: 'Material & Finish Education',
    quality: 'Quality / Behind-the-Scenes',
    offer: 'Offer / CTA',
    engagement: 'Engagement',
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* 헤더 */}
        <header className="mb-8">
          <div className="flex items-center gap-2 text-pink-600 mb-2">
            <Camera className="w-6 h-6" />
            <span className="text-sm font-semibold uppercase tracking-wider">OMO-3764 · 검토용 리포트</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">프로카드 인스타 30일 콘텐츠 플랜</h1>
          <p className="mt-2 text-gray-600">
            게시물을 어떻게 올릴지 먼저 보고드립니다. 하루 2건 × 30일 = <strong>60개</strong> 초안을 모두 아래에 펼쳤습니다.
            발행은 보드 승인 후에만 진행됩니다(이 페이지는 발행 동작 없는 read-only 프리뷰).
          </p>
        </header>

        {/* 운영 방식 요약 */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <CalendarDays className="w-5 h-5 text-indigo-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">60</p>
            <p className="text-xs text-gray-500">게시물 / 30일</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Clock className="w-5 h-5 text-emerald-600 mb-2" />
            <p className="text-sm font-bold text-gray-900">09:00 · 18:00 ET</p>
            <p className="text-xs text-gray-500">하루 2건 (오전/오후)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ShieldCheck className="w-5 h-5 text-sky-600 mb-2" />
            <p className="text-sm font-bold text-gray-900">사람 승인 게이트</p>
            <p className="text-xs text-gray-500">approved 항목만 발행 (OMO-1908/2760)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <CheckCircle2 className="w-5 h-5 text-rose-600 mb-2" />
            <p className="text-sm font-bold text-gray-900">정책 통과</p>
            <p className="text-xs text-gray-500">전화번호·내부수량 미노출 · 가짜후기 0</p>
          </div>
        </section>

        {/* 필러 구성 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">콘텐츠 필러 구성 (다양성 보장)</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(mix).map(([k, n]) => (
              <span key={k} className={`text-sm font-medium px-3 py-1 rounded-full ${PILLAR_STYLE[k] ?? 'bg-gray-100 text-gray-700'}`}>
                {pillarLabels[k] ?? k} · {n}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            제품 소개 · 타깃별 활용 · 소재/마감 교육 · 품질/비하인드 · 오퍼 · 참여 유도를 섞어
            매일 다른 결의 콘텐츠를 노출합니다. 사회적 증거(후기)는 <strong>실제·승인된 사례만</strong> 사용합니다.
          </p>
        </section>

        {/* 60개 그리드 */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">60개 게시물 초안</h2>
            <span className="text-sm text-gray-400">{plan.cadence}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>

        <footer className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p>
            이 리포트는 <strong>발행 전 검토용</strong>입니다. 보드가 승인하면 ① 각 게시물 이미지 확정 ② Meta Graph 자격 수령 후
            09:00/18:00 ET 스케줄로 자동 발행합니다. 단일 진실원천:{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">src/data/omo3764-instagram-plan.json</code>
          </p>
        </footer>
      </div>
    </main>
  )
}
