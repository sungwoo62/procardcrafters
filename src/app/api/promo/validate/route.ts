import { NextRequest, NextResponse } from 'next/server'
import { validateCode } from '@/lib/promotion-engine'
import { createAuthRouteClient } from '@/lib/supabase-server'

interface ValidateRequest {
  code: string
  cart: {
    totalCents: number
    productSlugs?: string[]
  }
}

export async function POST(request: NextRequest) {
  let body: ValidateRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { code, cart } = body

  if (!code || typeof cart?.totalCents !== 'number') {
    return NextResponse.json({ error: 'code와 cart.totalCents가 필요합니다.' }, { status: 400 })
  }

  // 로그인 사용자라면 userId 포함
  let userId: string | undefined
  try {
    const supabase = await createAuthRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  } catch {
    // 비로그인 사용자는 per_user_max 체크 생략
  }

  try {
    const result = await validateCode(code, {
      userId,
      totalCents: cart.totalCents,
      productSlugs: cart.productSlugs,
    })

    if (!result.valid) {
      return NextResponse.json({ valid: false, reason: result.reason }, { status: 200 })
    }

    return NextResponse.json({
      valid: true,
      discountAmount: result.discountAmount,
      effectivePct: result.effectivePct,
      code: {
        id: result.code!.id,
        code: result.code!.code,
        discount_pct: result.code!.discount_pct,
        discount_tier: result.code!.discount_tier,
      },
    })
  } catch (err) {
    console.error('[promo/validate] 오류:', err)
    return NextResponse.json({ error: '코드 검증 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
