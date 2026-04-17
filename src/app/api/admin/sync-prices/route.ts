import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchSwadpiaProductPrice, fetchAllSwadpiaPrices } from '@/lib/swadpia'

// 관리자 수동 가격 동기화 API
// POST /api/admin/sync-prices           → 전체 상품 동기화
// POST /api/admin/sync-prices?slug=xxx  → 특정 상품만 동기화
// GET  /api/admin/sync-prices           → 최근 가격 이력 조회

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

  // 수동 가격 입력 지원 (body에 manualPrice 포함 시)
  let manualPrices: Record<string, number> | null = null
  try {
    const body = await req.json()
    if (body.manualPrices && typeof body.manualPrices === 'object') {
      manualPrices = body.manualPrices
    }
  } catch {
    // body 없음 또는 JSON이 아닌 경우 → 스크래핑 모드
  }

  // 대상 상품 목록 조회
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
    // 수동 가격 입력 모드
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
        const { error: updateError } = await supabase
          .from('print_products')
          .update({ base_price_krw: newPrice })
          .eq('id', product.id)

        if (updateError) {
          results.push({ slug: product.slug, success: false, error: updateError.message })
          continue
        }
      }

      results.push({ slug: product.slug, success: true, priceChanged, prevPrice, newPrice })
    }
  } else {
    // 성원애드피아 스크래핑 모드
    const swadpiaSlugs = targetSlug ? [targetSlug] : products.map(p => p.slug)
    const swadpiaResults = targetSlug
      ? [await fetchSwadpiaProductPrice(targetSlug)]
      : await fetchAllSwadpiaPrices()

    for (const swadpiaData of swadpiaResults) {
      const product = products.find(p => p.slug === swadpiaData.slug)
      if (!product) continue

      const prevPrice = Number(product.base_price_krw)
      const newPrice = swadpiaData.basePriceKrw
      const priceChanged = Math.abs(prevPrice - newPrice) > 0.01

      const { data: historyRow, error: historyError } = await supabase
        .from('print_price_history')
        .insert({
          product_id: product.id,
          product_slug: swadpiaData.slug,
          prev_price_krw: prevPrice,
          new_price_krw: newPrice,
          price_changed: priceChanged,
          source_data: swadpiaData.sourceData,
          fetch_success: swadpiaData.fetchSuccess,
          error_message: swadpiaData.errorMessage ?? null,
          source: 'manual',
        })
        .select('id')
        .single()

      if (historyError) {
        results.push({ slug: swadpiaData.slug, success: false, error: historyError.message })
        continue
      }

      if (swadpiaData.optionPrices.length > 0 && historyRow) {
        await supabase.from('print_option_price_history').insert(
          swadpiaData.optionPrices.map(op => ({
            price_history_id: historyRow.id,
            product_id: product.id,
            option_key: op.optionKey,
            price_krw: op.priceKrw,
            swadpia_goods_code: op.goodsCode,
          }))
        )
      }

      if (priceChanged && swadpiaData.fetchSuccess) {
        const { error: updateError } = await supabase
          .from('print_products')
          .update({ base_price_krw: newPrice })
          .eq('id', product.id)

        if (updateError) {
          results.push({ slug: swadpiaData.slug, success: false, error: updateError.message })
          continue
        }
      }

      results.push({
        slug: swadpiaData.slug,
        success: true,
        priceChanged,
        prevPrice,
        newPrice,
        fetchSuccess: swadpiaData.fetchSuccess,
        error: swadpiaData.errorMessage,
      })

      void swadpiaSlugs // suppress unused warning
    }
  }

  return NextResponse.json({
    message: `동기화 완료: ${results.filter(r => r.success).length}/${results.length}`,
    results,
    timestamp: new Date().toISOString(),
  })
}
