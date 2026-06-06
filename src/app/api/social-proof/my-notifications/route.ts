import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAuthBrowserClient } from '@/lib/supabase'

// 본인 알림 이력: 최근 30일 본인 주문 기반 토스트 이력
export async function GET(req: NextRequest) {
  // Authorization 헤더 또는 쿠키로 사용자 확인
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ notifications: [] }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ notifications: [] }, { status: 401 })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // print_social_proof_events 에서 본인 self-recognition 이력
  const { data: events } = await supabase
    .from('print_social_proof_events')
    .select('*')
    .eq('viewer_user_id', user.id)
    .eq('is_self_recognition', true)
    .gte('viewed_at', since)
    .order('viewed_at', { ascending: false })
    .limit(50)

  // 실제 주문 데이터와 조인해 알림 메시지 생성
  const orderIds = (events ?? []).filter(e => e.order_id).map(e => e.order_id)
  let orderMap: Record<string, { customer_name: string; product_name: string }> = {}

  if (orderIds.length > 0) {
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: orders } = await serviceClient
      .from('print_orders')
      .select('id, customer_name, print_order_items(product_name_en)')
      .in('id', orderIds)

    orderMap = Object.fromEntries(
      (orders ?? []).map(o => [
        o.id,
        {
          customer_name: o.customer_name,
          product_name: (o.print_order_items as { product_name_en: string }[])?.[0]?.product_name_en ?? 'Print Order',
        }
      ])
    )
  }

  const notifications = (events ?? []).map(e => ({
    id: e.id,
    toastType: e.toast_type,
    orderId: e.order_id,
    productName: e.order_id ? orderMap[e.order_id]?.product_name : null,
    viewedAt: e.viewed_at,
    pagePath: e.page_path,
  }))

  return NextResponse.json({ notifications })
}
