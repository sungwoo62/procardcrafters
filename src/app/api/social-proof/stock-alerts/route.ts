import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// 재고 임계치: 이하일 때만 FOMO 노출
const STOCK_THRESHOLD = 20

export const revalidate = 3600  // 1시간 캐시

export async function GET() {
  try {
    const supabase = createServerClient()

    // print_products 중 재고 컬럼(stock_count)이 있는 경우
    // 현재 스키마에서는 print_products에 재고 필드가 없으므로
    // 향후 hardcase_/medal_ 통합 시 활용. 지금은 빈 배열 반환.
    const { data, error } = await supabase
      .from('print_products')
      .select('id, slug, name_en, stock_count')
      .eq('is_active', true)
      .filter('stock_count', 'not.is', null)
      .lte('stock_count', STOCK_THRESHOLD)
      .order('stock_count', { ascending: true })
      .limit(5)

    if (error) {
      // stock_count 컬럼이 아직 없는 경우 정상 폴백
      return NextResponse.json({ alerts: [] })
    }

    const alerts = (data ?? []).map(p => ({
      slug: p.slug,
      productName: p.name_en,
      stockCount: p.stock_count as number,
    }))

    return NextResponse.json({ alerts }, { headers: { 'Cache-Control': 's-maxage=3600' } })
  } catch {
    return NextResponse.json({ alerts: [] }, { status: 200 })
  }
}
