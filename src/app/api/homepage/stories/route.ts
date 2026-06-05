import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServerClient()

  const { data: stories, error } = await supabase
    .from('print_reviews')
    .select(
      'id, reviewer_name, rating, title, body, featured_quote, source, disclosure_note, helpful_count, created_at, product_id'
    )
    .eq('is_homepage_featured', true)
    .eq('status', 'approved')
    .order('featured_sort', { ascending: true })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: '스토리 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ stories: stories ?? [] })
}
