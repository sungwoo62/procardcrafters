// 직업별 니치 랜딩 내부링크 블록 (OMO-2994).
// 고아 페이지 해소용: /products/business-cards(허브 진입점)와 각 니치 페이지(sibling 메시)에서 재사용.
// getAllProfessions()를 단일 소스로 사용 → 신규 직업 추가 시 자동 반영(완전한 mesh 유지).
import Link from 'next/link'
import { getAllProfessions } from '@/lib/niche/professions'

type Props = {
  /** 제외할 slug(현재 페이지 자신). 미지정 시 전체 노출(허브/제품 페이지용). */
  excludeSlug?: string
  heading?: string
  subhead?: string
}

export default async function NicheProfessionLinks({
  excludeSlug,
  heading = 'Business Cards by Profession',
  subhead = 'Premium cards designed around how each profession actually hands one out.',
}: Props) {
  const professions = (await getAllProfessions()).filter((p) => p.slug !== excludeSlug)
  if (professions.length === 0) return null

  return (
    <section className="bg-white border-t border-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{heading}</h2>
          <p className="text-gray-500 text-sm mt-1">{subhead}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {professions.map((p) => (
            <Link
              key={p.slug}
              href={`/business-cards/for/${p.slug}`}
              className="group rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-5 bg-white"
            >
              <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                Business Cards for {p.profession}
              </div>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{p.heroSubhead}</p>
              <span className="inline-block mt-3 text-xs font-semibold text-blue-600">View cards →</span>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link
            href="/business-cards/for"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            See all professions →
          </Link>
        </div>
      </div>
    </section>
  )
}
