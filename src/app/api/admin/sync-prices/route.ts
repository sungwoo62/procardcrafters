import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchSwadpiaCategoryData, fetchAllSwadpiaData, type SwadpiaCategoryData } from '@/lib/swadpia'

// 관리자 수동 가격 동기화 API
// POST /api/admin/sync-prices           → 전체 상품 동기화
// POST /api/admin/sync-prices?slug=xxx  → 특정 상품만 동기화
// GET  /api/admin/sync-prices           → 최근 가격 이력 조회

const CATEGORY_TO_SLUG: Record<string, string> = {
  'CNC1000': 'business-cards',
  'CNC2000': 'premium-business-cards',
  'CST1000': 'stickers',
  'CST2000': 'die-cut-stickers',
  'CLF1000': 'flyers',
  'CLF2000': 'brochures',
  'CDP3000': 'postcards',
  'CPR2000': 'posters',
  'CPR5000': 'banners',
}

function extractBasePrice(data: SwadpiaCategoryData): number {
  if (data.printEntries.length > 0) {
    const sorted = [...data.printEntries].sort((a, b) => a.quantity - b.quantity)
    return sorted[0].print_unit2
  }
  if (data.papers.length > 0) {
    const paper = data.papers[0]
    return Math.round(paper.price_unit1 * paper.price_sale_rate)
  }
  return 0
}

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)

  let query = supabase
    .from('print_price_history')
    .select(`
      id,
      product_slug,
      prev_price_krw,
      new_price_krw,
      price_changed,
      fetch_success,
      error_message,
      source,
      fetched_at
    `)
    .order('fetched_at', { ascending: false })
    .limit(limit)

  if (slug) {
    query = query.eq('product_slug', slug)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ history: data })
}

export async function POST(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const targetSlug = searchParams.get('slug')

  // 수동 가격 입력 지원
  let manualPrices: Record<string, number> | null = null
  try {
    const body = await req.json()
    if (body.manualPrices && typeof body.manualPrices === 'object') {
      manualPrices = body.manualPrices
    }
  } catch {
    // body 없음 → 성원 스크래핑 모드
  }

  let productQuery = supabase
    .from('print_products')
    .select('id, slug, base_price_krw')
    .eq('is_active', true)

  if (targetSlug) {
    productQuery = productQuery.eq('slug', targetSlug)
  }

  const { data: products, error: productsError } = await productQuery
  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }
  if (!products || products.length === 0) {
    return NextResponse.json({ error: '상품을 찾을 수 없음' }, { status: 404 })
  }

  const results = []

  if (manualPrices) {
    for (const product of products) {
      const newPrice = manualPrices[product.slug]
      if (newPrice === undefined) continue

      const prevPrice = Number(product.base_price_krw)
      const priceChanged = Math.abs(prevPrice - newPrice) > 0.01

      const { error: historyError } = await supabase.from('print_price_history').insert({
        product_id: product.id,
        product_slug: product.slug,
        prev_price_krw: prevPrice,
        new_price_krw: newPrice,
        price_changed: priceChanged,
        source_data: { method: 'manual' },
        fetch_success: true,
        source: 'manual',
      })

      if (historyError) {
        results.push({ slug: product.slug, success: false, error: historyError.message })
        continue
      }

      if (priceChanged) {
        await supabase
          .from('print_products')
          .update({ base_price_krw: newPrice })
          .eq('id', product.id)
      }

      results.push({ slug: product.slug, success: true, priceChanged, prevPrice, newPrice })
    }
  } else {
    // 성원 스크래핑 모드
    const swadpiaResults = targetSlug
      ? [await fetchSwadpiaCategoryData(targetSlug)]
      : await fetchAllSwadpiaData()

    for (const swData of swadpiaResults) {
      const slug = CATEGORY_TO_SLUG[swData.categoryCode]
      if (!slug) continue
      const product = products.find(p => p.slug === slug)
      if (!product) continue

      const prevPrice = Number(product.base_price_krw)
      const newPrice = extractBasePrice(swData)
      const priceChanged = newPrice > 0 && Math.abs(prevPrice - newPrice) > 0.01

      const { error: historyError } = await supabase.from('print_price_history').insert({
        product_id: product.id,
        product_slug: slug,
        prev_price_krw: prevPrice,
        new_price_krw: newPrice,
        price_changed: priceChanged,
        source_data: {
          papers: swData.papers.length,
          printEntries: swData.printEntries.length,
          sizes: swData.sizes.length,
        },
        fetch_success: swData.fetchSuccess,
        error_message: swData.errorMessage ?? null,
        source: 'manual',
      })

      if (historyError) {
        results.push({ slug, success: false, error: historyError.message })
        continue
      }

      if (priceChanged && swData.fetchSuccess) {
        await supabase
          .from('print_products')
          .update({ base_price_krw: newPrice })
          .eq('id', product.id)
      }

      results.push({
        slug,
        success: true,
        priceChanged,
        prevPrice,
        newPrice,
        fetchSuccess: swData.fetchSuccess,
        error: swData.errorMessage,
      })
    }
  }

  return NextResponse.json({
    message: `동기화 완료: ${results.filter(r => r.success).length}/${results.length}`,
    results,
    timestamp: new Date().toISOString(),
  })
}
