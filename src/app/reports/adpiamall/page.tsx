import Link from 'next/link'
import { ArrowLeft, Layers, Flag, Star } from 'lucide-react'
import { ADPIAMALL_CATALOG, ADPIAMALL_SOURCE, type AdpiaCategory } from '@/config/adpiamall-catalog'

// OMO-3027: 애드피아몰(성원애드피아) 대형출력·실사 제품 구성 리포트.
// 보드 지시 — "배너/실사출력 제품은 애드피아몰 메뉴 뎁스 파서 전체구성 확인하고 보고서 세팅".
// 2026-06-13 로그인 라이브 크롤로 확인한 메뉴 전체구성을 단일 소스(adpiamall-catalog.ts)로 렌더.
export const dynamic = 'force-static'

export const metadata = {
  title: '애드피아몰 제품 구성 리포트 | Procardcrafters',
  robots: { index: false, follow: false },
}

const RELEVANCE_STYLE: Record<AdpiaCategory['relevance'], { label: string; cls: string }> = {
  core: { label: '핵심(우리 대형출력 직접연관)', cls: 'bg-indigo-100 text-indigo-700' },
  related: { label: '연관', cls: 'bg-blue-50 text-blue-600' },
  other: { label: '기타', cls: 'bg-gray-100 text-gray-500' },
}

export default function AdpiamallReportPage() {
  const totalItems = ADPIAMALL_CATALOG.reduce((n, c) => n + c.items.length, 0)
  const coreCats = ADPIAMALL_CATALOG.filter((c) => c.relevance === 'core')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/reports/swadpia-mapping" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> 성원 매핑 리포트
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Supplier Catalog Report</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">애드피아몰 대형출력·실사 제품 구성</h1>
        <p className="text-gray-600 mt-3 leading-relaxed text-sm">
          <strong>{ADPIAMALL_SOURCE.company}</strong>(대표 정창희)은 <strong>{ADPIAMALL_SOURCE.group}</strong> 그룹의
          <strong> 대형출력·실사 부문</strong>이다. 상업/디지털 인쇄(<code>{ADPIAMALL_SOURCE.siblingOffsetSite}</code>, 성원)와
          같은 그룹이며, 우리 배너·현수막·실사출력·POP 제품의 실생산 공급원이다.
        </p>
        <p className="text-gray-400 mt-1 text-xs">
          출처: {ADPIAMALL_SOURCE.site} 로그인 라이브 크롤 {ADPIAMALL_SOURCE.crawledAt} · 최상위 {ADPIAMALL_CATALOG.length}개 카테고리 / 하위 {totalItems}개 제품군.
          제품별 상세 규격(사이즈/단가)은 상품 페이지 딥 크롤 후속 작업 대상.
        </p>

        {/* 핵심 요약 */}
        <div className="mt-6 bg-white border border-indigo-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-900 text-sm">우리 대형출력 직접연관 핵심 {coreCats.length}종</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {coreCats.map((c) => (
              <span key={c.name} className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-medium text-indigo-700">
                {c.name} <span className="text-indigo-400">({c.items.length})</span>
              </span>
            ))}
          </div>
        </div>

        {/* 전체 구성 */}
        <div className="mt-8 space-y-4">
          {ADPIAMALL_CATALOG.map((c) => {
            const rs = RELEVANCE_STYLE[c.relevance]
            return (
              <div key={c.name} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-gray-400" />
                    <h3 className="font-bold text-gray-900">{c.name}</h3>
                    <span className="text-xs text-gray-400">{c.nameEn}</span>
                    <span className="text-xs text-gray-400">· {c.items.length}</span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${rs.cls}`}>{rs.label}</span>
                </div>
                {c.note && <p className="text-xs text-gray-500 mb-3">{c.note}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {c.items.map((it) => (
                    <span key={it} className="px-2.5 py-1 rounded-md bg-gray-50 border border-gray-100 text-xs text-gray-600">{it}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
