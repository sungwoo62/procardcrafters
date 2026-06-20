// OMO-3520: 전상품 가격 감사 대시보드 (보드 요청).
//   각 상품: 성원 실시간 매트릭스 도매가(KRW) → ×margin_multiplier(보드 설정) ×환율 → 고객가(USD).
//
//   ★ OMO-3520(보드 지적): 상품의 **기본 용지**(print_product_options is_default) 기준으로 산출한다.
//     성원 매트릭스에 기본 용지가 없으면(코드 불일치) ⚠ 플래그 + 매트릭스 최저가 용지로 폴백
//     (= ProductConfigurator 의 실제 동작). 이 경우 "기본용지 표시 ≠ 가격책정 용지" 불일치가 노출된다.
//
//   ⚠️ 성원 도매가 노출 → middleware 가 /admin/* 게이트(비공개). 금액은 item(인쇄) 기준.
export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { fetchSwadpiaCategoryData } from '@/lib/swadpia'
import { lookupSwadpiaCost, calculatePriceFromSwadpia, calculateItemPriceUsd } from '@/lib/pricing'

interface OptionRow { option_type: string; value: string; is_default: boolean }
interface ProductRow {
  slug: string; name_en: string; name_ko: string; category: string
  base_price_krw: number; margin_multiplier: number
  print_product_options: OptionRow[]
}
interface AuditRow {
  slug: string; name: string; category: string; margin: number
  defaultPaper: string | null   // DB 기본 용지(고객이 기본으로 보는 용지)
  pricedPaper: string | null    // 실제 가격책정에 쓰인 매트릭스 용지
  paperMismatch: boolean        // 기본용지가 매트릭스에 없어 폴백됨
  qty: number | null
  swonKrw: number; ourUsd: number; checkUsd: number
  source: 'matrix' | 'base_price_krw'
}

function defaultOf(opts: OptionRow[], type: string): string | null {
  const o = opts.find((x) => x.option_type === type && x.is_default) ?? opts.find((x) => x.option_type === type)
  return o?.value ?? null
}

export default async function PricingAuditPage() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_products')
    .select('slug,name_en,name_ko,category,base_price_krw,margin_multiplier,print_product_options(option_type,value,is_default)')
    .eq('is_active', true)
    .order('category')
  const products = (data ?? []) as unknown as ProductRow[]

  const exchangeRate = await getKrwToUsdRate()
  const krwPerUsd = Math.round(1 / exchangeRate)

  const settled = await Promise.allSettled(
    products.map(async (p): Promise<AuditRow> => {
      const opts = p.print_product_options ?? []
      const defaultPaper = defaultOf(opts, 'paper_code')
      const defaultQty = Number(defaultOf(opts, 'paper_qty') ?? defaultOf(opts, 'quantity')) || null

      let swonKrw = p.base_price_krw
      let source: AuditRow['source'] = 'base_price_krw'
      let pricedPaper: string | null = null
      let paperMismatch = false
      let qty: number | null = defaultQty
      try {
        const cat = await fetchSwadpiaCategoryData(p.slug)
        const valid = cat.fetchSuccess ? cat.printEntries.filter((e) => e.print_unit2 > 0).sort((a, b) => a.quantity - b.quantity) : []
        const matrixPapers = new Set(valid.map((e) => e.paper_code))
        if (valid.length > 0) {
          // ProductConfigurator 동작 재현: 기본용지가 매트릭스에 있으면 사용, 없으면 매트릭스 첫 용지로 폴백.
          if (defaultPaper && matrixPapers.has(defaultPaper)) {
            pricedPaper = defaultPaper
          } else {
            pricedPaper = valid[0].paper_code
            paperMismatch = !!defaultPaper // 기본용지가 있는데 매트릭스에 없어 폴백됨
          }
          const lookupQty = defaultQty ?? valid[0].quantity
          const r = lookupSwadpiaCost(cat.printEntries, pricedPaper, lookupQty)
          if (r && r.costKrw > 0) { swonKrw = r.costKrw; qty = r.effectiveQty; source = 'matrix' }
        }
      } catch { /* 폴백 */ }

      const ourUsd = source === 'matrix'
        ? calculatePriceFromSwadpia({ swadpiaCostKrw: swonKrw, marginMultiplier: p.margin_multiplier, exchangeRate })
        : calculateItemPriceUsd({ basePriceKrw: swonKrw, marginMultiplier: p.margin_multiplier, extraPricesKrw: [], exchangeRate })
      const checkUsd = Math.round((swonKrw * p.margin_multiplier) / krwPerUsd * 100) / 100
      return {
        slug: p.slug, name: p.name_en || p.name_ko, category: p.category, margin: p.margin_multiplier,
        defaultPaper, pricedPaper, paperMismatch, qty, swonKrw, ourUsd, checkUsd, source,
      }
    }),
  )
  const rows = settled.filter((s): s is PromiseFulfilledResult<AuditRow> => s.status === 'fulfilled').map((s) => s.value)
  const mismatches = rows.filter((r) => r.paperMismatch)
  const matrixRows = rows.filter((r) => r.source === 'matrix')
  const baseRows = rows.filter((r) => r.source === 'base_price_krw')

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900">전상품 가격 감사 — 성원원가 · 마진 · 고객가</h1>
        <p className="mt-2 text-sm text-gray-600">
          각 상품의 <b>기본 용지·기본 수량</b>(고객 기본 노출) 기준 성원 도매가 → ×마진율(margin_multiplier) → ×환율 → 고객가(USD).
          환율 <b>{krwPerUsd.toLocaleString()} KRW/USD</b>. 금액은 item(인쇄) 기준 — 배송·후가공 별도.
        </p>
        {mismatches.length > 0 && (
          <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
            <b>⚠️ 기본용지 ↔ 성원 매트릭스 불일치 {mismatches.length}건</b> — 기본 용지가 성원 가격매트릭스에 없어
            <b> 매트릭스 최저가 용지로 폴백</b>되어 책정됩니다(ProductConfigurator 실제 동작). 즉 <b>고객이 보는 기본용지 ≠ 가격책정 용지</b>.
            <div className="mt-1">예: {mismatches.slice(0, 4).map((m) => `${m.name}(기본 ${m.defaultPaper} → 책정 ${m.pricedPaper})`).join(' · ')}</div>
          </div>
        )}

        <h2 className="mt-6 text-lg font-semibold text-gray-900">① 성원 매트릭스 기반 ({matrixRows.length}개)</h2>
        <PriceTable rows={matrixRows} krwPerUsd={krwPerUsd} />
        <h2 className="mt-8 text-lg font-semibold text-gray-900">② base_price_krw 기준 — 매트릭스 부재 ({baseRows.length}개)</h2>
        <PriceTable rows={baseRows} krwPerUsd={krwPerUsd} />
        <p className="mt-6 text-xs text-gray-400">OMO-3520 · 서버 라이브(성원 실시간) · /admin 게이트 · 기본용지·기본수량 기준</p>
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
            <th className="px-3 py-2">기본용지(고객노출)</th>
            <th className="px-3 py-2">가격책정용지·수량</th>
            <th className="px-3 py-2 text-right">성원원가</th>
            <th className="px-3 py-2 text-right">마진</th>
            <th className="px-3 py-2 text-right">고객가</th>
            <th className="px-3 py-2 text-right">검산</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ok = Math.abs(r.ourUsd - r.checkUsd) < 0.02
            return (
              <tr key={r.slug} className={`border-b border-gray-100 ${r.paperMismatch ? 'bg-rose-50' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.defaultPaper ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                  {r.qty ? `q${r.qty} · ${r.pricedPaper}` : '—'}{r.paperMismatch && <span className="text-rose-600"> ⚠불일치</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.swonKrw.toLocaleString()}</td>
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
