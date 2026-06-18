import Link from 'next/link'
import { ArrowLeft, BadgeCheck, Database, ShieldCheck, ArrowRight } from 'lucide-react'
import { PRINTCITY_PRODUCTS, startingSupplyKrw, withVat, wonKR } from '@/lib/printcity-product'

// OMO-3452 (보드 2026-06-18): "실제 제품 페이지를 만들어라 — printcity 제품·옵션 기반".
//   printcity 명함 판매가능 제품을 개별 실제 제품 페이지(/business-cards/printcity/[id])로 구성.
//   각 페이지는 전 옵션축(용지·사이즈·코팅·도수·박 등) 선택형 구성기 + 조합별 printcity 직독가.
//   성원(swadpia) 명함 경로는 삭제하지 않고 본 섹션에 노출하지 않음(보존). 고객가/결제 컷오버는 보드 게이트.
export const dynamic = 'force-static'
export const metadata = {
  title: '명함 제품 (printcity) · Procardcrafters',
  description: 'printcity 공개 가격 API 직독으로 만든 명함 제품 페이지 — 용지·사이즈·코팅·도수·박 전 옵션 선택형, 옵션 누락 없음.',
}

export default function PrintcityNamecardIndexPage() {
  const products = PRINTCITY_PRODUCTS
  const totalCombos = products.reduce((s, p) => s + p.table.length, 0)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/products"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> 전체 제품
      </Link>

      <div className="flex items-center gap-2">
        <BadgeCheck className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">명함 제품 — printcity</h1>
      </div>
      <p className="mt-2 text-sm text-gray-600 max-w-2xl">
        <strong>printcity.co.kr 스토어프론트에 실제로 등록된 명함 제품</strong>(site/seller/printcity 메뉴 진실원천)만
        가져와 만든 실제 제품 페이지입니다. 각 제품을 열면 용지·사이즈·코팅·도수·박 등 <strong>모든 옵션을 선택</strong>할 수 있고,
        가격은 printcity 가격 API(<span className="font-mono text-xs">productbysite/{'{id}'}</span>) JSON을 직독한 값입니다
        (<strong>옵션 누락 0</strong>). 성원 명함 구성/코드는 삭제하지 않고 이 섹션에 노출하지 않습니다.
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat value={String(products.length)} label="명함 제품" />
        <Stat value={totalCombos.toLocaleString('ko-KR')} label="옵션 조합(직독)" />
        <Stat value="JSON" label="공개 GET 직독 · 누락 0" icon={<Database className="h-4 w-4 text-green-700" />} green />
        <Stat value="게이트" label="결제/가격 컷오버 보드 승인" icon={<ShieldCheck className="h-4 w-4 text-amber-700" />} amber />
      </div>

      {groupBySub(products).map(({ sub, items }) => (
        <section key={sub} className="mt-8">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="inline-block w-1.5 h-4 rounded-full bg-blue-500" />
            {sub} <span className="text-gray-400 font-normal">({items.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => {
              const start = startingSupplyKrw(p)
              const startTotal = start ? withVat(start.krw).total : null
              const axisCount = Object.keys(p.axes).length
              return (
                <Link
                  key={p.id}
                  href={`/business-cards/printcity/${p.id}`}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 border border-gray-100 flex items-center justify-center mb-4">
                    <BadgeCheck className="h-9 w-9 text-blue-400" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.nameKO}</h3>
                    {p.hasFoil && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                        박 {p.axes.foil?.options.length ?? 0}색
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{p.subType} · {p.label}</p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    {axisCount + 1}축 옵션 · {p.table.length}조합 · {p.quantities.length}수량구간
                  </p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      {startTotal != null ? (
                        <>
                          <span className="text-[11px] text-gray-400">부터 </span>
                          <span className="text-lg font-bold text-gray-900">{wonKR(startTotal)}</span>
                          <span className="text-[11px] text-gray-400"> / {start?.qty.toLocaleString('ko-KR')}매</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">견적 옵션 선택</span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                      옵션 선택 <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function groupBySub(products: typeof PRINTCITY_PRODUCTS) {
  const order: string[] = []
  const map = new Map<string, typeof PRINTCITY_PRODUCTS>()
  for (const p of products) {
    const sub = p.sub ?? '명함'
    if (!map.has(sub)) { map.set(sub, []); order.push(sub) }
    map.get(sub)!.push(p)
  }
  return order.map((sub) => ({ sub, items: map.get(sub)! }))
}

function Stat({
  value,
  label,
  icon,
  green,
  amber,
}: {
  value: string
  label: string
  icon?: React.ReactNode
  green?: boolean
  amber?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className={`flex items-center gap-1 text-lg font-bold ${green ? 'text-green-700' : amber ? 'text-amber-700' : 'text-gray-900'}`}>
        {icon}
        {value}
      </div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  )
}
