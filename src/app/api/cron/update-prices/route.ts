import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchAllSwadpiaData, type SwadpiaCategoryData } from '@/lib/swadpia'

// Vercel Cron: daily at 5pm UTC
export const maxDuration = 60

/** Extract base price (min quantity double-sided print cost) from Swadpia data */
function extractBasePrice(data: SwadpiaCategoryData): number {
  if (data.printEntries.length > 0) {
    const sorted = [...data.printEntries].sort((a, b) => a.quantity - b.quantity)
    return sorted[0].print_unit2
  }
  // Fall back to paper_info if no printEntries
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
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
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

    if (productsError) throw new Error(`Product query failed: ${productsError.message}`)
    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'No active products', results: [] })
    }

    const swadpiaResults = await fetchAllSwadpiaData()

    for (const swData of swadpiaResults) {
      // Reverse map: categoryCode to slug
      const slug = Object.entries({
        'CNC1000': 'business-cards',
        'CNC2000': 'premium-business-cards',
        'CST1000': 'stickers',
        'CST2000': 'die-cut-stickers',
        'CLF1000': 'flyers',
        'CLF2000': 'brochures',
        'CDP3000': 'postcards',
        'CPR2000': 'posters',
        'CPR5000': 'banners',
      }).find(([code]) => code === swData.categoryCode)?.[1]

      if (!slug) continue
      const product = products.find(p => p.slug === slug)
      if (!product) continue

      const prevPrice = Number(product.base_price_krw)
      const newPrice = extractBasePrice(swData)
      const priceChanged = newPrice > 0 && Math.abs(prevPrice - newPrice) > 0.01

      // Record price history
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
      message: `Price sync complete: ${updatedCount} updated, ${failedCount} failed`,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Price update failed: ${message}` }, { status: 500 })
  }
}
