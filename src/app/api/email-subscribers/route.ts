import { NextRequest, NextResponse } from 'next/server'
import { subscribeEmailForCoupon, markWelcomeSent } from '@/lib/email-subscriber'
import { sendWelcomeCouponEmail } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  let email: string
  try {
    const body = await request.json()
    email = typeof body?.email === 'string' ? body.email.trim() : ''
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다.' }, { status: 400 })
  }

  const result = await subscribeEmailForCoupon(email)

  if (!result.success) {
    if (result.error === 'duplicate') {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다. 기존 쿠폰을 이메일에서 확인해주세요.' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }

  // 환영 이메일 fire-and-forget
  void sendWelcomeCouponEmail({ email, couponCode: result.couponCode })
    .then(() => markWelcomeSent(email))
    .catch(() => {})

  return NextResponse.json({ success: true, couponCode: result.couponCode })
}
