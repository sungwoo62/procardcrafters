/**
 * OMO-3018: 성원애드피아 발주 결제 리컨실 (하루 1~2회)
 *
 * 사장님은 하루 한두 번 성원에서 발주 결제를 진행한다. 이 크론은 그 흐름을 보조한다:
 *  - status='placed'(성원 발주됨·미결제) 발주를 모아 "오늘 결제할 목록"으로 집계
 *  - 결제 대기 건이 있으면 사장님에게 체크리스트 이메일 발송(결제 페이지 + 관리자 표시 링크)
 *  - 사장님이 성원에서 결제 후 관리자 주문상세에서 "성원 결제완료로 표시"를 누르면 paid 로 전환
 *
 * NOTE: 성원 마이룸 주문상태를 직접 스크래핑해 자동으로 paid 전환하는 것은
 * 라이브 셀렉터 확정이 필요한 후속 작업(OMO-2834 실원가 캡처와 동일 패턴). 현재는
 * 사람-확인(사장님 1클릭) 경로를 1급으로 두고, 본 크론이 일일 리마인더를 제공한다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const maxDuration = 15

interface AwaitingRow {
  id: string
  print_order_id: string
  swadpia_order_number: string | null
  checkout_url: string | null
  category_code: string
  quantity: number
  placed_at: string | null
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  // 성원 발주됨·미결제(placed) — 사장님이 결제해야 할 목록
  const { data: awaiting, error } = await supabase
    .from('print_factory_orders')
    .select('id, print_order_id, swadpia_order_number, checkout_url, category_code, quantity, placed_at')
    .eq('status', 'placed')
    .order('placed_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (awaiting ?? []) as AwaitingRow[]

  // 결제완료(paid) 누적 건수 — 리컨실 현황 참고
  const { count: paidCount } = await supabase
    .from('print_factory_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'paid')

  // 주문번호 매핑(이메일 가독성용)
  let orderNumberById: Record<string, string> = {}
  if (rows.length > 0) {
    const orderIds = Array.from(new Set(rows.map((r) => r.print_order_id)))
    const { data: orders } = await supabase
      .from('print_orders')
      .select('id, order_number')
      .in('id', orderIds)
    orderNumberById = Object.fromEntries(
      (orders ?? []).map((o: { id: string; order_number: string }) => [o.id, o.order_number]),
    )
  }

  if (rows.length > 0) {
    await sendPaymentChecklist(rows, orderNumberById)
  }

  return NextResponse.json({
    summary: {
      awaitingPayment: rows.length,
      paidTotal: paidCount ?? 0,
      action: rows.length > 0
        ? '성원에서 결제 후 관리자 주문상세에서 "성원 결제완료로 표시" 클릭'
        : '결제 대기 발주 없음',
    },
    awaiting: rows.map((r) => ({
      factoryOrderId: r.id,
      orderNumber: orderNumberById[r.print_order_id] ?? null,
      swadpiaOrderNumber: r.swadpia_order_number,
      checkoutUrl: r.checkout_url,
      categoryCode: r.category_code,
      quantity: r.quantity,
      placedAt: r.placed_at,
    })),
  })
}

async function sendPaymentChecklist(
  rows: AwaitingRow[],
  orderNumberById: Record<string, string>,
) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  if (!adminEmail || !resendKey) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const items = rows
    .map((r) => {
      const orderNo = orderNumberById[r.print_order_id] ?? r.print_order_id
      const adminLink = `${siteUrl}/admin/orders/${r.print_order_id}`
      const pay = r.checkout_url
        ? `<a href="${r.checkout_url}">성원 결제 페이지 →</a>`
        : (r.swadpia_order_number ? `성원 #${r.swadpia_order_number}` : '결제 URL 없음')
      return `
        <li style="margin-bottom:10px">
          <strong>주문 ${orderNo}</strong> · ${r.category_code} · 수량 ${r.quantity}<br/>
          ${pay} &nbsp;|&nbsp; <a href="${adminLink}">관리자에서 결제완료 표시 →</a>
        </li>`
    })
    .join('')

  const html = `
    <h2>성원 발주 결제 체크리스트 (${rows.length}건)</h2>
    <p>아래 발주는 성원에 들어갔으나 아직 결제 전입니다. 결제 후 관리자 주문상세에서
    <strong>"성원 결제완료로 표시"</strong>를 눌러 상태를 업데이트해 주세요.</p>
    <ol>${items}</ol>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      // OMO-2624: procardcrafters.com 미검증 → verified medaloffinisher.com 발신, Reply-To 원래주소
      from: 'Procardcrafters <orders@medaloffinisher.com>',
      reply_to: 'orders@procardcrafters.com',
      to: adminEmail,
      subject: `[Procardcrafters] 성원 결제 대기 ${rows.length}건 — 결제 후 상태 업데이트 필요`,
      html,
    }),
  }).catch(() => {})
}
