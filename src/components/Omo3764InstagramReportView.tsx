import { Camera, Clock, CheckCircle2, ShieldCheck, CalendarDays } from 'lucide-react'
import plan from '@/data/omo3764-instagram-plan.json'

// OMO-3764(보드 요청): "게시물 어떻게 할건지 60개 뽑아서 웹에다 해서 먼저 보고."
// 30일 × 2건 = 60개 인스타 콘텐츠 초안을 단일 진실원천(src/data/omo3764-instagram-plan.json)에서
// 읽어 피드 프리뷰로 렌더하는 read-only 뷰. 쓰기/발행 동작 없음.
// 이 컴포넌트는 어드민 리포트(/reports/omo-3764-instagram)와 로그인 없는 토큰 공유 링크
// (/share/instagram-plan/[token]) 양쪽에서 동일하게 재사용된다.

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
      {/* 실제 브랜드 크리에이티브(1080×1080). 위에 Day/필러 배지 오버레이. */}
      <div className="relative aspect-square">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imageUrl} alt={post.altText} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${PRODUCT_GRADIENT[post.product] ?? PRODUCT_GRADIENT.mixed}`} />
        )}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider bg-black/45 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
            Day {post.day} · {post.slot} {post.timeET} ET
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PILLAR_STYLE[post.pillar] ?? 'bg-gray-100 text-gray-700'}`}>
            {post.pillarLabel}
          </span>
        </div>
      </div>

      {/* 캡션 */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">{post.caption}</p>
        <p className="text-xs text-blue-600 leading-snug">{post.hashtags.join(' ')}</p>
        <div className="pt-1 rounded-lg bg-pink-50 border border-pink-100 p-2">
          <p className="text-[11px] font-semibold text-pink-600 mb-0.5">📸 실사 촬영 디렉션 (포토 생성 프롬프트)</p>
          <p className="text-xs text-gray-600 leading-snug">{post.photoPrompt ?? post.imageDirection}</p>
        </div>
        <div className="mt-auto pt-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 mb-0.5">첫 댓글</p>
          <p className="text-xs text-gray-600">{post.firstComment}</p>
        </div>
      </div>
    </article>
  )
}

export default function Omo3764InstagramReportView() {
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
            하루 2건 × 30일 = <strong>60개</strong> 게시물을 캡션·해시태그·<strong>이미지까지 모두 적용</strong>해 펼쳤습니다.
            각 이미지는 브랜드 일관 1080×1080 크리에이티브입니다(실제 발행 시 사진 교체·래스터화 가능).
            발행은 보드 승인 후에만 진행됩니다(이 페이지는 발행 동작 없는 read-only 프리뷰).
          </p>
        </header>

        {/* 실사 이미지 적용 안내 */}
        <section className="mb-8 rounded-xl border border-pink-200 bg-pink-50 p-5">
          <p className="text-sm font-semibold text-pink-700 mb-1">📸 실사 제품사진(트렌디·힙) 생성·적용 완료</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            보드 요청대로 <strong>막 예쁘게 촬영한 실사 느낌 + 감각적 배경 + 트렌디·힙</strong> 제품사진을 <strong>Mac-Studio ChatGPT(GPT)로 직접 생성해 60장 전부 적용</strong>했습니다.
            전부 1080×1080 포토리얼, 텍스트·로고·워터마크 없음. 각 카드의 <strong>「실사 촬영 디렉션」</strong>이 실제 생성 프롬프트입니다.
            실제 IG 발행 시 그대로 사용하거나 실제 촬영본으로 교체할 수 있습니다.
          </p>
        </section>

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
            이 리포트는 <strong>발행 전 검토용</strong>입니다. 캡션·해시태그·이미지가 모두 적용되어 있습니다. 보드가 승인하면
            Meta Graph 자격 수령 후 09:00/18:00 ET 스케줄로 자동 발행합니다(이미지는 발행 단계에서 PNG/JPG로 래스터화). 단일 진실원천:{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">src/data/omo3764-instagram-plan.json</code>
          </p>
        </footer>
      </div>
    </main>
  )
}
