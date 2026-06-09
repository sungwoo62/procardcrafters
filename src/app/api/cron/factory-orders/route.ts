import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const maxDuration = 10

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { data: pending, error } = await supabase
    .from('print_factory_orders')
    .select('id, print_order_id, category_code, quantity, status, attempt_count, queued_at, last_error')
    .in('status', ['pending', 'placing'])
    .order('queued_at', { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count: totalPending } = await supabase
    .from('print_factory_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: totalFailed } = await supabase
    .from('print_factory_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')

  const pendingCount = totalPending ?? 0
  const failedCount = totalFailed ?? 0

  if (pendingCount > 0 || failedCount > 0) {
    await sendFactoryOrderAlert(pendingCount, failedCount)
  }

  return NextResponse.json({
    summary: {
      pending: pendingCount,
      failed: failedCount,
      action: pendingCount > 0
        ? '맥스튜디오 factory-runner가 큐 드레인으로 자동 처리 (OMO-2716). 이 크론은 적체 알림 폴백.'
        : '처리할 발주 없음',
    },
    orders: pending ?? [],
  })
}

async function sendFactoryOrderAlert(pending: number, failed: number) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  if (!adminEmail || !resendKey) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const subject = pending > 0
    ? `[Procardcrafters] 공장 발주 ${pending}건 대기 중`
    : `[Procardcrafters] 공장 발주 실패 ${failed}건`

  const html = `
    <h2>공장 발주 상태 알림</h2>
    <p><strong>대기 중:</strong> ${pending}건</p>
    <p><strong>실패:</strong> ${failed}건</p>
    ${pending > 0 ? '<p>맥스튜디오 factory-runner가 큐 드레인으로 자동 처리합니다 (무인). 본 메일은 적체 가시성 폴백입니다.</p>' : ''}
    ${failed > 0 ? `<p>실패 건은 <a href="${siteUrl}/admin/orders">관리자 페이지</a>에서 확인하세요.</p>` : ''}
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'Procardcrafters <orders@procardcrafters.com>',
      to: adminEmail,
      subject,
      html,
    }),
  }).catch(() => {})
}
