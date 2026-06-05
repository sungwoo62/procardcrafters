import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { sendReviewRejectionEmail, sendReviewCouponEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

function generateCouponCode(): string {
  return 'REV-' + randomBytes(4).toString('hex').toUpperCase()
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  let body: {
    ids: string[]
    action: 'approve' | 'reject'
    note?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids 배열 필수 (최소 1개)' }, { status: 400 })
  }

  if (!['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: "action은 'approve' | 'reject'" }, { status: 400 })
  }

  if (body.action === 'reject' && !body.note?.trim()) {
    return NextResponse.json({ error: '반려 시 note(사유) 필수' }, { status: 400 })
  }

  const MAX_BULK = 100
  if (body.ids.length > MAX_BULK) {
    return NextResponse.json({ error: `최대 ${MAX_BULK}건씩 처리 가능합니다` }, { status: 400 })
  }

  const supabase = createServerClient()
  const newStatus = body.action === 'approve' ? 'approved' : 'rejected'

  const { data: reviews, error: fetchError } = await supabase
    .from('print_reviews')
    .select('id, status, source, user_id, order_id, reviewer_name')
    .in('id', body.ids)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const eligible = (reviews ?? []).filter(
    (r) => !(r.status === 'approved' && body.action === 'approve')
  )

  if (eligible.length === 0) {
    return NextResponse.json({ updated: 0, message: '변경 가능한 리뷰 없음' })
  }

  const eligibleIds = eligible.map((r) => r.id)

  const { error: updateError } = await supabase
    .from('print_reviews')
    .update({ status: newStatus })
    .in('id', eligibleIds)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 감사 로그 일괄 삽입
  const auditRows = eligibleIds.map((id) => ({
    review_id: id,
    admin_user_id: user.id,
    action: newStatus,
    new_status: newStatus,
    note: body.note?.trim() ?? null,
  }))

  await supabase.from('print_review_admin_audit').insert(auditRows)

  // 개별 사후 처리 (쿠폰/이메일) — fire-and-forget
  for (const review of eligible) {
    // 반려 → 리뷰어 사유 메일
    if (body.action === 'reject' && body.note?.trim()) {
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
      if (reviewerEmail) {
        await sendReviewRejectionEmail({
          reviewerEmail,
          reviewerName,
          reason: body.note!.trim(),
        }).catch(() => {})
      }
    }

    // 승인 + incentivized → 쿠폰 발급 + 이메일
    if (body.action === 'approve' && review.source === 'incentivized') {
      const { data: existingCoupon } = await supabase
        .from('print_review_coupons')
        .select('*')
        .eq('review_id', review.id)
        .single()

      let couponCode: string | null = existingCoupon?.code ?? null

      if (!existingCoupon) {
        let code = generateCouponCode()
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error: couponError } = await supabase.from('print_review_coupons').insert({
            review_id: review.id,
            code,
            amount_usd: 2.0,
            min_order_usd: 30.0,
            status: 'pending',
          })
          if (!couponError) { couponCode = code; break }
          code = generateCouponCode()
        }
      }

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
        }).catch(() => {})

        await supabase
          .from('print_review_coupons')
          .update({ status: 'sent' })
          .eq('review_id', review.id)
      }
    }
  }

  return NextResponse.json({ updated: eligible.length, status: newStatus })
}
