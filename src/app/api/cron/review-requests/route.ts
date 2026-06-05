import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendReviewRequestEmail } from '@/lib/marketing-email'

// Vercel Cron: 매일 UTC 03:00 (KST 12:00)
// D+7: delivered_at이 7~8일 전인 주문 — 최초 리뷰 요청
// D+14: D+7 발송 후 7일 이상 경과 + 리뷰 미작성 + 수신 거부 없음
export const maxDuration = 60

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000

type OrderRow = {
  id: string
  order_number: string
  customer_email: string
  customer_name: string
}

type D7CandidateRow = OrderRow & { delivered_at: string }

type D14CandidateRow = OrderRow & {
  sent_at: string
  review_request_id: string
}

async function runReviewRequests(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()
  const d7Start = new Date(now.getTime() - EIGHT_DAYS_MS).toISOString()
  const d7End = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString()

  // ─── 1. 수신 거부 목록 로드 ──────────────────────────────────
  const { data: unsubRows } = await supabase
    .from('print_email_unsubscribes')
    .select('email')
  const unsubSet = new Set((unsubRows ?? []).map((u: { email: string }) => u.email))

  // ─── 2. D+7 대상: delivered_at이 7~8일 전 + d7 로그 없음 ───
  const { data: d7Raw, error: d7Err } = await supabase
    .from('print_orders')
    .select('id, order_number, customer_email, customer_name, delivered_at')
    .eq('status', 'delivered')
    .gte('delivered_at', d7Start)
    .lt('delivered_at', d7End)
    .not('customer_email', 'is', null)

  if (d7Err) {
    return NextResponse.json({ error: d7Err.message }, { status: 500 })
  }

  const d7Candidates = (d7Raw ?? []) as D7CandidateRow[]

  // 이미 d7 발송된 order_id 확인
  const d7OrderIds = d7Candidates.map((o) => o.id)
  let alreadySentD7Set = new Set<string>()
  if (d7OrderIds.length > 0) {
    const { data: existingD7 } = await supabase
      .from('print_review_request_log')
      .select('order_id')
      .eq('email_type', 'd7')
      .in('order_id', d7OrderIds)
    alreadySentD7Set = new Set((existingD7 ?? []).map((r: { order_id: string }) => r.order_id))
  }

  // ─── 3. D+14 대상: d7 발송 7일+ 경과 + 리뷰 미작성 + 미opt-out ───
  const d14Cutoff = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString()

  const { data: d14LogRaw, error: d14Err } = await supabase
    .from('print_review_request_log')
    .select('id, order_id, email, sent_at')
    .eq('email_type', 'd7')
    .lt('sent_at', d14Cutoff)

  if (d14Err) {
    return NextResponse.json({ error: d14Err.message }, { status: 500 })
  }

  const d14LogRows = (d14LogRaw ?? []) as { id: string; order_id: string; email: string; sent_at: string }[]
  const d14OrderIds = d14LogRows.map((r) => r.order_id)

  // D+14 이미 발송된 order_id 확인
  let alreadySentD14Set = new Set<string>()
  // 리뷰 이미 작성된 order_id 확인
  let reviewedOrderIds = new Set<string>()
  // D+14 주문 정보 map
  const d14OrderMap = new Map<string, OrderRow>()

  if (d14OrderIds.length > 0) {
    const [existingD14Res, reviewedRowsRes, ordersRes] = await Promise.all([
      supabase
        .from('print_review_request_log')
        .select('order_id')
        .eq('email_type', 'd14')
        .in('order_id', d14OrderIds),
      supabase
        .from('print_reviews')
        .select('order_id')
        .in('order_id', d14OrderIds)
        .not('order_id', 'is', null),
      supabase
        .from('print_orders')
        .select('id, order_number, customer_email, customer_name')
        .in('id', d14OrderIds),
    ])

    alreadySentD14Set = new Set(
      (existingD14Res.data ?? []).map((r: { order_id: string }) => r.order_id)
    )
    reviewedOrderIds = new Set(
      (reviewedRowsRes.data ?? []).map((r: { order_id: string }) => r.order_id)
    )
    for (const o of (ordersRes.data ?? []) as OrderRow[]) {
      d14OrderMap.set(o.id, o)
    }
  }

  const d14Raw = d14LogRows

  // ─── 4. D+7 발송 루프 ────────────────────────────────────────
  const d7Logs: { order_id: string; email: string; email_type: string; resend_message_id: string | null }[] = []
  let d7Sent = 0
  let d7Skipped = 0

  for (const order of d7Candidates) {
    if (alreadySentD7Set.has(order.id)) { d7Skipped++; continue }
    if (unsubSet.has(order.customer_email)) { d7Skipped++; continue }

    try {
      const { messageId } = await sendReviewRequestEmail({
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        orderNumber: order.order_number,
        emailType: 'd7',
      })
      d7Logs.push({ order_id: order.id, email: order.customer_email, email_type: 'd7', resend_message_id: messageId })
      d7Sent++
    } catch {
      d7Skipped++
    }
  }

  if (d7Logs.length > 0) {
    await supabase.from('print_review_request_log').insert(d7Logs)
  }

  // ─── 5. D+14 발송 루프 ───────────────────────────────────────
  const d14Logs: { order_id: string; email: string; email_type: string; resend_message_id: string | null }[] = []
  let d14Sent = 0
  let d14Skipped = 0

  for (const row of d14Raw) {
    const order = d14OrderMap.get(row.order_id)
    if (!order) { d14Skipped++; continue }
    if (alreadySentD14Set.has(row.order_id)) { d14Skipped++; continue }
    if (reviewedOrderIds.has(row.order_id)) { d14Skipped++; continue }
    if (unsubSet.has(order.customer_email)) { d14Skipped++; continue }

    try {
      const { messageId } = await sendReviewRequestEmail({
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        orderNumber: order.order_number,
        emailType: 'd14',
      })
      d14Logs.push({ order_id: row.order_id, email: order.customer_email, email_type: 'd14', resend_message_id: messageId })
      d14Sent++
    } catch {
      d14Skipped++
    }
  }

  if (d14Logs.length > 0) {
    await supabase.from('print_review_request_log').insert(d14Logs)
  }

  return NextResponse.json({
    ok: true,
    d7: { sent: d7Sent, skipped: d7Skipped, candidates: d7Candidates.length },
    d14: { sent: d14Sent, skipped: d14Skipped, candidates: d14Raw.length },
  })
}

export async function GET(request: NextRequest) {
  return runReviewRequests(request)
}

export async function POST(request: NextRequest) {
  return runReviewRequests(request)
}
