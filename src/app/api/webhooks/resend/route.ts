import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { logOrderEvent, type OrderEventType } from '@/lib/order-events'
import { extractWebhookHeaders, verifyResendSignature } from '@/lib/resend-webhook'

// OMO-2807: Resend 수신 웹훅 — 자동응답 이메일의 비동기 하드바운스/불만/전달 캡처.
// 포맷 검증으로 못 잡는 실제 하드바운스(예: 550 5.1.1 NoSuchUser)를 수락 후 비동기로 받아
// 해당 주문의 email_status 를 갱신하고 어드민 타임라인에 '이메일 반송' 이벤트를 남긴다.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ResendBounceInfo {
  type?: string
  subType?: string
  message?: string
}

interface ResendEventData {
  email_id?: string
  to?: string | string[]
  subject?: string
  bounce?: ResendBounceInfo
  // email.complained 등에서 사유가 들어올 수 있는 대체 필드
  reason?: string
}

interface ResendWebhookEvent {
  type?: string
  created_at?: string
  data?: ResendEventData
}

// Resend 이벤트 type → 우리 이벤트/상태 매핑
const EVENT_MAP: Record<string, { eventType: OrderEventType; status: string }> = {
  'email.bounced': { eventType: 'email_bounced', status: 'bounced' },
  'email.complained': { eventType: 'email_complained', status: 'complained' },
  'email.delivered': { eventType: 'email_delivered', status: 'delivered' },
}

function firstRecipient(to: string | string[] | undefined): string | null {
  if (!to) return null
  return Array.isArray(to) ? (to[0] ?? null) : to
}

function bounceReason(data: ResendEventData): string | null {
  const b = data.bounce
  if (b) {
    const parts = [b.type, b.subType, b.message].filter(Boolean)
    if (parts.length) return parts.join(' · ').slice(0, 500)
  }
  if (data.reason) return data.reason.slice(0, 500)
  return null
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // 시크릿 미주입 상태에서 검증 없이 처리하면 위조 위험 → 거부.
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const headers = extractWebhookHeaders(request.headers)
  const verdict = verifyResendSignature(rawBody, headers, secret, Math.floor(Date.now() / 1000))
  if (!verdict.valid) {
    return NextResponse.json({ error: 'invalid_signature', reason: verdict.reason }, { status: 400 })
  }

  let event: ResendWebhookEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const mapping = event.type ? EVENT_MAP[event.type] : undefined
  // 관심 없는 이벤트는 200 으로 흡수(Resend 재시도 방지).
  if (!mapping || !event.data) {
    return NextResponse.json({ received: true, ignored: true })
  }

  const supabase = createServerClient()
  const emailId = event.data.email_id ?? null
  const recipient = firstRecipient(event.data.to)

  // 1) Resend email_id 로 자동응답 발송 주문 역조회(가장 정확).
  // 2) 실패 시 수신자 이메일 + 최신순 폴백.
  let order: { id: string; email_status: string | null } | null = null

  if (emailId) {
    const { data } = await supabase
      .from('print_orders')
      .select('id, email_status')
      .eq('auto_response_email_id', emailId)
      .maybeSingle()
    if (data) order = data
  }

  if (!order && recipient) {
    const { data } = await supabase
      .from('print_orders')
      .select('id, email_status')
      .eq('customer_email', recipient)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) order = data
  }

  // 매칭되는 주문이 없으면 200 으로 흡수(마케팅/관리자 메일 등은 추적 대상 아님).
  if (!order) {
    return NextResponse.json({ received: true, matched: false })
  }

  // delivered 이벤트가 이미 bounced/complained 인 주문 상태를 덮어쓰지 않도록 가드.
  const terminal = order.email_status === 'bounced' || order.email_status === 'complained'
  if (mapping.status === 'delivered' && terminal) {
    return NextResponse.json({ received: true, matched: true, skipped: 'terminal_status' })
  }

  const reason = bounceReason(event.data)

  // 자동응답 발송 성공/실패 가시화: 바운스 시 email_status='bounced' 로 갱신.
  // (OMO-2799 의 auto_response_sent=false 의도를 이 리포의 email_status 로 구체화)
  const update: Record<string, unknown> = { email_status: mapping.status }
  if (mapping.status !== 'delivered') {
    update.email_bounce_reason = reason
    update.email_bounced_at = new Date().toISOString()
  }
  await supabase.from('print_orders').update(update).eq('id', order.id)

  // 동일 (주문, 이벤트, email_id) 중복 로깅 방지(Resend 재시도 대비).
  if (emailId) {
    const { data: existing } = await supabase
      .from('print_order_events')
      .select('id')
      .eq('order_id', order.id)
      .eq('event_type', mapping.eventType)
      .eq('metadata->>resend_email_id', emailId)
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ received: true, matched: true, duplicate: true })
    }
  }

  await logOrderEvent({
    orderId: order.id,
    eventType: mapping.eventType,
    newValue: reason ?? mapping.status,
    actor: 'resend',
    metadata: {
      resend_email_id: emailId,
      recipient,
      subject: event.data.subject ?? null,
      resend_event: event.type,
    },
  })

  return NextResponse.json({ received: true, matched: true })
}
