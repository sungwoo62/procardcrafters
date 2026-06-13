import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchSwadpiaCategoryDataByCode, CATEGORY_MAP } from '@/lib/swadpia'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// OMO-3058: 제품 행 확장 시 보여줄 상세.
// 좌측 = 성원에서 스크랩한 항목(라이브), 우측 = 우리 사이트에 적용된 옵션.
// ?slug=business-cards

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim()
  if (!slug) return NextResponse.json({ error: 'slug 필요' }, { status: 400 })

  const supabase = createServerClient()

  // 맵핑 행에서 (보드가 붙인) category_code 우선, 없으면 기본맵
  const { data: mapRow } = await supabase
    .from('print_swadpia_mapping')
    .select('category_code, swadpia_url, status, fingerprint')
    .eq('slug', slug)
    .maybeSingle()
  const categoryCode = mapRow?.category_code ?? CATEGORY_MAP[slug] ?? null

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
  } = {
    categoryCode,
    fetchSuccess: false,
    papers: [],
    printMethods: [],
    sizes: [],
    qtyLadder: [],
    basePriceKrw: 0,
  }
  if (categoryCode) {
    const data = await fetchSwadpiaCategoryDataByCode(categoryCode)
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
      }
    } else {
      swadpia.error = data.errorMessage
    }
  }

  // ── 우리 사이트 적용 ────────────────────────────────
  const { data: product } = await supabase
    .from('print_products')
    .select('id, name_ko, name_en, base_price_krw, is_active')
    .eq('slug', slug)
    .maybeSingle()

  const applied: {
    exists: boolean
    nameKo?: string
    basePriceKrw?: number
    isActive?: boolean
    optionGroups: { optionType: string; count: number; samples: { value: string; label: string; extra: number }[] }[]
  } = { exists: Boolean(product), optionGroups: [] }

  if (product) {
    applied.nameKo = product.name_ko
    applied.basePriceKrw = product.base_price_krw
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
      samples: list.slice(0, 8),
    }))
  }

  return NextResponse.json({
    slug,
    categoryCode,
    swadpiaUrl: mapRow?.swadpia_url ?? null,
    status: mapRow?.status ?? null,
    swadpia,
    applied,
  })
}
