import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { runSwadpiaSync } from '@/lib/swadpia-sync'

// Vercel Cron: daily at 5pm UTC
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const supabase = createServerClient()

  try {
    const { data: products, error: productsError } = await supabase
      .from('print_products')
      .select('id, slug, base_price_krw')
      .eq('is_active', true)

    if (productsError) throw new Error(`Product query failed: ${productsError.message}`)
    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'No active products', results: [] })
    }

    // OMO-3072: 제품별 루프 + 결정적 기준단가 산출 (collapse 제품 전수 sync)
    const results = await runSwadpiaSync(supabase, products, 'cron')

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
