import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { sendReviewCouponEmail } from '@/lib/email'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_reviews')
    .select(
      `*, product:print_products(id, name_en, name_ko),
       audit:print_review_admin_audit(*),
       coupon:print_review_coupons(*)`
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '리뷰를 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params

  let body: {
    action: 'approve' | 'reject' | 'hide'
    note?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  if (!['approve', 'reject', 'hide'].includes(body.action)) {
    return NextResponse.json(
      { error: "action은 'approve' | 'reject' | 'hide' 중 하나" },
      { status: 400 }
    )
  }

  if (body.action === 'reject' && !body.note?.trim()) {
    return NextResponse.json({ error: '반려 시 note(사유) 필수' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: review, error: fetchError } = await supabase
    .from('print_reviews')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !review) {
    return NextResponse.json({ error: '리뷰를 찾을 수 없습니다' }, { status: 404 })
  }

  if (review.status === 'approved' && body.action === 'approve') {
    return NextResponse.json({ error: '이미 승인된 리뷰입니다' }, { status: 409 })
  }

  const newStatus =
    body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : 'hidden'
  const oldStatus = review.status

  const { data: updated, error: updateError } = await supabase
    .from('print_reviews')
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 감사 로그
  await supabase.from('print_review_admin_audit').insert({
    review_id: id,
    admin_user_id: user.id,
    action: body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : 'hidden',
    old_status: oldStatus,
    new_status: newStatus,
    note: body.note?.trim() ?? null,
  })

  // 승인 + source='incentivized' → 쿠폰 발급 + 이메일
  if (body.action === 'approve' && review.source === 'incentivized') {
    // 기발급 쿠폰 조회 (POST에서 pending으로 사전 생성된 경우)
    const { data: existingCoupon } = await supabase
      .from('print_review_coupons')
      .select('*')
      .eq('review_id', id)
      .single()

    let couponCode: string | null = existingCoupon?.code ?? null

    // 사전 생성 쿠폰이 없으면 새로 발급
    if (!existingCoupon) {
      const code = 'REV-' + Math.random().toString(36).substring(2, 10).toUpperCase()
      const { data: newCoupon } = await supabase
        .from('print_review_coupons')
        .insert({
          review_id: id,
          code,
          amount_usd: 2.0,
          min_order_usd: 30.0,
          status: 'pending',
        })
        .select()
        .single()
      couponCode = newCoupon?.code ?? null
    } else {
      // pending → sent 상태 업데이트는 이메일 발송 성공 후 진행
    }

    // 리뷰어 이메일 조회 (user_id → auth.users, 없으면 order customer_email)
    let reviewerEmail: string | null = null
    let reviewerName: string = review.reviewer_name

    if (review.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(review.user_id)
      reviewerEmail = authUser?.user?.email ?? null
    }

    if (!reviewerEmail && review.order_id) {
      const { data: order } = await supabase
        .from('print_orders')
        .select('customer_email, customer_name')
        .eq('id', review.order_id)
        .single()
      reviewerEmail = order?.customer_email ?? null
      if (order?.customer_name) reviewerName = order.customer_name
    }

    if (couponCode && reviewerEmail) {
      await sendReviewCouponEmail({
        reviewerEmail,
        reviewerName,
        couponCode,
        amountUsd: 2.0,
        minOrderUsd: 30.0,
      })

      // 이메일 발송 완료 → coupon status를 sent로 업데이트
      await supabase
        .from('print_review_coupons')
        .update({ status: 'sent' })
        .eq('review_id', id)
    }
  }

  return NextResponse.json(updated)
}
