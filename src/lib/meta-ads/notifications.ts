const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID

async function sendTelegram(message: string): Promise<void> {
  if (!BOT_TOKEN || !OWNER_CHAT_ID) return

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: OWNER_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    }),
  }).catch(() => {})
}

export async function notifyPolicyRejection(params: {
  campaignId?: string
  errorMessage: string
}): Promise<void> {
  await sendTelegram(
    [
      `🚫 *PCCF Meta Ads — 정책 거절*`,
      ``,
      `*캠페인:* ${params.campaignId ?? '미확인'}`,
      `*사유:* ${params.errorMessage}`,
      ``,
      `_수동 검토 후 재제출 필요합니다._`,
    ].join('\n')
  )
}

export async function notifyDailyCapApproaching(params: {
  spendCents: number
  capCents: number
}): Promise<void> {
  const pct = Math.round((params.spendCents / params.capCents) * 100)
  await sendTelegram(
    [
      `⚠️ *PCCF Meta Ads — 일일 캡 ${pct}% 도달*`,
      ``,
      `지출: $${(params.spendCents / 100).toFixed(2)} / $${(params.capCents / 100).toFixed(2)}`,
      ``,
      `_캠페인이 곧 일시정지됩니다._`,
    ].join('\n')
  )
}

export async function notifyDailyCapReached(params: {
  spendCents: number
}): Promise<void> {
  await sendTelegram(
    [
      `🛑 *PCCF Meta Ads — 일일 $20 캡 도달*`,
      ``,
      `총 지출: $${(params.spendCents / 100).toFixed(2)}`,
      `모든 활성 캠페인 일시정지 완료.`,
    ].join('\n')
  )
}

export async function notifyRoasPause(params: {
  campaignId: string
  roas: number
  consecutiveDays: number
}): Promise<void> {
  await sendTelegram(
    [
      `📉 *PCCF Meta Ads — ROAS 저조 자동 일시정지*`,
      ``,
      `*캠페인:* ${params.campaignId}`,
      `*ROAS:* ${params.roas.toFixed(2)} (기준: 1.0)`,
      `*연속 저조:* ${params.consecutiveDays}일`,
      ``,
      `_검토 후 재활성 또는 폐기를 결정하세요._`,
    ].join('\n')
  )
}

export async function notifyTokenExpiringSoon(daysLeft: number): Promise<void> {
  await sendTelegram(
    [
      `🔑 *PCCF Meta Ads — 토큰 만료 ${daysLeft}일 전*`,
      ``,
      `시스템 사용자 토큰을 갱신해주세요.`,
      `Meta Business Manager → 시스템 사용자 → 토큰 생성`,
    ].join('\n')
  )
}

export async function notifySpendCapChanged(params: {
  previous: number
  restored: number
}): Promise<void> {
  await sendTelegram(
    [
      `🔧 *PCCF Meta Ads — Spend Cap 변경 감지 → 자동 복원*`,
      ``,
      `변경 전: $${(params.previous / 100).toFixed(0)}`,
      `복원 후: $${(params.restored / 100).toFixed(0)}`,
    ].join('\n')
  )
}

/** dry-run 모드에서 알림 시뮬레이션 */
export async function sendDryRunTestAlert(): Promise<{ ok: boolean; dryRun: boolean }> {
  if (!BOT_TOKEN || !OWNER_CHAT_ID) {
    return { ok: false, dryRun: true }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: OWNER_CHAT_ID,
        text: '✅ *PCCF Meta Ads Dry-Run* — 가드레일 알림 테스트 성공',
        parse_mode: 'Markdown',
      }),
    })
    return { ok: res.ok, dryRun: false }
  } catch {
    return { ok: false, dryRun: false }
  }
}
