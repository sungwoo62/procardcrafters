import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { krwToUsd } from '@/lib/exchange-rate'
import {
  MATRIX_ROUTED_CATEGORIES,
  interpolateByQty,
  type MatrixCell,
} from '@/lib/swadpia-matrix'

// OMO-3241 ③ — 매트릭스 vs 현행가 대조(parity) 데이터 API.
//   컷오버(라이브 가격 변경) 전 보드가 회귀 리스크를 정량 확인하는 게이트:
//     · 커버리지: 매트릭스 적재 카테고리/조합/qty 범위, sampled vs interpolated.
//     · 최근 크롤 런: drift_detected / parity_summary (크롤≠화면 차단 안전망).
//     · 가격 델타: 각 카테고리 대표 조합에서 "현행 고객가(base_price_krw×margin)" vs
//       "매트릭스 도매가×margin" 을 병치 → 컷오버 시 고객가가 얼마나 움직이는지.
//   ⚠️ json_data 는 size 를 무시(전 size 동일가)하므로 라이브 재호출로는 멀티사이즈 대조가
//      불가능하다. 따라서 라이브 기준선은 '현행 고객가 경로(base_price_krw)'로 잡는다.
export const dynamic = 'force-dynamic'

const RATE = 1300 // KRW per USD (parity 페이지 폴백과 동일)

interface ProductRow {
  slug: string
  base_price_krw: number | null
  margin_multiplier: number | null
}

export async function GET(_req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const supabase = createServerClient()

  // ── 매트릭스 전량 로드(현재 801행 규모 — 단일 쿼리 허용) ──
  const { data: matrixRows, error: mErr } = await supabase
    .from('print_swadpia_price_matrix')
    .select('category_code,product_slug,size_code,paper_code,side,print_color_type,qty,total_price_krw,source')
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  const rows = (matrixRows ?? []) as Array<MatrixCell & { category_code: string; product_slug: string | null }>

  // ── 카테고리별 커버리지 집계 ──
  const byCat = new Map<
    string,
    {
      categoryCode: string
      productSlug: string | null
      cells: number
      sampled: number
      interpolated: number
      qtyMin: number
      qtyMax: number
      sizes: Set<string>
      papers: Set<string>
      printColorTypes: Set<string>
      sample: MatrixCell[]
    }
  >()
  for (const r of rows) {
    let e = byCat.get(r.category_code)
    if (!e) {
      e = {
        categoryCode: r.category_code,
        productSlug: r.product_slug,
        cells: 0,
        sampled: 0,
        interpolated: 0,
        qtyMin: Infinity,
        qtyMax: 0,
        sizes: new Set(),
        papers: new Set(),
        printColorTypes: new Set(),
        sample: [],
      }
      byCat.set(r.category_code, e)
    }
    e.cells++
    if (r.source === 'interpolated') e.interpolated++
    else e.sampled++
    e.qtyMin = Math.min(e.qtyMin, r.qty)
    e.qtyMax = Math.max(e.qtyMax, r.qty)
    e.sizes.add(r.size_code)
    e.papers.add(r.paper_code)
    e.printColorTypes.add(r.print_color_type)
    e.sample.push(r)
  }

  // ── 현행 고객가 비교용 제품 단가 로드 ──
  const slugs = [...new Set(rows.map((r) => r.product_slug).filter(Boolean) as string[])]
  const { data: prodData } = await supabase
    .from('print_products')
    .select('slug, base_price_krw, margin_multiplier')
    .in('slug', slugs.length ? slugs : ['__none__'])
  const prodBySlug = new Map<string, ProductRow>()
  for (const p of (prodData ?? []) as ProductRow[]) prodBySlug.set(p.slug, p)

  // ── 카테고리별 대표 조합 가격 델타 ──
  const coverage = [...byCat.values()].map((e) => {
    // 대표 조합 = 첫 (size,paper,side,pct) 조합의 qty 시계열.
    const k = (c: MatrixCell) => `${c.size_code}|${c.paper_code}|${c.side}|${c.print_color_type}`
    const firstKey = e.sample.length ? k(e.sample[0]) : ''
    const comboRows = e.sample.filter((c) => k(c) === firstKey)
    const repQty = comboRows.length
      ? comboRows.map((c) => c.qty).sort((a, b) => a - b)[Math.floor(comboRows.length / 2)]
      : 0
    const interp = comboRows.length ? interpolateByQty(comboRows, repQty) : null

    const prod = e.productSlug ? prodBySlug.get(e.productSlug) : undefined
    const margin = prod?.margin_multiplier ?? 3.3
    const matrixUsd = interp ? Math.round((krwToUsd(interp.totalPriceKrw * margin, RATE)) * 100) / 100 : null
    // 현행 고객가 = base_price_krw × margin (extra 옵션 제외한 기준선).
    const currentUsd =
      prod?.base_price_krw != null
        ? Math.round(krwToUsd(prod.base_price_krw * margin, RATE) * 100) / 100
        : null
    const deltaPct =
      matrixUsd != null && currentUsd != null && currentUsd > 0
        ? Math.round(((matrixUsd - currentUsd) / currentUsd) * 1000) / 10
        : null

    return {
      categoryCode: e.categoryCode,
      productSlug: e.productSlug,
      routed: MATRIX_ROUTED_CATEGORIES.has(e.categoryCode),
      cells: e.cells,
      sampled: e.sampled,
      interpolated: e.interpolated,
      qtyRange: [e.qtyMin === Infinity ? 0 : e.qtyMin, e.qtyMax] as [number, number],
      sizeCount: e.sizes.size,
      paperCount: e.papers.size,
      printColorTypes: [...e.printColorTypes],
      representative: interp
        ? {
            combo: firstKey,
            qty: repQty,
            matrixWholesaleKrw: interp.totalPriceKrw,
            source: interp.source,
            matrixCustomerUsd: matrixUsd,
            currentCustomerUsd: currentUsd,
            deltaPct,
          }
        : null,
    }
  })

  // ── 최근 크롤 런(드리프트/parity) ──
  const { data: runs } = await supabase
    .from('print_swadpia_price_crawl_runs')
    .select('id,started_at,finished_at,status,category_codes,sampled_count,interpolated_count,drift_detected,parity_summary,error')
    .order('started_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    rate: RATE,
    routedCategories: [...MATRIX_ROUTED_CATEGORIES],
    totalCells: rows.length,
    coverage: coverage.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode)),
    recentRuns: runs ?? [],
  })
}
