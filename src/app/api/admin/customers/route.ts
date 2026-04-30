import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function verifyAdmin(request: NextRequest): boolean {
  return request.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const q = searchParams.get('q') ?? ''
  const limit = 20
  const offset = (page - 1) * limit

  const supabase = createServerClient()

  // Aggregate customer stats from orders table
  let query = supabase
    .from('print_orders')
    .select(
      'customer_email, customer_name, customer_phone, created_at, total_usd, status',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(`customer_email.ilike.%${q}%,customer_name.ilike.%${q}%`)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate per customer (dedup by email)
  const customerMap = new Map<
    string,
    {
      email: string
      name: string
      phone: string | null
      firstOrder: string
      lastOrder: string
      orderCount: number
      totalSpent: number
    }
  >()

  for (const row of data ?? []) {
    const existing = customerMap.get(row.customer_email)
    if (!existing) {
      customerMap.set(row.customer_email, {
        email: row.customer_email,
        name: row.customer_name,
        phone: row.customer_phone,
        firstOrder: row.created_at,
        lastOrder: row.created_at,
        orderCount: 1,
        totalSpent: row.total_usd,
      })
    } else {
      existing.orderCount += 1
      existing.totalSpent += row.total_usd
      if (row.created_at < existing.firstOrder) existing.firstOrder = row.created_at
      if (row.created_at > existing.lastOrder) existing.lastOrder = row.created_at
    }
  }

  const customers = Array.from(customerMap.values()).sort(
    (a, b) => new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
  )

  return NextResponse.json({
    customers,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  })
}
