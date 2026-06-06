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
    return NextResponse.json({ error: 'Invalid request format.' }, { status: 400 })
  }

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const result = await subscribeEmailForCoupon(email)

  if (!result.success) {
    if (result.error === 'duplicate') {
      return NextResponse.json(
        { error: 'This email is already registered. Check your inbox for your existing coupon.' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 },
    )
  }

  // 환영 이메일 fire-and-forget
  void sendWelcomeCouponEmail({ email, couponCode: result.couponCode })
    .then(() => markWelcomeSent(email))
    .catch(() => {})

  return NextResponse.json({ success: true, couponCode: result.couponCode })
}
