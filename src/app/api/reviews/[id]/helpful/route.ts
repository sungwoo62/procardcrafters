import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createAuthRouteClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params

  // 로그인 사용자 확인 (선택적 — 비로그인도 IP 기반 허용)
  let userId: string | undefined
  try {
    const authClient = await createAuthRouteClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()
    userId = user?.id
  } catch {
    // 비로그인 허용
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null

  if (!userId && !ip) {
    return NextResponse.json({ error: '요청 식별자를 확인할 수 없습니다.' }, { status: 400 })
  }

  const supabase = createServerClient()

  // 승인된 리뷰인지 확인
  const { data: review } = await supabase
    .from('print_reviews')
    .select('id, helpful_count')
    .eq('id', reviewId)
    .eq('status', 'approved')
    .maybeSingle()

  if (!review) {
    return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 중복 투표 확인
  if (userId) {
    const { data: existing } = await supabase
      .from('print_review_helpful')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: '이미 도움이 됐어요를 표시하셨습니다.', helpful_count: review.helpful_count },
        { status: 409 }
      )
    }
  } else if (ip) {
    const { data: existing } = await supabase
      .from('print_review_helpful')
      .select('id')
      .eq('review_id', reviewId)
      .eq('ip_address', ip)
      .is('user_id', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: '이미 도움이 됐어요를 표시하셨습니다.', helpful_count: review.helpful_count },
        { status: 409 }
      )
    }
  }

  // 투표 기록 삽입
  const { error: insertError } = await supabase.from('print_review_helpful').insert({
    review_id: reviewId,
    user_id: userId ?? null,
    // 로그인 사용자 IP는 저장하지 않음 (최소 권한)
    ip_address: userId ? null : ip,
  })

  if (insertError) {
    // 레이스 컨디션 — 유니크 제약 위반
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: '이미 도움이 됐어요를 표시하셨습니다.', helpful_count: review.helpful_count },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // helpful_count 증가
  const { data: updated } = await supabase
    .from('print_reviews')
    .update({ helpful_count: review.helpful_count + 1 })
    .eq('id', reviewId)
    .select('helpful_count')
    .single()

  return NextResponse.json({ helpful_count: updated?.helpful_count ?? review.helpful_count + 1 })
}
