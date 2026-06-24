import { createClient } from '@supabase/supabase-js'
import { metaFetch, getAdAccountId, MetaApiError, verifySpendCap } from './auth'
import {
  DAILY_BUDGET_MINOR,
  DAILY_CAP_WARN_PCT,
  isProcardName,
  toMinorUnits,
} from './policy'
import {
  notifyPolicyRejection,
  notifyDailyCapApproaching,
  notifyDailyCapReached,
  notifyRoasPause,
} from './notifications'

/**
 * OMO-3752: 광고계정은 뉴트라 공용(KRW). 금액 단위는 KRW 최소단위(원, offset 0)이며,
 * 모든 procard 가드는 PROCARD 네이밍으로 선별한 캠페인에만 적용한다(뉴트라 캠페인 불간섭).
 * 일일 캡 = ₩30,000(= DAILY_BUDGET_MINOR). 계정 spend_cap은 공용이라 절대 변경하지 않는다.
 */
export { DAILY_BUDGET_MINOR, DAILY_CAP_WARN_PCT } from './policy'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── 가드레일 A: 일일 예산 하드 캡 (KRW) ──────────────────────────────────

/** 캠페인 생성 시 daily_budget 강제 상한(원 단위). */
export function enforceMaxDailyBudget(requestedBudgetMinor: number): number {
  return Math.min(requestedBudgetMinor, DAILY_BUDGET_MINOR)
}

/**
 * KST cron에서 호출. 오늘 procard 지출 조회 → 일일 캡 도달 시 procard 캠페인만 PAUSE.
 * timezone: 계정(뉴트라) 기준이 아니라 procard 운영 기준 NY 자정으로 일자 구분.
 * ⚠️ 공용 계정이므로 캠페인 레벨 insights에서 PROCARD 네이밍만 합산/일시정지한다.
 */
export async function runDailyCapCheck(dryRun = false): Promise<{
  spendMinor: number
  paused: string[]
  warning: boolean
}> {
  const accountId = getAdAccountId()
  const db = getServiceClient()

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // 캠페인 레벨로 오늘 지출 조회 → procard 캠페인만 합산(뉴트라 지출 제외)
  const insightsData = await metaFetch<{
    data: Array<{ campaign_name?: string; spend: string }>
  }>(`/${accountId}/insights`, {
    params: {
      level: 'campaign',
      fields: 'campaign_name,spend',
      date_preset: 'today',
      time_increment: 1,
    },
    dryRun,
  })

  const spendMinor = dryRun
    ? 0
    : (insightsData?.data ?? [])
        .filter((r) => isProcardName(r.campaign_name))
        .reduce((sum, r) => sum + toMinorUnits(parseFloat(r.spend ?? '0')), 0)

  // DB 스냅샷 저장 (dry-run 제외) — spend_cents 컬럼은 이제 KRW 최소단위(원)를 담는다.
  if (!dryRun) {
    await db.from('pccf_ads_daily_spend').upsert(
      {
        spend_date: today,
        spend_cents: spendMinor,
        cap_cents: DAILY_BUDGET_MINOR,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'spend_date' },
    )
  }

  const warnThreshold = DAILY_BUDGET_MINOR * (DAILY_CAP_WARN_PCT / 100)
  const paused: string[] = []

  if (spendMinor >= DAILY_BUDGET_MINOR) {
    // procard 캠페인만 PAUSE (뉴트라 캠페인 보호)
    const campaigns = await metaFetch<{ data: Array<{ id: string; name?: string }> }>(
      `/${accountId}/campaigns`,
      { params: { fields: 'id,name', effective_status: '["ACTIVE"]' }, dryRun },
    )

    if (!dryRun) {
      for (const campaign of campaigns?.data ?? []) {
        if (!isProcardName(campaign.name)) continue // 뉴트라 캠페인 불간섭
        await metaFetch(`/${campaign.id}`, {
          method: 'POST',
          body: { status: 'PAUSED' },
        })
        paused.push(campaign.id)
      }
      await db
        .from('pccf_ads_daily_spend')
        .update({ capped_at: new Date().toISOString() })
        .eq('spend_date', today)
    }

    await notifyDailyCapReached({ spendMinor })
    return { spendMinor, paused, warning: false }
  }

  if (spendMinor >= warnThreshold) {
    await notifyDailyCapApproaching({ spendMinor, capMinor: DAILY_BUDGET_MINOR })
    return { spendMinor, paused, warning: true }
  }

  return { spendMinor, paused, warning: false }
}

/**
 * 계정 spend_cap "읽기 전용" 보고 (OMO-3752).
 * ⚠️ 공용(뉴트라) 계정이라 복원/변경하지 않는다. 현재 값만 반환한다.
 */
export async function reportAccountSpendCap(
  dryRun = false,
): Promise<{ spendCapMinor: number }> {
  const { spendCapMinor } = await verifySpendCap(dryRun)
  return { spendCapMinor }
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
    await db.from('pccf_ads_rejection_log').insert({
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
  dryRun = false,
): Promise<{ lockedUntil: Date }> {
  const lockedUntil = new Date()
  lockedUntil.setDate(lockedUntil.getDate() + 7)

  if (!dryRun) {
    const db = getServiceClient()
    await db.from('pccf_ads_learning_lock').upsert(
      {
        campaign_id: campaignId,
        campaign_name: campaignName,
        locked_until: lockedUntil.toISOString(),
      },
      { onConflict: 'campaign_id' },
    )
  }

  return { lockedUntil }
}

export async function isLearningLocked(campaignId: string): Promise<boolean> {
  const db = getServiceClient()
  const { data } = await db
    .from('pccf_ads_learning_lock')
    .select('locked_until, unlocked_at')
    .eq('campaign_id', campaignId)
    .single()

  if (!data || data.unlocked_at) return false
  return new Date(data.locked_until) > new Date()
}

export async function unlockCampaignIfExpired(campaignId: string): Promise<boolean> {
  const db = getServiceClient()
  const { data } = await db
    .from('pccf_ads_learning_lock')
    .select('locked_until, unlocked_at')
    .eq('campaign_id', campaignId)
    .single()

  if (!data || data.unlocked_at) return false
  if (new Date(data.locked_until) > new Date()) return false

  await db
    .from('pccf_ads_learning_lock')
    .update({ unlocked_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)

  return true
}

/** 학습락 중 mutation 시도 차단 */
export async function assertNotLearningLocked(campaignId: string): Promise<void> {
  const locked = await isLearningLocked(campaignId)
  if (locked) {
    throw new Error(
      `캠페인 ${campaignId}은 Meta 학습 기간(7일 락) 중입니다. budget 변경/타겟팅 수정 불가.`,
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
  spendMinor: number
  revenueMinor: number
  roas: number
}

export async function fetchCampaignInsights(
  campaignId: string,
  dryRun = false,
): Promise<RoasSnapshot> {
  if (dryRun) {
    return { impressions: 1000, clicks: 50, spendMinor: 10000, revenueMinor: 40000, roas: 4.0 }
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
  const spendMinor = toMinorUnits(parseFloat(row?.spend ?? '0'))
  const revenueMinor = toMinorUnits(
    (row?.action_values ?? [])
      .filter((a) => a.action_type === 'purchase')
      .reduce((sum, a) => sum + parseFloat(a.value), 0),
  )

  return {
    impressions: parseInt(row?.impressions ?? '0', 10),
    clicks: parseInt(row?.clicks ?? '0', 10),
    spendMinor,
    revenueMinor,
    roas: spendMinor === 0 ? 0 : revenueMinor / spendMinor,
  }
}

/**
 * 15분 ROAS 워처. PROCARD 네이밍 캠페인만 대상으로 한다(뉴트라 캠페인 불간섭).
 * 7일 락 해제 + ROAS ≥ 3.0 → budget +20% (절대 한도 DAILY_BUDGET_MINOR 유지)
 * ROAS < 1.0 + 3일 누적 → PAUSE + 알림
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
    if (!isProcardName(campaign.name)) continue // 뉴트라 캠페인 불간섭

    // 학습락 해제 시도
    await unlockCampaignIfExpired(campaign.id)
    const locked = await isLearningLocked(campaign.id)

    const snapshot = await fetchCampaignInsights(campaign.id, dryRun)

    // DB 스냅샷 저장 (spend_cents/revenue_cents 컬럼은 KRW 최소단위)
    if (!dryRun) {
      await db.from('pccf_ads_roas_snapshot').insert({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        impressions: snapshot.impressions,
        clicks: snapshot.clicks,
        spend_cents: snapshot.spendMinor,
        revenue_cents: snapshot.revenueMinor,
        action: 'monitor',
      })
    }

    if (locked) continue

    if (snapshot.roas >= ROAS_SCALE_THRESHOLD) {
      // +20% budget, 절대 DAILY_BUDGET_MINOR 초과 금지
      const currentBudgetMinor = parseInt(campaign.daily_budget ?? String(DAILY_BUDGET_MINOR), 10)
      const newBudgetMinor = Math.min(
        Math.round(currentBudgetMinor * ROAS_SCALE_FACTOR),
        DAILY_BUDGET_MINOR,
      )

      if (newBudgetMinor > currentBudgetMinor && !dryRun) {
        await metaFetch(`/${campaign.id}`, {
          method: 'POST',
          body: { daily_budget: newBudgetMinor },
        })
        await db
          .from('pccf_ads_roas_snapshot')
          .update({ action: 'scale_up' })
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
        .from('pccf_ads_roas_snapshot')
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
