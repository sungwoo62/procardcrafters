/**
 * 공장 발주 처리기 (OMO-2716 — 무인 결선)
 *
 * print_factory_orders 의 pending 레코드 1건을 Playwright 로 발주하는 핵심 로직.
 * 배치 스크립트(scripts/place-factory-orders.ts)와 무인 게이트웨이
 * (scripts/automation-hub/factory-runner.ts)가 공유한다 — 로직 분기(drift) 방지.
 *
 * 실패 시: 재시도 예약(pending 복원) → 최종 실패 시 status='failed' +
 *          관리자 이메일 + 사장님 텔레그램 알림.
 *
 * Playwright 실행이 필요하므로 Vercel serverless 가 아닌 맥스튜디오/VPS 에서만 동작.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { placeSwadpiaOrder, type FactoryOrderRecord } from './swadpia-order'

export const MAX_ATTEMPTS = 3

export interface ProcessResult {
  recordId: string
  printOrderId: string
  outcome: 'placed' | 'retry' | 'failed' | 'skipped'
  swadpiaOrderNumber?: string | null
  checkoutUrl?: string | null
  dryRun?: boolean
  error?: string
}

type Logger = (msg: string) => void
const noopLog: Logger = () => {}

/**
 * pending 발주 레코드들을 처리한다.
 * printOrderId 가 주어지면 해당 주문만, 없으면 전체 pending 을 대상으로 한다.
 */
export async function processPendingFactoryOrders(
  supabase: SupabaseClient,
  opts: { printOrderId?: string; limit?: number; log?: Logger } = {},
): Promise<ProcessResult[]> {
  const log = opts.log ?? noopLog
  const limit = opts.limit ?? 10

  let query = supabase
    .from('print_factory_orders')
    .select('*')
    .eq('status', 'pending')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(limit)

  if (opts.printOrderId) query = query.eq('print_order_id', opts.printOrderId)

  const { data: pendingOrders, error } = await query
  if (error) throw new Error(`DB 조회 실패: ${error.message}`)

  if (!pendingOrders || pendingOrders.length === 0) {
    log('처리할 발주 없음.')
    return []
  }

  log(`처리할 발주 ${pendingOrders.length}건`)
  const results: ProcessResult[] = []
  for (const record of pendingOrders as FactoryOrderRecord[]) {
    results.push(await processFactoryOrderRecord(supabase, record, log))
  }
  return results
}

/**
 * 단일 발주 레코드 처리 — 잠금 → 파일 URL 해석 → Playwright 발주 → 결과 기록.
 */
export async function processFactoryOrderRecord(
  supabase: SupabaseClient,
  record: FactoryOrderRecord,
  log: Logger = noopLog,
): Promise<ProcessResult> {
  log(`\n발주 처리: ${record.id} (주문 ${record.print_order_id})`)

  // 'placing' 으로 잠금 (중복 실행 방지)
  const { error: lockError, data: locked } = await supabase
    .from('print_factory_orders')
    .update({
      status: 'placing',
      attempt_count: record.attempt_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.id)
    .eq('status', 'pending') // 이미 다른 프로세스가 가져갔으면 skip
    .select('id')

  if (lockError || !locked || locked.length === 0) {
    log(`  잠금 실패 (이미 처리 중): ${lockError?.message ?? 'no row'}`)
    return { recordId: record.id, printOrderId: record.print_order_id, outcome: 'skipped' }
  }

  const fileUrl = await resolveFileUrl(supabase, record)
  if (!fileUrl) {
    await markFailed(supabase, record.id, '인쇄 파일 URL을 찾을 수 없음')
    return { recordId: record.id, printOrderId: record.print_order_id, outcome: 'failed', error: '인쇄 파일 URL을 찾을 수 없음' }
  }

  const orderTitle = await buildOrderTitle(supabase, record)

  log(`  Playwright 발주 시작: ${record.category_code} / ${orderTitle}`)
  const result = await placeSwadpiaOrder({
    productSlugOrCategoryCode: record.category_code,
    selectedOptions: record.options_snapshot,
    quantity: record.quantity,
    fileUrl,
    orderTitle,
  })

  if (result.success) {
    // DRY RUN: 결제 직전까지만 도달한 검증 실행. DB 상태를 placed 로 바꾸지 않는다.
    if (result.dryRun) {
      await supabase
        .from('print_factory_orders')
        .update({
          status: 'pending',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id)
      log(`  [DRY RUN] 결제서 도달 확인 — 미결제, pending 복원: ${result.checkoutUrl ?? ''}`)
      return {
        recordId: record.id,
        printOrderId: record.print_order_id,
        outcome: 'skipped',
        dryRun: true,
        checkoutUrl: result.checkoutUrl ?? null,
      }
    }

    await supabase
      .from('print_factory_orders')
      .update({
        status: 'placed',
        swadpia_order_number: result.swadpiaOrderNumber ?? null,
        checkout_url: result.checkoutUrl ?? null,
        placed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)

    log(
      `  발주 완료: ${result.checkoutUrl ? `결제 대기 URL: ${result.checkoutUrl}` : `주문번호: ${result.swadpiaOrderNumber ?? '(파싱 불가)'}`}`,
    )

    // 주문 상태를 'processing'으로 전환 + 고객 이메일 + 이벤트 로그
    const { data: updatedOrder } = await supabase
      .from('print_orders')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', record.print_order_id)
      .eq('status', 'paid')
      .select('order_number, customer_email, customer_name, total_usd')
      .single()

    if (updatedOrder) {
      await Promise.allSettled([
        sendProcessingEmail(updatedOrder),
        supabase.from('print_order_events').insert({
          order_id: record.print_order_id,
          event_type: 'status_change',
          old_value: 'paid',
          new_value: 'processing',
          metadata: {
            swadpia_order_number: result.swadpiaOrderNumber ?? null,
            factory_order_id: record.id,
          },
          actor: 'system',
        }),
      ])
    }

    return {
      recordId: record.id,
      printOrderId: record.print_order_id,
      outcome: 'placed',
      swadpiaOrderNumber: result.swadpiaOrderNumber ?? null,
      checkoutUrl: result.checkoutUrl ?? null,
    }
  }

  // 실패 경로
  const isFinal = record.attempt_count + 1 >= MAX_ATTEMPTS
  if (isFinal) {
    await markFailed(supabase, record.id, result.errorMessage ?? '알 수 없는 오류', true)
    log('  최대 재시도 초과 — 관리자/사장님 알림 발송')
    await notifyFailure(supabase, record, result.errorMessage)
    return {
      recordId: record.id,
      printOrderId: record.print_order_id,
      outcome: 'failed',
      error: result.errorMessage ?? '알 수 없는 오류',
    }
  }

  // 다음 시도를 위해 pending 으로 복원
  await supabase
    .from('print_factory_orders')
    .update({
      status: 'pending',
      last_error: result.errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.id)
  log(`  재시도 예약 (${record.attempt_count + 1}/${MAX_ATTEMPTS}회 시도됨)`)
  return {
    recordId: record.id,
    printOrderId: record.print_order_id,
    outcome: 'retry',
    error: result.errorMessage ?? undefined,
  }
}

// ─── helpers (place-factory-orders.ts 에서 추출) ──────────────────

/**
 * 성원애드피아 주문명(=공장 작업메모) 생성: {주문번호} {수량}매
 */
async function buildOrderTitle(supabase: SupabaseClient, record: FactoryOrderRecord): Promise<string> {
  const { data: order } = await supabase
    .from('print_orders')
    .select('order_number')
    .eq('id', record.print_order_id)
    .single()

  const orderNumber = order?.order_number ?? record.print_order_id.slice(0, 8)
  return `${orderNumber} ${record.quantity}매`
}

async function resolveFileUrl(supabase: SupabaseClient, record: FactoryOrderRecord): Promise<string | null> {
  if (record.file_url) return record.file_url

  if (record.print_order_item_id) {
    const { data: files } = await supabase
      .from('print_files')
      .select('storage_path')
      .eq('order_item_id', record.print_order_item_id)
      .in('status', ['approved', 'uploaded'])
      .limit(1)

    if (files && files.length > 0) {
      // 버킷은 'print-assets' (업로드: api/files/upload/route.ts).
      // storage_path 는 'print-files/<...>' 형태로 print-assets 내부 폴더 키를 그대로 담는다(이중 prefix 아님).
      const { data: signed } = await supabase.storage
        .from('print-assets')
        .createSignedUrl(files[0].storage_path, 3600)
      return signed?.signedUrl ?? null
    }
  }

  const { data: files } = await supabase
    .from('print_files')
    .select('storage_path')
    .eq('order_id', record.print_order_id)
    .in('status', ['approved', 'uploaded'])
    .limit(1)

  if (files && files.length > 0) {
    // 버킷은 'print-assets' (위 print_order_item_id 경로와 동일 계약).
    const { data: signed } = await supabase.storage
      .from('print-assets')
      .createSignedUrl(files[0].storage_path, 3600)
    return signed?.signedUrl ?? null
  }

  return null
}

async function markFailed(supabase: SupabaseClient, recordId: string, errorMessage: string, isFinal = true) {
  await supabase
    .from('print_factory_orders')
    .update({
      status: isFinal ? 'failed' : 'pending',
      last_error: errorMessage,
      failed_at: isFinal ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
}

/** 최종 실패 알림 — 관리자 이메일 + 사장님 텔레그램(공장 소통 채널). */
async function notifyFailure(supabase: SupabaseClient, record: FactoryOrderRecord, errorMessage?: string) {
  const { data: order } = await supabase
    .from('print_orders')
    .select('order_number, customer_name, customer_email')
    .eq('id', record.print_order_id)
    .single()

  await Promise.allSettled([
    notifyAdminFailureEmail(record, order, errorMessage),
    notifyOwnerTelegram(
      `🚨 *공장 자동발주 실패*\n` +
        `주문: ${order?.order_number ?? record.print_order_id}\n` +
        `카테고리: ${record.category_code} / 수량: ${record.quantity}매\n` +
        `시도: ${record.attempt_count + 1}/${MAX_ATTEMPTS}회\n` +
        `오류: ${errorMessage ?? '알 수 없음'}\n` +
        `→ 수동 발주 필요. 관리자: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin/orders/${record.print_order_id}`,
    ),
  ])
}

async function notifyAdminFailureEmail(
  record: FactoryOrderRecord,
  order: { order_number?: string; customer_name?: string; customer_email?: string } | null,
  errorMessage?: string,
) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  if (!adminEmail || !resendKey) return

  const subject = `[발주 실패] ${order?.order_number ?? record.print_order_id}`
  const html = `
    <h2>성원애드피아 자동 발주 실패</h2>
    <p><strong>주문번호:</strong> ${order?.order_number ?? '-'}</p>
    <p><strong>고객:</strong> ${order?.customer_name ?? '-'} (${order?.customer_email ?? '-'})</p>
    <p><strong>카테고리:</strong> ${record.category_code}</p>
    <p><strong>오류:</strong> ${errorMessage ?? '알 수 없음'}</p>
    <p><strong>시도 횟수:</strong> ${record.attempt_count + 1}회</p>
    <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin/orders/${record.print_order_id}">관리자 페이지에서 확인</a></p>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Procardcrafters <orders@procardcrafters.com>',
      to: adminEmail,
      subject,
      html,
    }),
  }).catch(() => {})
}

/**
 * 사장님 텔레그램 알림. TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID 미설정 시 no-op.
 * (allpack-ops 무인 허브와 동일 봇/채팅 사용 — 공장 소통 채널 일원화)
 */
export async function notifyOwnerTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch(() => {})
}

async function sendProcessingEmail(order: {
  order_number: string
  customer_email: string
  customer_name: string
  total_usd: number
}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <p>Hi ${order.customer_name},</p>
      <p>Your order <strong>#${order.order_number}</strong> is now being printed. We'll notify you as soon as it ships.</p>
      <p>Typical production time: 3-5 business days.</p>
      <p>— Procardcrafters Team</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5"/>
      <p style="color:#888;font-size:12px">Procardcrafters · Premium Print Services<br/>${siteUrl}</p>
    </div>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Procardcrafters <orders@procardcrafters.com>',
      to: order.customer_email,
      subject: `[Procardcrafters] Your Order Is Being Printed — #${order.order_number}`,
      html,
    }),
  }).catch(() => {})
}
