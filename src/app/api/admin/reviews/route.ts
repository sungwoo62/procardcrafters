import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { randomBytes } from 'crypto'

// verified_purchase는 어드민 직접 생성 절대 불가 (정지선)
const ADMIN_ALLOWED_SOURCES = ['beta_tester', 'incentivized', 'imported', 'team_member'] as const
type AdminAllowedSource = (typeof ADMIN_ALLOWED_SOURCES)[number]

function generateCouponCode(): string {
  return 'REV-' + randomBytes(4).toString('hex').toUpperCase()
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 50
  const offset = (page - 1) * limit

  const supabase = createServerClient()

  let query = supabase
    .from('print_reviews')
    .select(
      `id, product_id, order_id, user_id, reviewer_name, rating, title, body,
       source, disclosure_note, admin_evidence_url, admin_note,
       created_by_admin, status, created_at, updated_at,
       product:print_products(id, name_en, name_ko)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0])
    } else if (statuses.length > 1) {
      query = query.in('status', statuses)
    }
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count, page, limit })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  let body: {
    product_id: string
    reviewer_name: string
    rating: number
    title?: string
    body_text: string
    source: string
    disclosure_note: string
    admin_evidence_url: string
    admin_note?: string
    order_id?: string
    user_id?: string
  }

  try {
    const raw = await request.json()
    body = raw
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  // 정지선: verified_purchase 수동 부여 절대 불가
  if (!ADMIN_ALLOWED_SOURCES.includes(body.source as AdminAllowedSource)) {
    return NextResponse.json(
      {
        error: `source '${body.source}'는 어드민 직접 생성 불가. 허용: ${ADMIN_ALLOWED_SOURCES.join(', ')}`,
      },
      { status: 422 }
    )
  }

  if (!body.product_id) {
    return NextResponse.json({ error: 'product_id 필수' }, { status: 400 })
  }
  if (!body.reviewer_name?.trim()) {
    return NextResponse.json({ error: 'reviewer_name 필수' }, { status: 400 })
  }
  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'rating은 1~5 사이 정수' }, { status: 400 })
  }
  if (!body.body_text?.trim()) {
    return NextResponse.json({ error: 'body_text(리뷰 본문) 필수' }, { status: 400 })
  }
  if (!body.disclosure_note?.trim()) {
    return NextResponse.json({ error: 'disclosure_note 필수 (공개 의무 고지 텍스트)' }, { status: 400 })
  }
  if (!body.admin_evidence_url?.trim()) {
    return NextResponse.json({ error: 'admin_evidence_url 필수 (증거 URL/스크린샷)' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: review, error: insertError } = await supabase
    .from('print_reviews')
    .insert({
      product_id: body.product_id,
      order_id: body.order_id ?? null,
      user_id: body.user_id ?? null,
      reviewer_name: body.reviewer_name.trim(),
      rating: body.rating,
      title: body.title?.trim() ?? null,
      body: body.body_text.trim(),
      source: body.source as AdminAllowedSource,
      disclosure_note: body.disclosure_note.trim(),
      admin_evidence_url: body.admin_evidence_url.trim(),
      admin_note: body.admin_note?.trim() ?? null,
      created_by_admin: true,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // 감사 로그
  await supabase.from('print_review_admin_audit').insert({
    review_id: review.id,
    admin_user_id: user.id,
    action: 'created',
    new_status: 'pending',
    note: `어드민 직접 입력: source=${body.source}, evidence=${body.admin_evidence_url}`,
  })

  // incentivized 소스인 경우 쿠폰 미리 준비 (pending 상태로 사전 생성)
  if (body.source === 'incentivized') {
    let code = generateCouponCode()
    // 중복 방지: 최대 3회 재시도
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error: couponError } = await supabase.from('print_review_coupons').insert({
        review_id: review.id,
        code,
        amount_usd: 2.0,
        min_order_usd: 30.0,
        status: 'pending',
      })
      if (!couponError) break
      code = generateCouponCode()
    }
  }

  return NextResponse.json(review, { status: 201 })
}
