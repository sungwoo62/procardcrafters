import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const PAGE_SIZE_DEFAULT = 10
const PAGE_SIZE_MAX = 50

type SortKey = 'newest' | 'highest' | 'lowest' | 'helpful'

const SORT_MAP: Record<SortKey, { column: string; ascending: boolean }> = {
  newest:  { column: 'created_at',   ascending: false },
  highest: { column: 'rating',       ascending: false },
  lowest:  { column: 'rating',       ascending: true  },
  helpful: { column: 'helpful_count', ascending: false },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)

  const rawSort = searchParams.get('sort') ?? 'newest'
  const sort: SortKey = rawSort in SORT_MAP ? (rawSort as SortKey) : 'newest'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT)
  )
  const offset = (page - 1) * pageSize

  const supabase = createServerClient()

  const { data: product } = await supabase
    .from('print_products')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { column, ascending } = SORT_MAP[sort]

  const { data: reviews, count, error } = await supabase
    .from('print_reviews')
    .select(
      'id, reviewer_name, rating, title, body, source, disclosure_note, helpful_count, photos, created_at',
      { count: 'exact' }
    )
    .eq('product_id', product.id)
    .eq('status', 'approved')
    .order(column, { ascending })
    .range(offset, offset + pageSize - 1)

  if (error) {
    return NextResponse.json({ error: '리뷰 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    reviews: reviews ?? [],
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  })
}
