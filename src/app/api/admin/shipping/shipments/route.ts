import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

// 송장 리스트 (전체) - /admin/shipping/shipments
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 30
  const offset = (page - 1) * limit

  const supabase = createServerClient()
  let query = supabase
    .from('print_shipments')
    .select(
      'id, order_id, carrier, tracking_number, weight_kg, cost_usd, charged_usd, status, shipped_at, delivered_at, created_at, ' +
      'print_orders(order_number, customer_name, shipping_country, shipping_city)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shipments: data, total: count, page, limit })
}
