// 제품군별 니치 sibling 메시(OMO-3213) — 직업 NicheProfessionLinks.tsx 의 일반화.
// 한 카테고리 내 다른 유스케이스로의 완전한 내부링크 메시(고아 페이지 방지).
import Link from 'next/link'
import type { NicheCategory } from '@/lib/niche/categories'

type Props = {
  category: NicheCategory
  /** 제외할 entry slug(현재 페이지 자신). 미지정 시 전체 노출(허브용). */
  excludeSlug?: string
  heading?: string
  subhead?: string
}

export default function CategoryNicheLinks({ category, excludeSlug, heading, subhead }: Props) {
  const entries = category.entries.filter((e) => e.slug !== excludeSlug)
  if (entries.length === 0) return null

  const h = heading ?? `More ${category.label.toLowerCase()}`
  const s = subhead ?? `Same quality printing, tuned for a different job.`

  return (
    <section className="bg-white border-t border-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{h}</h2>
          <p className="text-gray-500 text-sm mt-1">{s}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((e) => (
            <Link
              key={e.slug}
              href={`/${category.slug}/for/${e.slug}`}
              className="group rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-5 bg-white"
            >
              <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {e.audience}
              </div>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{e.heroSubhead}</p>
              <span className="inline-block mt-3 text-xs font-semibold text-blue-600">View options →</span>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link
            href={`/${category.slug}/for`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            See all {category.label.toLowerCase()} →
          </Link>
        </div>
      </div>
    </section>
  )
}
