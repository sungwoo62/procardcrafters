import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// 이름 마스킹: 김철수 → 김** / John Doe → Jo**
function maskName(name: string): string {
  if (!name) return '고객**'
  const trimmed = name.trim()
  if (!trimmed) return '고객**'
  // 한국어 이름: 첫 글자(성) + **
  const isKorean = /[가-힯]/.test(trimmed[0])
  if (isKorean) {
    return trimmed[0] + '**'
  }
  // 영문: 첫 2글자 + **
  return trimmed.slice(0, 2) + '**'
}

// 상대 시간: "방금", "N분 전", "N시간 전"
function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}시간 전`
  return `${Math.floor(diffH / 24)}일 전`
}

export const revalidate = 60  // 1분 캐시

export async function GET() {
  try {
    const supabase = createServerClient()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // print_orders: 최근 24시간 결제완료 주문
    const { data: printOrders, error } = await supabase
      .from('print_orders')
      .select(`
        id,
        customer_name,
        shipping_city,
        shipping_state,
        shipping_country,
        created_at,
        print_order_items(product_name_en)
      `)
      .in('status', ['paid', 'processing', 'shipped', 'delivered'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const toasts = (printOrders ?? []).map(order => {
      const city = order.shipping_city || order.shipping_state || order.shipping_country || 'somewhere'
      const productName = (order.print_order_items as { product_name_en: string }[] | null)?.[0]?.product_name_en ?? 'Print Order'
      return {
        id: order.id,
        type: 'recent_order' as const,
        maskedName: maskName(order.customer_name),
        city,
        productName,
        relativeTime: relativeTime(order.created_at),
        createdAt: order.created_at,
      }
    })

    return NextResponse.json({ toasts }, { headers: { 'Cache-Control': 's-maxage=60' } })
  } catch {
    return NextResponse.json({ toasts: [] }, { status: 200 })
  }
}
