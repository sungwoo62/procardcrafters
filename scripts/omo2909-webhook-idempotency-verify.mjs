#!/usr/bin/env node
/**
 * OMO-2909: PayPal 결제-주문상태 정합성 안전망 — DB 레벨 멱등 전이 검증
 *
 * 서버 웹훅이 의존하는 핵심 불변식을 PayPal API/이메일 없이 결정적으로 검증한다:
 *   (1) paid 전이는 멱등하다 — `status != 'paid'` 가드로 두 번째 호출은 0행 업데이트
 *       (브라우저 종료 후 capture-order + 웹훅이 둘 다 도착해도 이메일/상태 중복 없음)
 *   (2) capture 실패/타임아웃 → payment_status='PENDING_REVIEW', status 는 pending 유지
 *       (운영 가시성; 추후 CAPTURE.COMPLETED 웹훅이 paid 로 정정)
 *   (3) paypal_order_id 매칭 경로(웹훅이 사용)로도 동일 멱등성 성립
 *
 * 오염 방지: 명시 표식(TEST-OMO2909-*)된 합성 주문만 생성→검증→삭제.
 *
 * 사용법: node scripts/omo2909-webhook-idempotency-verify.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TAG = `TEST-OMO2909-${Date.now()}`
let pass = 0
let fail = 0
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}

// capture-order/웹훅이 수행하는 멱등 update 의 정확한 복제.
async function idempotentMarkPaid(match) {
  let q = supabase
    .from('print_orders')
    .update({ status: 'paid', payment_status: 'COMPLETED' })
    .neq('status', 'paid')
  if (match.orderId) q = q.eq('id', match.orderId)
  if (match.paypalOrderId) q = q.eq('paypal_order_id', match.paypalOrderId)
  const { data } = await q.select('id, status').maybeSingle()
  return data // null = 전이 없음(이미 paid 거나 매칭 실패)
}

async function createPendingOrder(paypalOrderId) {
  const { data, error } = await supabase
    .from('print_orders')
    .insert({
      customer_email: 'omo2909-test@example.com',
      customer_name: TAG,
      shipping_name: TAG,
      shipping_address_line1: 'test',
      shipping_city: 'test',
      shipping_country: 'US',
      shipping_postal_code: '00000',
      subtotal_usd: 10,
      shipping_usd: 0,
      total_usd: 10,
      status: 'pending',
      payment_provider: 'paypal',
      paypal_order_id: paypalOrderId,
    })
    .select('id')
    .single()
  if (error) throw new Error(`주문 생성 실패: ${error.message}`)
  return data.id
}

async function main() {
  const createdIds = []
  try {
    // ── (1) orderId 경로 멱등성 ──────────────────────────────
    console.log('\n[1] capture-order(orderId) 경로 멱등 paid 전이')
    const ppId1 = `${TAG}-PP1`
    const id1 = await createPendingOrder(ppId1)
    createdIds.push(id1)
    const first = await idempotentMarkPaid({ orderId: id1 })
    assert(first && first.status === 'paid', '1차 호출: pending→paid 전이(1행)')
    const second = await idempotentMarkPaid({ orderId: id1 })
    assert(second === null, '2차 호출: 멱등 no-op(0행) — 중복 이메일 차단')

    // ── (2) PENDING_REVIEW 운영 가시성 ───────────────────────
    console.log('\n[2] capture 실패 → PENDING_REVIEW, status 유지')
    const ppId2 = `${TAG}-PP2`
    const id2 = await createPendingOrder(ppId2)
    createdIds.push(id2)
    await supabase
      .from('print_orders')
      .update({ payment_status: 'PENDING_REVIEW' })
      .eq('id', id2)
      .neq('status', 'paid')
    const { data: rev } = await supabase
      .from('print_orders')
      .select('status, payment_status')
      .eq('id', id2)
      .single()
    assert(rev.payment_status === 'PENDING_REVIEW', 'payment_status=PENDING_REVIEW 기록')
    assert(rev.status === 'pending', 'status 는 pending 유지(결제 미확정)')
    // 이후 웹훅이 도착하면 paid 로 정정되는지
    const fixed = await idempotentMarkPaid({ paypalOrderId: ppId2 })
    assert(fixed && fixed.status === 'paid', '웹훅 도착 시 PENDING_REVIEW→paid 정정')

    // ── (3) paypal_order_id 매칭(웹훅 경로) 멱등성 ───────────
    console.log('\n[3] 웹훅(paypal_order_id) 경로 멱등 paid 전이')
    const ppId3 = `${TAG}-PP3`
    const id3 = await createPendingOrder(ppId3)
    createdIds.push(id3)
    const w1 = await idempotentMarkPaid({ paypalOrderId: ppId3 })
    assert(w1 && w1.id === id3 && w1.status === 'paid', '웹훅 1차: paypal_order_id 매칭→paid')
    const w2 = await idempotentMarkPaid({ paypalOrderId: ppId3 })
    assert(w2 === null, '웹훅 2차(또는 capture-order 동시도착): 멱등 no-op')

    // ── (4) 매칭 실패 안전성 ─────────────────────────────────
    console.log('\n[4] 미존재 paypal_order_id — 매칭 실패 안전')
    const miss = await idempotentMarkPaid({ paypalOrderId: `${TAG}-NOEXIST` })
    assert(miss === null, '미존재 주문: no-op(에러 없음)')
  } finally {
    if (createdIds.length) {
      await supabase.from('print_orders').delete().in('id', createdIds)
      console.log(`\n🧹 합성주문 ${createdIds.length}건 정리 완료`)
    }
  }

  console.log(`\n결과: ${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
