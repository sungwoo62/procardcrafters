import { createServerClient } from '@/lib/supabase'

// 혼동하기 쉬운 문자(0/O, 1/I/l) 제외
const COUPON_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCouponCode(): string {
  let code = 'WELCOME'
  for (let i = 0; i < 6; i++) {
    code += COUPON_CHARS[Math.floor(Math.random() * COUPON_CHARS.length)]
  }
  return code
}

export type SubscribeError = 'duplicate' | 'server'

export type SubscribeResult =
  | { success: true; couponCode: string }
  | { success: false; error: SubscribeError }

export async function subscribeEmailForCoupon(email: string): Promise<SubscribeResult> {
  const supabase = createServerClient()
  const normalized = email.toLowerCase().trim()
  const couponCode = generateCouponCode()

  const { error } = await supabase.from('print_email_subscribers').insert({
    email: normalized,
    coupon_code: couponCode,
    source: 'coupon_popup',
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'duplicate' }
    }
    return { success: false, error: 'server' }
  }

  return { success: true, couponCode }
}

export async function markWelcomeSent(email: string): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('print_email_subscribers')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('email', email.toLowerCase().trim())
}
