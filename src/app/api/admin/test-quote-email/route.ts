import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import {
  sendTestQuoteEmail,
  SAMPLE_ORDER_EMAIL_DATA,
  type OrderEmailData,
} from '@/lib/email'
import { OrderStatus } from '@/types/database'

// OMO-2840: 견적/주문 회신메일을 어드민이 입력한 임의 주소로 테스트 발송.
// 고객에게 나갈 것과 100% 동일한 본문(buildOrderStatusEmail 재사용), `to`는 입력값으로만 강제.

const VALID_SAMPLE_TYPES: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]
const DEFAULT_SAMPLE_TYPE: OrderStatus = 'paid' // 대표 회신메일 = 주문 확정 안내

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 간단한 인메모리 레이트리밋 (어드민당 60초 내 5회). 프로세스 단위 — 어드민 테스트 발송 보호 목적.
const RATE_LIMIT = { windowMs: 60_000, max: 5 }
const rlBucket = new Map<string, number[]>()
function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const hits = (rlBucket.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs)
  if (hits.length >= RATE_LIMIT.max) {
    rlBucket.set(key, hits)
    return false
  }
  hits.push(now)
  rlBucket.set(key, hits)
  return true
}

interface TestEmailBody {
  orderId?: string
  quoteId?: string
  sampleType?: string
  toEmail?: string
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429 }
    )
  }

  let body: TestEmailBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const toEmail = body.toEmail?.trim() ?? ''
  if (!EMAIL_RE.test(toEmail)) {
    return NextResponse.json({ error: '유효한 수신 이메일 주소를 입력해 주세요.' }, { status: 400 })
  }

  const sampleType = (body.sampleType as OrderStatus) || DEFAULT_SAMPLE_TYPE
  if (!VALID_SAMPLE_TYPES.includes(sampleType)) {
    return NextResponse.json(
      { error: `지원하지 않는 샘플 유형입니다: ${sampleType}` },
      { status: 400 }
    )
  }

  // print-site 에는 별도 견적(quote) 테이블이 없습니다. 회신메일 = 주문상태 이메일.
  // quoteId 가 와도 주문 기반으로 처리하며, 호환을 위해 거부하지 않습니다.
  let data: OrderEmailData
  let source: 'order' | 'sample' = 'sample'

  if (body.orderId) {
    const supabase = createServerClient()
    const { data: order, error } = await supabase
      .from('print_orders')
      .select('order_number, customer_email, customer_name, total_usd, tracking_number, print_order_items(product_name_ko, quantity, unit_price_usd)')
      .eq('id', body.orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }

    const items = (order.print_order_items ?? []) as {
      product_name_ko: string
      quantity: number
      unit_price_usd: number
    }[]

    data = {
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      totalUsd: order.total_usd,
      trackingNumber: order.tracking_number ?? undefined,
      items: items.map((i) => ({
        name: i.product_name_ko,
        quantity: i.quantity,
        priceUsd: i.unit_price_usd,
      })),
    }
    source = 'order'
  } else {
    data = SAMPLE_ORDER_EMAIL_DATA
  }

  try {
    const result = await sendTestQuoteEmail({ status: sampleType, data, toEmail })
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      source,
      sampleType,
      toEmail,
      subject: result.subject,
      html: result.html, // 미리보기용
      message: result.sent
        ? `${toEmail} 주소로 테스트 메일을 발송했습니다.`
        : 'RESEND_API_KEY 미설정 환경입니다. 발송 없이 미리보기만 생성했습니다.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '발송 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
