import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchAllSwadpiaData, type SwadpiaCategoryData } from '@/lib/swadpia'

// Vercel Cron: 매일 오전 2시 KST (오후 5시 UTC)
export const maxDuration = 60

/** 성원 데이터에서 기본 단가 (최소 수량의 양면 인쇄비) 추출 */
function extractBasePrice(data: SwadpiaCategoryData): number {
  if (data.printEntries.length > 0) {
    const sorted = [...data.printEntries].sort((a, b) => a.quantity - b.quantity)
    return sorted[0].print_unit2
  }
  // printEntries가 없으면 paper_info에서 폴백
  if (data.papers.length > 0) {
    const paper = data.papers[0]
    return Math.round(paper.price_unit1 * paper.price_sale_rate)
  }
  return 0
}

export async function GET(req: NextRequest) {
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
    const { data: products, error: productsError } = await supabase
      .from('print_products')
      .select('id, slug, base_price_krw')
      .eq('is_active', true)

    if (productsError) throw new Error(`상품 조회 실패: ${productsError.message}`)
    if (!products || products.length === 0) {
      return NextResponse.json({ message: '활성 상품 없음', results: [] })
    }

    const swadpiaResults = await fetchAllSwadpiaData()

    for (const swData of swadpiaResults) {
      // slug 역매핑: categoryCode → slug
      const slug = Object.entries({
        'CNC1000': 'business-cards',
        'CST1000': 'stickers',
        'CLF1000': 'flyers',
        'CDP3000': 'postcards',
        'CPR2000': 'posters',
      }).find(([code]) => code === swData.categoryCode)?.[1]

      if (!slug) continue
      const product = products.find(p => p.slug === slug)
      if (!product) continue

      const prevPrice = Number(product.base_price_krw)
      const newPrice = extractBasePrice(swData)
      const priceChanged = newPrice > 0 && Math.abs(prevPrice - newPrice) > 0.01

      // 가격 이력 기록
      const { error: historyError } = await supabase
        .from('print_price_history')
        .insert({
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
          source: 'cron',
        })

      if (historyError) {
        results.push({ slug, success: false, priceChanged: false, error: historyError.message })
        continue
      }

      if (priceChanged && swData.fetchSuccess) {
        const { error: updateError } = await supabase
          .from('print_products')
          .update({ base_price_krw: newPrice })
          .eq('id', product.id)

        if (updateError) {
          results.push({ slug, success: false, priceChanged, error: updateError.message })
          continue
        }
      }

      results.push({
        slug,
        success: true,
        priceChanged,
        prevPrice,
        newPrice,
        error: swData.errorMessage,
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
