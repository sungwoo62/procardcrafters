import { NextRequest, NextResponse } from 'next/server'
import { fetchSwadpiaCategoryData, calculateSwadpiaPriceKrw } from '@/lib/swadpia'

/**
 * 성원 실시간 가격 조회 API
 *
 * GET /api/swadpia-price?slug=business-cards&paper=SNW250W00&qty=500&side=2
 *
 * 응답: { priceKrw, paperCode, quantity, doubleSided, fetchSuccess }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const slug = searchParams.get('slug')
  const paperCode = searchParams.get('paper')
  const qty = parseInt(searchParams.get('qty') ?? '0', 10)
  const doubleSided = searchParams.get('side') !== '1'

  if (!slug) {
    return NextResponse.json({ error: 'slug 파라미터 필요' }, { status: 400 })
  }

  const data = await fetchSwadpiaCategoryData(slug)

  if (!data.fetchSuccess) {
    return NextResponse.json({
      error: '성원 데이터 조회 실패',
      message: data.errorMessage,
      fetchSuccess: false,
    }, { status: 502 })
  }

  // 특정 가격 조회
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

  // 전체 데이터 반환
  return NextResponse.json({
    categoryCode: data.categoryCode,
    papers: data.papers,
    printEntries: data.printEntries.slice(0, 200),
    sizes: data.sizes,
    fetchSuccess: true,
    fetchedAt: data.fetchedAt,
  })
}
