import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchSwadpiaCategoryDataByCode, fetchSwadpiaGoodsViewOptions, CATEGORY_MAP } from '@/lib/swadpia'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// OMO-3058 / OMO-3148 / OMO-3156: 제품 행 확장 시 보여줄 상세 (read-only).
// 좌측 = 성원에서 스크랩한 항목(라이브), 우측 = 우리 사이트에 적용된 옵션.
// ?slug=business-cards
//
// category_code 권위 소스 우선순위(OMO-3156 정책 결정):
//   1순위) 보드가 맵핑 리포트에서 링크를 직접 붙여 라이브 검증을 통과한 경우
//          (print_swadpia_mapping.swadpia_url != null AND status='verified') → 그 코드를 채택.
//          보드의 명시적 수동 오버라이드는 자동맵보다 우선한다.
//   2순위) CATEGORY_MAP[slug] (라이브 전수검증 완료, OMO-3097).
// 자동 시드 행(swadpia_url null)의 category_code 는 절대 참조하지 않는다 — 과거 시드의
// stale 코드(예: 배너 CPR5000)가 비교 데이터를 오염시키지 않도록. 이 API 는 쓰기 없음(공개 prod 안전).

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim()
  if (!slug) return NextResponse.json({ error: 'slug 필요' }, { status: 400 })

  const supabase = createServerClient()

  // 보드 링크 오버라이드 조회(검증 통과한 수동 링크만). 실패해도 CATEGORY_MAP 로 폴백.
  let categoryCode = CATEGORY_MAP[slug] ?? null
  let categoryCodeSource: 'board-link' | 'category-map' | null = categoryCode
    ? 'category-map'
    : null
  try {
    const { data: override } = await supabase
      .from('print_swadpia_mapping')
      .select('category_code, swadpia_url, status')
      .eq('slug', slug)
      .maybeSingle()
    if (
      override?.swadpia_url &&
      override.status === 'verified' &&
      override.category_code
    ) {
      categoryCode = override.category_code
      categoryCodeSource = 'board-link'
    }
  } catch {
    // 테이블 미존재/조회 실패 → CATEGORY_MAP 폴백 유지(공개 읽기 무손상)
  }

  // ── 성원 스크랩(라이브) ──────────────────────────────
  let swadpia: {
    categoryCode: string | null
    fetchSuccess: boolean
    error?: string
    papers: { code: string; name: string; single: number; double: number }[]
    printMethods: string[]
    sizes: { code: string; name: string; mm: string }[]
    qtyLadder: number[]
    basePriceKrw: number
    // OMO-3148: json_data 엔 없는 후가공·인쇄색상을 goods_view HTML 에서 별도 스크랩.
    printColors: { code: string; label: string }[]
    finishings: { code: string; label: string }[]
  } = {
    categoryCode,
    fetchSuccess: false,
    papers: [],
    printMethods: [],
    sizes: [],
    qtyLadder: [],
    basePriceKrw: 0,
    printColors: [],
    finishings: [],
  }
  if (categoryCode) {
    // 가격 매트릭스(json_data)와 옵션폼(goods_view HTML)을 병렬로 긁는다.
    // 보드 오버라이드 시 categoryCode 가 CATEGORY_MAP[slug] 와 다를 수 있으므로
    // 슬러그가 아닌 해석된 코드로 직접 라이브 조회한다(OMO-3156).
    const [data, gv] = await Promise.all([
      fetchSwadpiaCategoryDataByCode(categoryCode),
      fetchSwadpiaGoodsViewOptions(categoryCode),
    ])
    swadpia.printColors = gv.printColors
    swadpia.finishings = gv.finishings
    if (data.fetchSuccess) {
      const sortedQty = [...data.printEntries].sort((a, b) => a.quantity - b.quantity)
      swadpia = {
        categoryCode,
        fetchSuccess: true,
        papers: data.papers.slice(0, 40).map((p) => ({
          code: p.paper_code,
          name: p.paper_summary || p.paper_weight_txt || p.paper_code,
          single: p.price_unit1,
          double: p.price_unit2,
        })),
        printMethods: [
          ...new Set(data.printEntries.map((e) => e.print_method).filter(Boolean)),
        ],
        sizes: data.sizes.map((s) => ({
          code: s.size_type_code,
          name: s.size_type_name,
          mm:
            s.cut_norm_x_size && s.cut_norm_y_size
              ? `${s.cut_norm_x_size}×${s.cut_norm_y_size}mm`
              : '',
        })),
        qtyLadder: [...new Set(data.printEntries.map((e) => e.quantity))].sort(
          (a, b) => a - b,
        ),
        basePriceKrw: sortedQty.length ? sortedQty[0].print_unit2 : 0,
        printColors: gv.printColors,
        finishings: gv.finishings,
      }
    } else {
      // 가격 매트릭스 실패해도 goods_view 후가공/인쇄색상은 보여준다.
      swadpia.error = data.errorMessage
      swadpia.fetchSuccess = gv.fetchSuccess
    }
  }

  // ── 우리 사이트 적용 ────────────────────────────────
  const { data: product } = await supabase
    .from('print_products')
    .select('id, name_ko, name_en, base_price_krw, margin_multiplier, is_active')
    .eq('slug', slug)
    .maybeSingle()

  const applied: {
    exists: boolean
    nameKo?: string
    basePriceKrw?: number
    marginMultiplier?: number
    sellPriceKrw?: number
    isActive?: boolean
    // labels: 누락 비교용 전체 라벨 목록(samples 는 8개 캡이라 비교엔 부적합). OMO-3187
    optionGroups: { optionType: string; count: number; labels: string[]; samples: { value: string; label: string; extra: number }[] }[]
  } = { exists: Boolean(product), optionGroups: [] }

  if (product) {
    applied.nameKo = product.name_ko
    applied.basePriceKrw = product.base_price_krw
    applied.marginMultiplier = product.margin_multiplier ?? 3.3
    applied.sellPriceKrw = Math.round((product.base_price_krw ?? 0) * (product.margin_multiplier ?? 3.3))
    applied.isActive = product.is_active
    const { data: opts } = await supabase
      .from('print_product_options')
      .select('option_type, value, label_ko, extra_price_krw, sort_order')
      .eq('product_id', product.id)
      .order('option_type', { ascending: true })
      .order('sort_order', { ascending: true })
    const byType = new Map<string, { value: string; label: string; extra: number }[]>()
    for (const o of opts ?? []) {
      const list = byType.get(o.option_type) ?? []
      list.push({ value: o.value, label: o.label_ko, extra: o.extra_price_krw })
      byType.set(o.option_type, list)
    }
    applied.optionGroups = [...byType.entries()].map(([optionType, list]) => ({
      optionType,
      count: list.length,
      labels: list.map((x) => x.label),
      samples: list.slice(0, 8),
    }))
  }

  return NextResponse.json({ slug, categoryCode, categoryCodeSource, swadpia, applied })
}
