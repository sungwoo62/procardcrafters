import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createAuthRouteClient } from '@/lib/supabase-server'

interface ReviewRequest {
  orderId: string
  productId: string
  rating: number
  title?: string
  body: string
  reviewerName: string
}

export async function POST(request: NextRequest) {
  let body: ReviewRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { orderId, productId, rating, title, body: reviewBody, reviewerName } = body

  if (!orderId || !productId || !rating || !reviewBody || !reviewerName) {
    return NextResponse.json(
      { error: 'orderId, productId, rating, body, reviewerName는 필수입니다.' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'rating은 1~5 정수여야 합니다.' }, { status: 400 })
  }

  // 인증 확인
  const authClient = await createAuthRouteClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const supabase = createServerClient()

  // eligibility: delivered/shipped 주문 + 본인 확인
  const { data: order } = await supabase
    .from('print_orders')
    .select('id, customer_email, status')
    .eq('id', orderId)
    .in('status', ['shipped', 'delivered'])
    .maybeSingle()

  if (!order) {
    return NextResponse.json(
      { error: '배송 완료(shipped/delivered) 상태의 주문을 찾을 수 없습니다.' },
      { status: 400 }
    )
  }

  if (order.customer_email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return NextResponse.json(
      { error: '본인의 주문에만 리뷰를 작성할 수 있습니다.' },
      { status: 403 }
    )
  }

  // 해당 주문에 해당 상품이 포함되어 있는지 확인
  const { data: orderItem } = await supabase
    .from('print_order_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('product_id', productId)
    .maybeSingle()

  if (!orderItem) {
    return NextResponse.json(
      { error: '해당 주문에 포함된 상품이 아닙니다.' },
      { status: 400 }
    )
  }

  // 미작성 확인: 동일 user + order + product 리뷰 중복 방지
  const { data: existing } = await supabase
    .from('print_reviews')
    .select('id')
    .eq('user_id', user.id)
    .eq('order_id', orderId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: '이미 해당 주문의 상품에 리뷰를 작성하셨습니다.' },
      { status: 409 }
    )
  }

  // 리뷰 저장 (source=verified_purchase, status=pending)
  const { data: review, error: insertError } = await supabase
    .from('print_reviews')
    .insert({
      product_id: productId,
      order_id: orderId,
      user_id: user.id,
      reviewer_name: reviewerName,
      rating,
      title: title ?? null,
      body: reviewBody,
      source: 'verified_purchase',
      status: 'pending',
    })
    .select('id, rating, status, created_at')
    .single()

  if (insertError) {
    return NextResponse.json(
      { error: `리뷰 저장 실패: ${insertError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ review }, { status: 201 })
}
