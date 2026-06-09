import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { OrderStatus } from '@/types/database'


export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as OrderStatus | null
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 20
  const offset = (page - 1) * limit

  const supabase = createServerClient()

  // OMO-2733: 목록 뷰는 print_order_items / print_files를 렌더하지 않는다.
  // 이전엔 `*, print_order_items(*, print_files(*))`로 페이지당 20건 × 모든 품목/파일을
  // 끌어와 응답이 비대했다. 목록이 실제 사용하는 스칼라 컬럼만 select 한다.
  let query = supabase
    .from('print_orders')
    .select(
      'id, order_number, customer_name, customer_email, total_usd, status, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { orders: data, total: count, page, limit },
    { headers: { 'Cache-Control': 'private, max-age=15' } }
  )
}
