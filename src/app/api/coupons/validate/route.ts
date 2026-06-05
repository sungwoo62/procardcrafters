import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createAuthRouteClient } from '@/lib/supabase-server'

interface ValidateRequest {
  code: string
  subtotalUsd: number
}

export async function POST(request: NextRequest) {
  let body: ValidateRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { code, subtotalUsd } = body

  if (!code || typeof subtotalUsd !== 'number') {
    return NextResponse.json({ error: 'code와 subtotalUsd가 필요합니다.' }, { status: 400 })
  }

  // 로그인 필수 — 리뷰 쿠폰은 본인 소유 확인 필수
  let userId: string
  try {
    const authClient = await createAuthRouteClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ valid: false, reason: '로그인이 필요합니다.' }, { status: 200 })
    }
    userId = user.id
  } catch {
    return NextResponse.json({ valid: false, reason: '인증 정보를 확인할 수 없습니다.' }, { status: 200 })
  }

  const supabase = createServerClient()

  // 쿠폰 조회 (service_role) — 쿠폰 코드 + 연결된 리뷰 작성자 확인
  const { data: coupon, error } = await supabase
    .from('print_review_coupons')
    .select('id, code, amount_usd, min_order_usd, status, expires_at, review_id, print_reviews!inner(user_id)')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: '쿠폰 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!coupon) {
    return NextResponse.json({ valid: false, reason: '유효하지 않은 쿠폰 코드입니다.' }, { status: 200 })
  }

  // 본인 쿠폰 확인
  const review = Array.isArray(coupon.print_reviews)
    ? coupon.print_reviews[0]
    : coupon.print_reviews as { user_id: string }
  if (review?.user_id !== userId) {
    return NextResponse.json({ valid: false, reason: '본인의 쿠폰만 사용할 수 있습니다.' }, { status: 200 })
  }

  // 상태 확인 (sent = 발급됨, 미사용)
  if (coupon.status !== 'sent') {
    const reasonMap: Record<string, string> = {
      pending: '아직 발급되지 않은 쿠폰입니다.',
      used: '이미 사용된 쿠폰입니다.',
      expired: '만료된 쿠폰입니다.',
    }
    return NextResponse.json({
      valid: false,
      reason: reasonMap[coupon.status] ?? '사용할 수 없는 쿠폰입니다.',
    }, { status: 200 })
  }

  // 만료일 확인
  if (new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: '만료된 쿠폰입니다.' }, { status: 200 })
  }

  // 최소 주문 금액 확인
  const minOrderUsd = Number(coupon.min_order_usd)
  if (subtotalUsd < minOrderUsd) {
    return NextResponse.json({
      valid: false,
      reason: `최소 주문 금액 $${minOrderUsd.toFixed(2)} 이상 시 사용 가능합니다.`,
    }, { status: 200 })
  }

  return NextResponse.json({
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    amount_usd: Number(coupon.amount_usd),
    min_order_usd: minOrderUsd,
  })
}
