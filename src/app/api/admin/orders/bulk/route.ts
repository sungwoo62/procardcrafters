import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { OrderStatus } from '@/types/database'

function verifyAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

// Allowed bulk target statuses
const BULK_ALLOWED_TARGET: OrderStatus[] = [
  'paid', 'processing', 'shipped', 'delivered', 'cancelled',
]

export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  let body: { ids: string[]; status: OrderStatus }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
  }

  const { ids, status } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Order ID list required' }, { status: 400 })
  }

  if (!BULK_ALLOWED_TARGET.includes(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_orders')
    .update({ status })
    .in('id', ids)
    .select('id, order_number, status')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: data?.length ?? 0, orders: data })
}
