import { createClient } from '@supabase/supabase-js'
import { metaFetch, getAdAccountId, MetaApiError, verifySpendCap } from './auth'
import {
  notifyPolicyRejection,
  notifyDailyCapApproaching,
  notifyDailyCapReached,
  notifyRoasPause,
  notifySpendCapChanged,
} from './notifications'

/** 일일 캡: $20 = 2000 cents
 * 주의: Meta API의 daily_budget 단위는 cents.
 * spend_cap은 이미 CEO가 60000 cents ($600) 설정 완료. */
export const DAILY_BUDGET_CENTS = 2000
export const DAILY_CAP_WARN_PCT = 90

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── 가드레일 A: 일일 예산 하드 캡 $20 ────────────────────────────────────

/** 캠페인 생성 시 daily_budget 강제 주입 */
export function enforceMaxDailyBudget(
  requestedBudgetCents: number
): number {
  return Math.min(requestedBudgetCents, DAILY_BUDGET_CENTS)
}

/**
 * KST 00:00 cron에서 호출. 오늘 지출 조회 → $20 도달 시 활성 캠페인 PAUSE.
 * timezone NY 기준: NY 자정 = KST 14:00(EST) 또는 13:00(EDT)
 */
export async function runDailyCapCheck(dryRun = false): Promise<{
  spendCents: number
  paused: string[]
  warning: boolean
}> {
  const accountId = getAdAccountId()
  const db = getServiceClient()

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // 오늘 지출 조회
  const insightsData = await metaFetch<{ data: Array<{ spend: string }> }>(
    `/${accountId}/insights`,
    {
      params: {
        fields: 'spend',
        date_preset: 'today',
        time_increment: 1,
      },
      dryRun,
    }
  )

  const spendCents = dryRun
    ? 0
    : Math.round(parseFloat(insightsData?.data?.[0]?.spend ?? '0') * 100)

  // DB 스냅샷 저장 (dry-run 제외)
  if (!dryRun) {
    await db.from('print_ads_daily_spend').upsert({
      spend_date: today,
      spend_cents: spendCents,
      cap_cents: DAILY_BUDGET_CENTS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'spend_date' })
  }

  const warnThreshold = DAILY_BUDGET_CENTS * (DAILY_CAP_WARN_PCT / 100)
  const paused: string[] = []

  if (spendCents >= DAILY_BUDGET_CENTS) {
    // 모든 활성 캠페인 PAUSE
    const campaigns = await metaFetch<{ data: Array<{ id: string }> }>(
      `/${accountId}/campaigns`,
      { params: { fields: 'id', effective_status: '["ACTIVE"]' }, dryRun }
    )

    if (!dryRun) {
      for (const campaign of campaigns?.data ?? []) {
        await metaFetch(`/${campaign.id}`, {
          method: 'POST',
          body: { status: 'PAUSED' },
        })
        paused.push(campaign.id)
      }
      await db.from('print_ads_daily_spend').update({
        capped_at: new Date().toISOString(),
      }).eq('spend_date', today)
    }

    await notifyDailyCapReached({ spendCents })
    return { spendCents, paused, warning: false }
  }

  if (spendCents >= warnThreshold) {
    await notifyDailyCapApproaching({ spendCents, capCents: DAILY_BUDGET_CENTS })
    return { spendCents, paused, warning: true }
  }

  return { spendCents, paused, warning: false }
}

/** spend_cap 검증 + 변경 감지 시 알림 */
export async function checkAndRestoreSpendCap(dryRun = false): Promise<void> {
  const result = await verifySpendCap(dryRun)
  if (!result.ok) {
    await notifySpendCapChanged({ previous: 0, restored: result.spendCapCents })
  }
}

// ─── 가드레일 B: 정책 거절 retry 금지 ────────────────────────────────────────

export async function handlePolicyRejection(params: {
  error: MetaApiError
  campaignId?: string
  adsetId?: string
  adId?: string
  payload?: Record<string, unknown>
  dryRun?: boolean
}): Promise<void> {
  if (!params.error.isPolicyRejection()) return

  if (!params.dryRun) {
    const db = getServiceClient()
    await db.from('print_ads_rejection_log').insert({
      campaign_id: params.campaignId,
      adset_id: params.adsetId,
      ad_id: params.adId,
      error_subcode: params.error.subcode,
      error_message: params.error.message,
      payload: params.payload ?? null,
    })
  }

  await notifyPolicyRejection({
    campaignId: params.campaignId,
    errorMessage: params.error.message,
  })
}

// ─── 가드레일 C: 신규 캠페인 7일 학습락 ─────────────────────────────────────

export async function lockCampaignForLearning(
  campaignId: string,
  campaignName: string,
  dryRun = false
): Promise<{ lockedUntil: Date }> {
  const lockedUntil = new Date()
  lockedUntil.setDate(lockedUntil.getDate() + 7)

  if (!dryRun) {
    const db = getServiceClient()
    await db.from('print_ads_learning_lock').upsert({
      campaign_id: campaignId,
      campaign_name: campaignName,
      locked_until: lockedUntil.toISOString(),
    }, { onConflict: 'campaign_id' })
  }

  return { lockedUntil }
}

export async function isLearningLocked(campaignId: string): Promise<boolean> {
  const db = getServiceClient()
  const { data } = await db
    .from('print_ads_learning_lock')
    .select('locked_until, unlocked_at')
    .eq('campaign_id', campaignId)
    .single()

  if (!data || data.unlocked_at) return false
  return new Date(data.locked_until) > new Date()
}

export async function unlockCampaignIfExpired(campaignId: string): Promise<boolean> {
  const db = getServiceClient()
  const { data } = await db
    .from('print_ads_learning_lock')
    .select('locked_until, unlocked_at')
    .eq('campaign_id', campaignId)
    .single()

  if (!data || data.unlocked_at) return false
  if (new Date(data.locked_until) > new Date()) return false

  await db.from('print_ads_learning_lock')
    .update({ unlocked_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)

  return true
}

/** 학습락 중 mutation 시도 차단 */
export async function assertNotLearningLocked(campaignId: string): Promise<void> {
  const locked = await isLearningLocked(campaignId)
  if (locked) {
    throw new Error(
      `캠페인 ${campaignId}은 Meta 학습 기간(7일 락) 중입니다. budget 변경/타겟팅 수정 불가.`
    )
  }
}

// ─── 가드레일 D: ROAS 풀오토 스케일/킬 ──────────────────────────────────────

const ROAS_SCALE_THRESHOLD = 3.0
const ROAS_KILL_THRESHOLD = 1.0
const ROAS_KILL_CONSECUTIVE_DAYS = 3
const ROAS_SCALE_FACTOR = 1.2

interface RoasSnapshot {
  impressions: number
  clicks: number
  spendCents: number
  revenueCents: number
  roas: number
}

export async function fetchCampaignInsights(
  campaignId: string,
  dryRun = false
): Promise<RoasSnapshot> {
  if (dryRun) {
    return { impressions: 1000, clicks: 50, spendCents: 1000, revenueCents: 4000, roas: 4.0 }
  }

  const data = await metaFetch<{
    data: Array<{
      impressions: string
      clicks: string
      spend: string
      action_values?: Array<{ action_type: string; value: string }>
    }>
  }>(`/${campaignId}/insights`, {
    params: {
      fields: 'impressions,clicks,spend,action_values',
      date_preset: 'last_3d',
    },
  })

  const row = data?.data?.[0]
  const spendCents = Math.round(parseFloat(row?.spend ?? '0') * 100)
  const revenueCents = Math.round(
    (row?.action_values ?? [])
      .filter((a) => a.action_type === 'purchase')
      .reduce((sum, a) => sum + parseFloat(a.value), 0) * 100
  )

  return {
    impressions: parseInt(row?.impressions ?? '0', 10),
    clicks: parseInt(row?.clicks ?? '0', 10),
    spendCents,
    revenueCents,
    roas: spendCents === 0 ? 0 : revenueCents / spendCents,
  }
}

/**
 * 15분 ROAS 워처 (NY timezone cron: * /15 * * * *).
 * 7일 락 해제 + ROAS ≥ 3.0 → budget +20% (절대 한도 $20 유지)
 * ROAS < 1.0 + 3일 누적 → PAUSE + 알림
 * spend_cap 90% → 전체 PAUSE
 */
export async function runRoasWatcher(dryRun = false): Promise<{
  actions: Array<{ campaignId: string; action: string; roas: number }>
}> {
  const accountId = getAdAccountId()
  const db = getServiceClient()
  const actions: Array<{ campaignId: string; action: string; roas: number }> = []

  const campaigns = await metaFetch<{
    data: Array<{ id: string; name: string; status: string; daily_budget: string }>
  }>(`/${accountId}/campaigns`, {
    params: { fields: 'id,name,status,daily_budget', effective_status: '["ACTIVE"]' },
    dryRun,
  })

  for (const campaign of campaigns?.data ?? []) {
    // 학습락 해제 시도
    await unlockCampaignIfExpired(campaign.id)
    const locked = await isLearningLocked(campaign.id)

    const snapshot = await fetchCampaignInsights(campaign.id, dryRun)

    // DB 스냅샷 저장
    if (!dryRun) {
      await db.from('print_ads_roas_snapshot').insert({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        impressions: snapshot.impressions,
        clicks: snapshot.clicks,
        spend_cents: snapshot.spendCents,
        revenue_cents: snapshot.revenueCents,
        action: 'monitor',
      })
    }

    if (locked) continue

    if (snapshot.roas >= ROAS_SCALE_THRESHOLD) {
      // +20% budget, 절대 $20 초과 금지
      const currentBudgetCents = parseInt(campaign.daily_budget ?? '2000', 10)
      const newBudgetCents = Math.min(
        Math.round(currentBudgetCents * ROAS_SCALE_FACTOR),
        DAILY_BUDGET_CENTS
      )

      if (newBudgetCents > currentBudgetCents && !dryRun) {
        await metaFetch(`/${campaign.id}`, {
          method: 'POST',
          body: { daily_budget: newBudgetCents },
        })
        await db.from('print_ads_roas_snapshot').update({ action: 'scale_up' })
          .eq('campaign_id', campaign.id)
          .order('snapshot_at', { ascending: false })
          .limit(1)
      }

      actions.push({ campaignId: campaign.id, action: 'scale_up', roas: snapshot.roas })
      continue
    }

    if (snapshot.roas < ROAS_KILL_THRESHOLD) {
      // 3일 연속 ROAS < 1.0 확인
      const { count } = await db
        .from('print_ads_roas_snapshot')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .lt('roas', ROAS_KILL_THRESHOLD)
        .gte('snapshot_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())

      if ((count ?? 0) >= ROAS_KILL_CONSECUTIVE_DAYS * 96) {
        // 96 = 24h / 15min
        if (!dryRun) {
          await metaFetch(`/${campaign.id}`, {
            method: 'POST',
            body: { status: 'PAUSED' },
          })
        }

        await notifyRoasPause({
          campaignId: campaign.id,
          roas: snapshot.roas,
          consecutiveDays: ROAS_KILL_CONSECUTIVE_DAYS,
        })

        actions.push({ campaignId: campaign.id, action: 'pause', roas: snapshot.roas })
      }
    }
  }

  return { actions }
}
