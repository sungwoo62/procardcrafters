import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchAllSwadpiaPrices } from '@/lib/swadpia'

// Vercel Cron: 매일 오전 2시 KST (오후 5시 UTC)
// vercel.json에 설정: "0 17 * * *"
export const maxDuration = 60 // 최대 60초

export async function GET(req: NextRequest) {
  // Cron 보안: Vercel이 보내는 Authorization 헤더 검증
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const supabase = createServerClient()
  const results: {
    slug: string
    success: boolean
    priceChanged: boolean
    prevPrice?: number
    newPrice?: number
    error?: string
  }[] = []

  try {
    // 1. 모든 상품 현재 가격 조회
    const { data: products, error: productsError } = await supabase
      .from('print_products')
      .select('id, slug, base_price_krw')
      .eq('is_active', true)

    if (productsError) throw new Error(`상품 조회 실패: ${productsError.message}`)
    if (!products || products.length === 0) {
      return NextResponse.json({ message: '활성 상품 없음', results: [] })
    }

    // 2. 성원애드피아에서 가격 조회
    const swadpiaResults = await fetchAllSwadpiaPrices()

    // 3. 상품별 가격 업데이트
    for (const swadpiaData of swadpiaResults) {
      const product = products.find(p => p.slug === swadpiaData.slug)
      if (!product) continue

      const prevPrice = Number(product.base_price_krw)
      const newPrice = swadpiaData.basePriceKrw
      const priceChanged = Math.abs(prevPrice - newPrice) > 0.01

      // 가격 이력 기록
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
          source: 'cron',
        })
        .select('id')
        .single()

      if (historyError) {
        results.push({ slug: swadpiaData.slug, success: false, priceChanged: false, error: historyError.message })
        continue
      }

      // 옵션별 가격 이력 기록
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

      // 가격이 변경된 경우에만 print_products 업데이트
      if (priceChanged && swadpiaData.fetchSuccess) {
        const { error: updateError } = await supabase
          .from('print_products')
          .update({ base_price_krw: newPrice })
          .eq('id', product.id)

        if (updateError) {
          results.push({ slug: swadpiaData.slug, success: false, priceChanged, error: updateError.message })
          continue
        }
      }

      results.push({
        slug: swadpiaData.slug,
        success: true,
        priceChanged,
        prevPrice,
        newPrice,
        error: swadpiaData.errorMessage,
      })
    }

    const updatedCount = results.filter(r => r.success && r.priceChanged).length
    const failedCount = results.filter(r => !r.success).length

    return NextResponse.json({
      message: `가격 동기화 완료: ${updatedCount}개 업데이트, ${failedCount}개 실패`,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: `가격 업데이트 실패: ${message}` }, { status: 500 })
  }
}
