import { NextRequest, NextResponse } from 'next/server'
import { fetchSwadpiaCategoryData, calculateSwadpiaPriceKrw } from '@/lib/swadpia'

/**
 * Swadpia real-time price lookup API
 *
 * GET /api/swadpia-price?slug=business-cards&paper=SNW250W00&qty=500&side=2
 *
 * Response: { priceKrw, paperCode, quantity, doubleSided, fetchSuccess }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const slug = searchParams.get('slug')
  const paperCode = searchParams.get('paper')
  const qty = parseInt(searchParams.get('qty') ?? '0', 10)
  const doubleSided = searchParams.get('side') !== '1'

  if (!slug) {
    return NextResponse.json({ error: 'slug parameter required' }, { status: 400 })
  }

  const data = await fetchSwadpiaCategoryData(slug)

  if (!data.fetchSuccess) {
    return NextResponse.json({
      error: 'Data fetch failed',
      message: data.errorMessage,
      fetchSuccess: false,
    }, { status: 502 })
  }

  // Specific price lookup
  if (paperCode && qty > 0) {
    const priceKrw = calculateSwadpiaPriceKrw(data, paperCode, qty, doubleSided)
    return NextResponse.json({
      priceKrw,
      paperCode,
      quantity: qty,
      doubleSided,
      fetchSuccess: true,
    })
  }

  // Return full data
  return NextResponse.json({
    categoryCode: data.categoryCode,
    papers: data.papers,
    printEntries: data.printEntries.slice(0, 200),
    sizes: data.sizes,
    fetchSuccess: true,
    fetchedAt: data.fetchedAt,
  })
}
