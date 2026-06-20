// OMO-3520: 전상품 가격 감사 대시보드 (보드 요청).
//   "전체 상품들 어떻게 되는지 웹페이지 + 풀링크 — 성원금액, 우리금액, 적용마진율, 그외".
//   각 상품: 성원 실시간 매트릭스 도매가(KRW) → ×margin_multiplier(보드 설정) ×환율 → 고객가(USD).
//   검산 컬럼으로 마진 적용이 정확한지 즉시 확인.
//
//   ⚠️ 성원 도매가 노출 → middleware 가 /admin/* 를 isAllowedAdmin 으로 게이트(서버 전용, 비공개).
//   가격은 item(인쇄) 기준 — 배송비·후가공 surcharge 별도(주석 참고).
export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { fetchSwadpiaCategoryData } from '@/lib/swadpia'
import { lookupSwadpiaCost, calculatePriceFromSwadpia, calculateItemPriceUsd } from '@/lib/pricing'

interface ProductRow {
  slug: string
  name_en: string
  name_ko: string
  category: string
  base_price_krw: number
  margin_multiplier: number
  is_active: boolean
}

interface AuditRow {
  slug: string
  name: string
  category: string
  margin: number
  source: 'matrix' | 'base_price_krw'
  paper: string | null
  qty: number | null
  swonKrw: number          // 성원 원가(KRW)
  ourUsd: number           // 우리 고객가(USD)
  checkUsd: number         // 검산: 성원 × margin ÷ 환율
}

export default async function PricingAuditPage() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_products')
    .select('slug,name_en,name_ko,category,base_price_krw,margin_multiplier,is_active')
    .eq('is_active', true)
    .order('category')
  const products = (data ?? []) as ProductRow[]

  const exchangeRate = await getKrwToUsdRate()
  const krwPerUsd = Math.round(1 / exchangeRate)

  const settled = await Promise.allSettled(
    products.map(async (p): Promise<AuditRow> => {
      let swonKrw = p.base_price_krw
      let source: AuditRow['source'] = 'base_price_krw'
      let paper: string | null = null
      let qty: number | null = null
      try {
        const cat = await fetchSwadpiaCategoryData(p.slug)
        const valid = cat.fetchSuccess
          ? cat.printEntries.filter((e) => e.print_unit2 > 0).sort((a, b) => a.quantity - b.quantity)
          : []
        if (valid.length > 0) {
          paper = valid[0].paper_code
          const r = lookupSwadpiaCost(cat.printEntries, paper, valid[0].quantity)
          if (r && r.costKrw > 0) {
            swonKrw = r.costKrw
            qty = r.effectiveQty
            source = 'matrix'
          }
        }
      } catch {
        /* 성원 실패 → base_price_krw 폴백 */
      }
      const ourUsd =
        source === 'matrix'
          ? calculatePriceFromSwadpia({ swadpiaCostKrw: swonKrw, marginMultiplier: p.margin_multiplier, exchangeRate })
          : calculateItemPriceUsd({ basePriceKrw: swonKrw, marginMultiplier: p.margin_multiplier, extraPricesKrw: [], exchangeRate })
      const checkUsd = Math.round((swonKrw * p.margin_multiplier) / krwPerUsd * 100) / 100
      return {
        slug: p.slug, name: p.name_en || p.name_ko, category: p.category, margin: p.margin_multiplier,
        source, paper, qty, swonKrw, ourUsd, checkUsd,
      }
    }),
  )
  const rows = settled.filter((s): s is PromiseFulfilledResult<AuditRow> => s.status === 'fulfilled').map((s) => s.value)

  const matrixRows = rows.filter((r) => r.source === 'matrix')
  const baseRows = rows.filter((r) => r.source === 'base_price_krw')

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900">전상품 가격 감사 — 성원원가 · 마진 · 고객가</h1>
        <p className="mt-2 text-sm text-gray-600">
          각 상품의 성원 실시간 도매가(KRW) → <b>×마진율(보드 설정 margin_multiplier)</b> → ×환율 → 고객가(USD).
          <b> 검산</b> 컬럼이 우리가와 일치하면 마진 적용 정확. 환율 <b>{krwPerUsd.toLocaleString()} KRW/USD</b> 적용.
        </p>
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <b>읽는 법 / 엣지(내가 생각못한 부분):</b>
          <ul className="ml-4 mt-1 list-disc space-y-0.5">
            <li>금액은 <b>item(인쇄) 기준</b> — 배송비·후가공(박/형압 등) surcharge는 별도 가산(여기 미포함).</li>
            <li>성원원가는 <b>매트릭스 최소수량</b> 셀(@qty 표기). 수량↑일수록 단가↓(볼륨할인) — 표시·청구 모두 동일 매트릭스(OMO-3562 일원화 완료, 표시==결제).</li>
            <li>환율은 운영 floor {krwPerUsd === 1525 ? '(1,525 기준)' : '(실시간)'} — 약세 시 더 보수적 값 사용.</li>
            <li>매트릭스 없는 상품(스티커·배너 등 quote-only)은 <b>base_price_krw</b> 기준(아래 별도 표). 성원 직매트릭스 부재.</li>
          </ul>
        </div>

        <h2 className="mt-6 text-lg font-semibold text-gray-900">① 성원 매트릭스 기반 ({matrixRows.length}개)</h2>
        <PriceTable rows={matrixRows} krwPerUsd={krwPerUsd} />

        <h2 className="mt-8 text-lg font-semibold text-gray-900">② base_price_krw 기준 — 매트릭스 부재 ({baseRows.length}개)</h2>
        <PriceTable rows={baseRows} krwPerUsd={krwPerUsd} />

        <p className="mt-6 text-xs text-gray-400">
          OMO-3520 · 서버 라이브 산출(성원 실시간) · /admin 게이트(비공개) · 마진=product.margin_multiplier
        </p>
      </div>
    </div>
  )
}

function PriceTable({ rows, krwPerUsd }: { rows: AuditRow[]; krwPerUsd: number }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
            <th className="px-3 py-2">제품</th>
            <th className="px-3 py-2">카테고리</th>
            <th className="px-3 py-2 text-right">성원원가(KRW)</th>
            <th className="px-3 py-2">@수량·용지</th>
            <th className="px-3 py-2 text-right">마진율</th>
            <th className="px-3 py-2 text-right">우리 고객가(USD)</th>
            <th className="px-3 py-2 text-right">검산</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ok = Math.abs(r.ourUsd - r.checkUsd) < 0.02
            return (
              <tr key={r.slug} className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{r.category}</td>
                <td className="px-3 py-2 text-right font-mono">{r.swonKrw.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.qty ? `q${r.qty} · ${r.paper}` : '—'}</td>
                <td className="px-3 py-2 text-right font-mono">×{r.margin}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-indigo-700">${r.ourUsd.toFixed(2)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs ${ok ? 'text-emerald-600' : 'text-rose-600 font-bold'}`}>
                  {r.swonKrw.toLocaleString()}×{r.margin}÷{krwPerUsd.toLocaleString()}=${r.checkUsd.toFixed(2)} {ok ? '✓' : '⚠'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
