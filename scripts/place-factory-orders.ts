/**
 * 성원애드피아 공장 발주 처리 스크립트
 *
 * print_factory_orders 테이블에서 pending 항목을 가져와 Playwright로 자동 발주.
 * Vercel serverless 환경에서 실행 불가 — 로컬 또는 VPS에서 실행.
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/place-factory-orders.ts
 *
 * 크론 예시 (crontab):
 *   0 9,14,17 * * 1-5  cd /path/to/project && node --experimental-strip-types --env-file=.env.local scripts/place-factory-orders.ts
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SWADPIA_USERNAME, SWADPIA_PASSWORD
 *   ADMIN_NOTIFICATION_EMAIL (실패 알림)
 */

import { createClient } from '@supabase/supabase-js'
import { placeSwadpiaOrder, type FactoryOrderRecord } from '../src/lib/swadpia-order'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MAX_ATTEMPTS = 3

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write('오류: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 없음\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  process.stdout.write(`[${new Date().toISOString()}] 공장 발주 스크립트 시작\n`)

  // pending 항목 조회 (attempts 초과 제외)
  const { data: pendingOrders, error } = await supabase
    .from('print_factory_orders')
    .select('*')
    .eq('status', 'pending')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(10)

  if (error) {
    process.stderr.write(`DB 조회 실패: ${error.message}\n`)
    process.exit(1)
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    process.stdout.write('처리할 발주 없음.\n')
    return
  }

  process.stdout.write(`처리할 발주 ${pendingOrders.length}건\n`)

  for (const record of pendingOrders as FactoryOrderRecord[]) {
    await processFactoryOrder(record)
  }

  process.stdout.write(`[${new Date().toISOString()}] 완료\n`)
}

async function processFactoryOrder(record: FactoryOrderRecord) {
  process.stdout.write(`\n발주 처리: ${record.id} (주문 ${record.print_order_id})\n`)

  // 'placing' 으로 잠금 (중복 실행 방지)
  const { error: lockError } = await supabase
    .from('print_factory_orders')
    .update({
      status: 'placing',
      attempt_count: record.attempt_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.id)
    .eq('status', 'pending')  // 이미 다른 프로세스가 가져갔으면 skip

  if (lockError) {
    process.stderr.write(`  잠금 실패 (이미 처리 중): ${lockError.message}\n`)
    return
  }

  // 파일 URL 결정
  const fileUrl = await resolveFileUrl(record)
  if (!fileUrl) {
    await markFailed(record.id, '인쇄 파일 URL을 찾을 수 없음')
    return
  }

  // 작업메모(주문명) 생성: 성원 측에서 우리 주문번호로 식별 가능하도록
  const orderTitle = await buildOrderTitle(record)

  // Playwright 발주 실행
  process.stdout.write(`  Playwright 발주 시작: ${record.category_code} / ${orderTitle}\n`)
  const result = await placeSwadpiaOrder({
    productSlugOrCategoryCode: record.category_code,
    selectedOptions: record.options_snapshot,
    quantity: record.quantity,
    fileUrl,
    orderTitle,
  })

  if (result.success) {
    const { error: updateError } = await supabase
      .from('print_factory_orders')
      .update({
        status: 'placed',
        swadpia_order_number: result.swadpiaOrderNumber ?? null,
        checkout_url: result.checkoutUrl ?? null,
        placed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)

    if (updateError) {
      process.stderr.write(`  DB 업데이트 실패: ${updateError.message}\n`)
    } else {
      process.stdout.write(
        `  발주 완료: ${result.checkoutUrl ? `결제 대기 URL: ${result.checkoutUrl}` : `주문번호: ${result.swadpiaOrderNumber ?? '(파싱 불가)'}`}\n`
      )
    }

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

  } else {
    const isFinal = (record.attempt_count + 1) >= MAX_ATTEMPTS
    await markFailed(record.id, result.errorMessage ?? '알 수 없는 오류', isFinal)

    if (isFinal) {
      process.stderr.write(`  최대 재시도 초과 — 관리자 알림 발송\n`)
      await notifyAdminFailure(record, result.errorMessage)
    } else {
      // 다음 시도를 위해 pending으로 복원
      await supabase
        .from('print_factory_orders')
        .update({
          status: 'pending',
          last_error: result.errorMessage ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id)

      process.stdout.write(`  재시도 예약 (${record.attempt_count + 1}/${MAX_ATTEMPTS}회 시도됨)\n`)
    }
  }
}

/**
 * 성원애드피아 주문명(=공장 작업메모) 생성.
 * 형식: {PCCF-주문번호} {수량}매
 * 예시: PCCF-20260604-ABC123 500매
 *
 * 성원 측 작업자가 우리 주문번호로 즉시 식별 가능하도록 구성한다.
 * orderTitle을 비우면 swadpia-order.ts가 임시 파일명(`print_file_<timestamp>.pdf`)을
 * 그대로 넘기므로 절대 빈 값으로 두면 안 된다.
 */
async function buildOrderTitle(record: FactoryOrderRecord): Promise<string> {
  const { data: order } = await supabase
    .from('print_orders')
    .select('order_number')
    .eq('id', record.print_order_id)
    .single()

  const orderNumber = order?.order_number ?? record.print_order_id.slice(0, 8)
  return `${orderNumber} ${record.quantity}매`
}

async function resolveFileUrl(record: FactoryOrderRecord): Promise<string | null> {
  if (record.file_url) return record.file_url

  // print_order_item의 첫 번째 파일 URL 조회
  if (record.print_order_item_id) {
    const { data: files } = await supabase
      .from('print_files')
      .select('storage_path')
      .eq('order_item_id', record.print_order_item_id)
      .in('status', ['approved', 'uploaded'])
      .limit(1)

    if (files && files.length > 0) {
      const { data: signed } = await supabase
        .storage
        .from('print-files')
        .createSignedUrl(files[0].storage_path, 3600)
      return signed?.signedUrl ?? null
    }
  }

  // 주문 전체에서 파일 조회
  const { data: files } = await supabase
    .from('print_files')
    .select('storage_path')
    .eq('order_id', record.print_order_id)
    .in('status', ['approved', 'uploaded'])
    .limit(1)

  if (files && files.length > 0) {
    const { data: signed } = await supabase
      .storage
      .from('print-files')
      .createSignedUrl(files[0].storage_path, 3600)
    return signed?.signedUrl ?? null
  }

  return null
}

async function markFailed(recordId: string, errorMessage: string, isFinal = true) {
  await supabase
    .from('print_factory_orders')
    .update({
      status: isFinal ? 'failed' : 'pending',
      last_error: errorMessage,
      failed_at: isFinal ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
  process.stderr.write(`  발주 실패: ${errorMessage}\n`)
}

async function notifyAdminFailure(record: FactoryOrderRecord, errorMessage?: string) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  if (!adminEmail || !resendKey) return

  // 주문 정보 조회
  const { data: order } = await supabase
    .from('print_orders')
    .select('order_number, customer_name, customer_email')
    .eq('id', record.print_order_id)
    .single()

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
  })
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'Procardcrafters <orders@procardcrafters.com>',
      to: order.customer_email,
      subject: `[Procardcrafters] Your Order Is Being Printed — #${order.order_number}`,
      html,
    }),
  }).catch(() => {})
}

main().catch((err) => {
  process.stderr.write(`치명적 오류: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
