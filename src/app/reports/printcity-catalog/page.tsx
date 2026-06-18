import Link from 'next/link'
import { ArrowLeft, ListTree, Database, Layers } from 'lucide-react'
import { CATALOG } from '@/lib/printcity-namecard'

// OMO-3454 (board 2026-06-18): printcity 전체 제품군 리스트업을 실제 스토어프론트로 교정.
// 데이터: src/data/printcity-catalog-census.json
//   = scripts/omo3454-printcity-real-catalog-crawl.mjs 가 site/seller/printcity menuCategory
//     (실제 노출 카탈로그 104제품/12카테고리) 직독. OMO-3414 전역 product?all=true(타 테넌트 혼입) 폐기.
export const dynamic = 'force-static'

const priceTypeLabel = (t: string | null) =>
  t === 'priceComplete' ? '룩업(완성형)' : t === 'priceCalculation' ? '계산형' : (t ?? '—')

export default function PrintcityCatalogReport() {
  const cats = CATALOG.categories

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/reports/printcity-namecard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> printcity 명함 census·가격차
      </Link>

      <div className="flex items-center gap-2">
        <ListTree className="h-6 w-6 text-emerald-600" />
        <h1 className="text-2xl font-bold text-gray-900">printcity 전체 제품군 전수 크롤링 · 리스트업</h1>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        OMO-3454. printcity <b>실제 스토어프론트</b>(<code className="rounded bg-gray-100 px-1">site/seller/printcity</code>)의{' '}
        <b>전 제품군</b>을 <b>공개 GET JSON API</b>(<code className="rounded bg-gray-100 px-1">price-api.dtp21.com/v2</code>)로 직독.
        총 <b>{CATALOG.productCount}제품</b> / <b>{CATALOG.categoryCount}개 1차 카테고리</b>. 읽기전용, 실주문 없음.
      </p>

      {/* 요약 카드 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={<Database className="h-4 w-4" />} label="전수 제품" value={`${CATALOG.productCount}건`} sub={`API 보고 total ${CATALOG.reportedTotal}`} />
        <SummaryCard icon={<Layers className="h-4 w-4" />} label="1차 카테고리" value={`${CATALOG.categoryCount}개`} sub="cat1 기준" />
        <SummaryCard icon={<ListTree className="h-4 w-4" />} label="룩업(완성형)" value={`${CATALOG.priceTypeTotals['priceComplete'] ?? 0}건`} sub="가격표 번들 직독" />
        <SummaryCard icon={<ListTree className="h-4 w-4" />} label="계산형" value={`${CATALOG.priceTypeTotals['priceCalculation'] ?? 0}건`} sub="공식 계산" />
      </div>

      <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="font-semibold">크롤링 방식 (재현 가능)</div>
        <p className="mt-1">
          교정 사유: 기존 <code className="rounded bg-emerald-100 px-1">product?all=true&page=N</code> 전수는 site-scope가 없어
          공용 SaaS 타 테넌트 제품(171제품/25카테고리)이 혼입됐다. 진실원천은{' '}
          <code className="rounded bg-emerald-100 px-1">site/seller/printcity</code>의 <code className="rounded bg-emerald-100 px-1">menuCategory</code> —
          printcity가 실제 노출하는 카테고리·제품(cateItems)만 그룹핑하고, priceType은{' '}
          <code className="rounded bg-emerald-100 px-1">productbysite/{'{id}'}</code> 직독으로 채운다. 크롤러:{' '}
          <code className="rounded bg-emerald-100 px-1">scripts/omo3454-printcity-real-catalog-crawl.mjs</code>.
        </p>
      </div>

      {/* 카테고리별 제품 리스트 */}
      <Section title="① 카테고리별 전체 제품 리스트업" desc="1차 카테고리(제품수 내림차순) → 제품명(KO/EN)·2차분류·가격결정타입. priceType 분포로 가격 직독 가능성 가늠.">
        <div className="space-y-6">
          {cats.map((c) => (
            <div key={c.cat1} className="rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <div className="font-semibold text-gray-900">
                  {c.cat1} <span className="ml-1 text-sm font-normal text-gray-500">{c.count}제품</span>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {Object.entries(c.priceTypes).map(([t, n]) => (
                    <span key={t} className="rounded bg-white px-2 py-0.5 text-gray-500 ring-1 ring-gray-200">
                      {priceTypeLabel(t)} {n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto p-2">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400">
                      <Th>제품명(KO)</Th><Th>제품명(EN)</Th><Th>2차분류</Th><Th>3차코드</Th><Th>가격결정</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.products.map((p) => (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-medium text-gray-800">{p.nameKO ?? '—'}</td>
                        <td className="px-2 text-gray-500">{p.nameEN ?? '—'}</td>
                        <td className="px-2 text-gray-500">{p.cat2 ?? '—'}</td>
                        <td className="px-2 text-xs text-gray-400">{p.cat3 ?? '—'}</td>
                        <td className="px-2 text-xs text-gray-500">{priceTypeLabel(p.priceType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        <div className="font-semibold text-gray-700">데이터 출처 · 결정론</div>
        <p className="mt-1">{CATALOG.source}</p>
        <p className="mt-0.5">크롤 방식: {CATALOG.crawledVia}</p>
        <p className="mt-0.5">
          크롤러: <code className="rounded bg-gray-100 px-1">scripts/omo3454-printcity-real-catalog-crawl.mjs</code> ·
          데이터: <code className="rounded bg-gray-100 px-1">src/data/printcity-catalog-census.json</code>
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">{icon}{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mb-3 mt-0.5 text-sm text-gray-500">{desc}</p>
      {children}
    </section>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 pb-1 font-medium">{children}</th>
}
