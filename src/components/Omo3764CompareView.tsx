import { GitCompare, ImageIcon } from 'lucide-react'
import data from '@/data/omo3764-instagram-compare.json'

// OMO-3764(보드 지시): "비교본으로 해서 버전 1 2 나눠서 말해줘."
// 각 게시물의 캡션 V1(원본)과 V2(실제 이미지 기준 재작성·보강)를 나란히 비교하는 read-only 뷰.
// V1 = 커밋 74b081c(이미지와 따로 쓰인 원본), V2 = 54856be(60장 실제 이미지에 맞춰 재작성).

type Row = (typeof data.posts)[number]

function CompareCard({ row }: { row: Row }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col">
      <div className="grid md:grid-cols-[180px_1fr]">
        {/* 이미지 */}
        <div className="relative aspect-square md:aspect-auto md:h-full bg-gray-100">
          {row.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.imageUrl} alt={row.altText} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImageIcon className="w-8 h-8" />
            </div>
          )}
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-black/50 text-white px-2 py-0.5 rounded-full">
            Day {row.day} · {row.slot} · {row.product}
          </span>
        </div>

        {/* V1 vs V2 */}
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {/* V1 */}
          <div className="p-4 bg-gray-50/60">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Version 1 · 원본</p>
            <p className="text-sm text-gray-500 whitespace-pre-line leading-relaxed">{row.captionV1 || '—'}</p>
            {row.firstCommentV1 ? (
              <p className="mt-2 text-[11px] text-gray-400">첫 댓글: {row.firstCommentV1}</p>
            ) : null}
          </div>
          {/* V2 */}
          <div className="p-4 bg-emerald-50/50">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Version 2 · 이미지 기준 보강 ✨</p>
            <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">{row.captionV2 || '—'}</p>
            {row.firstCommentV2 ? (
              <p className="mt-2 text-[11px] text-gray-500">첫 댓글: {row.firstCommentV2}</p>
            ) : null}
            <p className="mt-2 text-[11px] text-blue-500 leading-snug">{row.hashtags.join(' ')}</p>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Omo3764CompareView() {
  const rows = data.posts as Row[]
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <GitCompare className="w-6 h-6" />
            <span className="text-sm font-semibold uppercase tracking-wider">OMO-3764 · 캡션 비교본 (V1 ↔ V2)</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">인스타 캡션 버전 비교 — 원본 vs 이미지 기준 보강</h1>
          <p className="mt-2 text-gray-600">
            게시물 60개 각각 <strong>Version 1(원본 캡션)</strong>과 <strong>Version 2(실제 생성 이미지에 맞춰 재작성·보강한 캡션)</strong>를 나란히 비교합니다.
            V1은 이미지와 따로 작성돼 사진과 어긋나던 문구(예: 홀로그래픽 명함에 &ldquo;Rounded corners&rdquo;), V2는 사진에 실제 보이는 제품·연출 기준으로 정렬했습니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500">Version 1 = 원본 (커밋 74b081c)</span>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">Version 2 = 이미지 기준 보강 (커밋 54856be · 현재 라이브)</span>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {rows.map(row => (
            <CompareCard key={row.id} row={row} />
          ))}
        </div>
      </div>
    </main>
  )
}
