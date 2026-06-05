import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(_request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_reviews')
    .select(
      `id, reviewer_name, rating, body, featured_quote, featured_sort,
       is_homepage_featured, status, source, created_at,
       product:print_products(id, name_en, name_ko)`
    )
    .eq('status', 'approved')
    .order('featured_sort', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

// 일괄 순서 저장: [{ id, featured_sort, is_homepage_featured, featured_quote? }]
export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  let body: {
    updates: {
      id: string
      featured_sort: number
      is_homepage_featured: boolean
      featured_quote?: string | null
    }[]
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: 'updates 배열 필수' }, { status: 400 })
  }

  const supabase = createServerClient()

  const auditRows: Record<string, unknown>[] = []

  for (const u of body.updates) {
    const patch: Record<string, unknown> = {
      featured_sort: u.featured_sort,
      is_homepage_featured: u.is_homepage_featured,
    }
    if ('featured_quote' in u) {
      patch.featured_quote = u.featured_quote ?? null
    }

    const { error } = await supabase.from('print_reviews').update(patch).eq('id', u.id)

    if (!error) {
      auditRows.push({
        review_id: u.id,
        admin_user_id: user.id,
        action: u.is_homepage_featured ? 'featured' : 'unfeatured',
        note: `sort=${u.featured_sort}${u.featured_quote ? `, quote 업데이트` : ''}`,
      })
    }
  }

  if (auditRows.length > 0) {
    await supabase.from('print_review_admin_audit').insert(auditRows)
  }

  return NextResponse.json({ saved: auditRows.length })
}
