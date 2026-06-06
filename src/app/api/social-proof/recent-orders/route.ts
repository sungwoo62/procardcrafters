import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// 이름 마스킹: "James Wilson" → "Ja** W." / 한국어 포함 시 null 반환(필터링)
function maskName(name: string): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  // 한국어/중국어/일본어 포함 이름은 표시 제외
  if (/[぀-ヿ㐀-䶿一-鿿가-힯]/.test(trimmed)) return null
  const parts = trimmed.split(/\s+/)
  const first = parts[0]
  const last = parts.length >= 2 ? parts[parts.length - 1] : null
  const masked = first.slice(0, 2) + '**'
  return last && last !== first ? masked + ' ' + last[0].toUpperCase() + '.' : masked
}

// 상대 시간: "just now", "N min ago", "Nh ago"
function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
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

    // 아시아권 국가 코드/이름 제외 (한국, 일본, 중국, 대만, 홍콩, 싱가포르 등)
    const EXCLUDED_COUNTRIES = new Set(['KR', 'JP', 'CN', 'TW', 'HK', 'SG', 'MY', 'TH', 'VN', 'PH',
      'Korea', 'Japan', 'China', 'Taiwan', 'Hong Kong', 'Singapore'])

    const toasts = (printOrders ?? [])
      .filter(order => {
        const country = order.shipping_country ?? ''
        return !EXCLUDED_COUNTRIES.has(country)
      })
      .map(order => {
        const masked = maskName(order.customer_name)
        if (!masked) return null
        const city = order.shipping_city || order.shipping_state || order.shipping_country || 'somewhere'
        const productName = (order.print_order_items as { product_name_en: string }[] | null)?.[0]?.product_name_en ?? 'Print Order'
        return {
          id: order.id,
          type: 'recent_order' as const,
          maskedName: masked,
          city,
          productName,
          relativeTime: relativeTime(order.created_at),
          createdAt: order.created_at,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ toasts }, { headers: { 'Cache-Control': 's-maxage=60' } })
  } catch {
    return NextResponse.json({ toasts: [] }, { status: 200 })
  }
}
