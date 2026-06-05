import { createHash } from 'crypto'
import { createServerClient } from '@/lib/supabase'

// ============================================================
// 임계값
// ============================================================

const CODE_1H_LOCK_THRESHOLD = 100  // 1h redemption > 100 → 코드 자동 잠금
const IP_1H_BLOCK_THRESHOLD = 20    // 1h IP attempt > 20 → IP 차단
const USER_1H_BLOCK_THRESHOLD = 5   // 1h user attempt > 5 → 유저 일시 차단

const OMO_2388_ISSUE_ID = '66b28a92-f295-483a-9eec-6a3cf64d74d2'

// ============================================================
// 타입
// ============================================================

export type AbuseCheckResult =
  | { blocked: false }
  | { blocked: true; reason: string }

// ============================================================
// 내부 헬퍼
// ============================================================

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? 'promo-circuit-breaker-salt'
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 32)
}

function oneHourAgo(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString()
}

// ============================================================
// 알림 발송
// ============================================================

interface AlertPayload {
  type: 'code_locked' | 'ip_blocked' | 'user_blocked' | 'margin_alert'
  codeId: string
  message: string
  orderId?: string
  marginUsd?: number
  context?: Record<string, unknown>
}

export async function sendPromoAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.PROMO_ALERT_WEBHOOK_URL
  const paperclipUrl = process.env.PAPERCLIP_API_URL
  const paperclipKey = process.env.PAPERCLIP_API_KEY

  const body = [
    `🚨 **Promo 자동 알림** — ${payload.message}`,
    `- type: \`${payload.type}\``,
    `- code_id: \`${payload.codeId}\``,
    payload.orderId ? `- order_id: \`${payload.orderId}\`` : null,
    payload.marginUsd !== undefined ? `- margin: $${payload.marginUsd.toFixed(2)}` : null,
    payload.context ? `- context: \`${JSON.stringify(payload.context)}\`` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const tasks: Promise<unknown>[] = []

  if (webhookUrl) {
    tasks.push(
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      }).catch(() => null),
    )
  }

  if (paperclipUrl && paperclipKey) {
    tasks.push(
      fetch(`${paperclipUrl}/api/issues/${OMO_2388_ISSUE_ID}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${paperclipKey}`,
        },
        body: JSON.stringify({ body }),
      }).catch(() => null),
    )
  }

  await Promise.allSettled(tasks)
}

// ============================================================
// 공개 API
// ============================================================

/**
 * validate 요청 전 abuse circuit 체크.
 * - IP 1h 시도 > 20 → 차단
 * - user 1h 시도 > 5 → 차단
 * - code 1h redemption > 100 → 자동 lock + 차단
 * 통과 시 attempt 이벤트를 기록하고 { blocked: false } 반환.
 */
export async function checkAbuseCircuit(
  codeId: string,
  ip: string | undefined,
  userId: string | undefined,
): Promise<AbuseCheckResult> {
  const supabase = createServerClient()
  const since = oneHourAgo()
  const ipHash = ip ? hashIp(ip) : null

  // 1. IP 차단 체크
  if (ipHash) {
    const { count: ipCount } = await supabase
      .from('print_promo_abuse_events')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('event_type', 'attempt')
      .gte('created_at', since)

    if ((ipCount ?? 0) >= IP_1H_BLOCK_THRESHOLD) {
      await supabase.from('print_promo_abuse_events').insert({
        code_id: codeId,
        ip_hash: ipHash,
        user_id: userId ?? null,
        event_type: 'ip_blocked',
      })
      return { blocked: true, reason: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
    }
  }

  // 2. 유저 차단 체크
  if (userId) {
    const { count: userCount } = await supabase
      .from('print_promo_abuse_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'attempt')
      .gte('created_at', since)

    if ((userCount ?? 0) >= USER_1H_BLOCK_THRESHOLD) {
      await supabase.from('print_promo_abuse_events').insert({
        code_id: codeId,
        ip_hash: ipHash,
        user_id: userId,
        event_type: 'user_blocked',
      })
      return {
        blocked: true,
        reason: '코드 사용 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.',
      }
    }
  }

  // 3. 코드 1h redemption > 100 → 자동 lock
  const { count: redemptionCount } = await supabase
    .from('print_promo_code_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('code_id', codeId)
    .gte('applied_at', since)

  if ((redemptionCount ?? 0) >= CODE_1H_LOCK_THRESHOLD) {
    await autoLockCode(codeId, redemptionCount ?? 0, ipHash, userId ?? null, supabase)
    return { blocked: true, reason: '사용할 수 없는 코드입니다.' }
  }

  // 4. 통과 → attempt 기록
  await supabase.from('print_promo_abuse_events').insert({
    code_id: codeId,
    ip_hash: ipHash,
    user_id: userId ?? null,
    event_type: 'attempt',
  })

  return { blocked: false }
}

/**
 * applyCode 후 1h redemption을 다시 체크해 임계 초과 시 자동 lock.
 * applyCode는 코드 사용 완료 후 호출한다.
 */
export async function checkPostRedemptionLock(codeId: string): Promise<void> {
  const supabase = createServerClient()
  const since = oneHourAgo()

  const { count } = await supabase
    .from('print_promo_code_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('code_id', codeId)
    .gte('applied_at', since)

  if ((count ?? 0) >= CODE_1H_LOCK_THRESHOLD) {
    await autoLockCode(codeId, count ?? 0, null, null, supabase)
  }
}

/**
 * margin < 0 주문 알림 발송 + abuse_events 기록.
 */
export async function alertNegativeMargin(
  codeId: string,
  orderId: string,
  marginUsd: number,
  subtotalUsd: number,
): Promise<void> {
  const supabase = createServerClient()

  await Promise.allSettled([
    supabase.from('print_promo_abuse_events').insert({
      code_id: codeId,
      ip_hash: null,
      user_id: null,
      event_type: 'margin_alert',
    }),
    sendPromoAlert({
      type: 'margin_alert',
      codeId,
      orderId,
      marginUsd,
      message: `margin 음수 주문 감지: margin=$${marginUsd.toFixed(2)}, subtotal=$${subtotalUsd.toFixed(2)}`,
      context: { subtotal_usd: subtotalUsd, margin_usd: marginUsd },
    }),
  ])
}

// ============================================================
// 내부 헬퍼 — 자동 lock
// ============================================================

async function autoLockCode(
  codeId: string,
  redemptionCount: number,
  ipHash: string | null,
  userId: string | null,
  supabase: ReturnType<typeof createServerClient>,
): Promise<void> {
  await Promise.allSettled([
    supabase.from('print_promo_codes').update({ status: 'locked' }).eq('id', codeId),
    supabase.from('print_promo_code_lock_history').insert({
      code_id: codeId,
      action: 'locked',
      reason: 'abuse_auto_lock',
      context: { redemptions_1h: redemptionCount },
    }),
    supabase.from('print_promo_abuse_events').insert({
      code_id: codeId,
      ip_hash: ipHash,
      user_id: userId,
      event_type: 'code_locked',
    }),
    sendPromoAlert({
      type: 'code_locked',
      codeId,
      message: `코드 1시간 내 ${redemptionCount}회 redemption — 자동 잠금`,
      context: { redemptions_1h: redemptionCount },
    }),
  ])
}
