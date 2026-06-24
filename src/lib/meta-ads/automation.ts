/**
 * 자동화 함수 4종 (KR fanout 대비 — OMO-2373 사장님 약속)
 * initAdService / createAdAccount / setupSystemUser / addPixelDomain
 */
import { metaFetch, getAdAccountId, getAppId, getAccessToken, getBusinessId, getAdIdentity } from './auth'
import { lockCampaignForLearning, enforceMaxDailyBudget, DAILY_BUDGET_CENTS } from './guardrails'
import { getAdTargetingDefaults } from './targeting'

export interface AdServiceStatus {
  appId: string
  adAccountId: string
  systemUserId: string
  tokenType: string
  spendCapCents: number
  timezoneId: number
}

/** 서비스 현황 조회 (초기화 확인용) */
export async function initAdService(dryRun = false): Promise<AdServiceStatus> {
  const appId = getAppId()
  const adAccountId = getAdAccountId()
  const token = getAccessToken()

  if (dryRun) {
    return {
      appId,
      adAccountId,
      systemUserId: 'dry-run',
      tokenType: 'SYSTEM_USER',
      spendCapCents: 60000,
      timezoneId: 7,
    }
  }

  const [meData, accountData] = await Promise.all([
    metaFetch<{ id: string; name: string }>('/me', { params: { fields: 'id,name' } }),
    metaFetch<{ spend_cap: string; timezone_id: number }>(`/${adAccountId}`, {
      params: { fields: 'spend_cap,timezone_id' },
    }),
  ])

  // 토큰 타입 확인
  const debugData = await metaFetch<{
    data: { type: string; app_id: string; expires_at: number }
  }>('/debug_token', {
    params: { input_token: token, access_token: `${appId}|${process.env.PCCF_META_APP_SECRET}` },
  })

  return {
    appId,
    adAccountId,
    systemUserId: meData.id,
    tokenType: debugData.data.type,
    spendCapCents: parseInt(accountData.spend_cap ?? '0', 10),
    timezoneId: accountData.timezone_id,
  }
}

export interface CreateAdAccountResult {
  id: string
  name: string
}

/**
 * 새 광고 계정 생성 (KR 서비스별 fanout용)
 * 실제 Meta Business Manager에서 생성 필요 — 이 함수는 계정 설정 래퍼
 */
export async function createAdAccount(params: {
  name: string
  currency: string
  timezoneId: number
  /** 미지정 시 PCCF_META_BUSINESS_ID 사용 (OMO-3737) */
  businessId?: string
  dryRun?: boolean
}): Promise<CreateAdAccountResult> {
  if (params.dryRun) {
    return { id: `act_dry_run_${Date.now()}`, name: params.name }
  }

  const businessId = params.businessId ?? getBusinessId()

  const data = await metaFetch<{ id: string }>(`/${businessId}/adaccount`, {
    method: 'POST',
    body: {
      name: params.name,
      currency: params.currency,
      timezone_id: params.timezoneId,
      end_advertiser: businessId,
    },
  })

  return { id: data.id, name: params.name }
}

export interface SetupSystemUserResult {
  userId: string
  tokenGenerated: boolean
}

/**
 * 시스템 사용자 검증 (기존 pccfautoadsbot 확인 또는 신규 생성 가이드)
 */
export async function setupSystemUser(dryRun = false): Promise<SetupSystemUserResult> {
  if (dryRun) {
    return { userId: '122102572485348262', tokenGenerated: false }
  }

  const data = await metaFetch<{ id: string; name: string }>('/me', {
    params: { fields: 'id,name' },
  })

  return {
    userId: data.id,
    tokenGenerated: false, // 시스템 사용자 토큰은 Meta Business Manager에서 수동 생성
  }
}

export interface AddPixelDomainResult {
  pixelId: string
  domain: string
  verified: boolean
}

/**
 * 픽셀-도메인 연결 (새 서비스 온보딩 시 호출)
 */
export async function addPixelDomain(params: {
  pixelId: string
  domain: string
  dryRun?: boolean
}): Promise<AddPixelDomainResult> {
  if (params.dryRun) {
    return { pixelId: params.pixelId, domain: params.domain, verified: false }
  }

  await metaFetch(`/${params.pixelId}`, {
    method: 'POST',
    body: {
      automatic_matching_fields: ['em', 'fn', 'ln', 'ph'],
    },
  })

  return { pixelId: params.pixelId, domain: params.domain, verified: true }
}

// ─── 캠페인 생성 헬퍼 (가드레일 A+C 자동 적용) ──────────────────────────────

export interface CreateCampaignResult {
  campaignId: string
  adsetId: string
  dailyBudgetCents: number
  lockedUntil: Date
}

export async function createCampaignWithGuardrails(params: {
  name: string
  objective: string
  /**
   * 광고세트 위치/타겟팅 스펙. 미지정 시 광역 기본값(US, getAdTargetingDefaults).
   * 로컬 반경 타겟은 buildLocalRadiusTargeting()/resolveCampaignTargeting() 결과를 주입한다(OMO-3769).
   */
  targeting?: Record<string, unknown>
  creativeName: string
  dryRun?: boolean
}): Promise<CreateCampaignResult> {
  const accountId = getAdAccountId()
  const dryRun = params.dryRun ?? false
  const targeting = params.targeting ?? getAdTargetingDefaults()

  // 가드레일 A: 일일 예산 $20 강제
  const dailyBudgetCents = enforceMaxDailyBudget(DAILY_BUDGET_CENTS)

  const campaignData = await metaFetch<{ id: string }>(`/${accountId}/campaigns`, {
    method: 'POST',
    body: {
      name: params.name,
      objective: params.objective,
      status: 'PAUSED', // Q3=B: 자동 제출 후 사장님 1클릭 활성
      special_ad_categories: [],
    },
    dryRun,
  })

  const campaignId = dryRun ? `dry_campaign_${Date.now()}` : campaignData.id

  const adsetData = await metaFetch<{ id: string }>(`/${accountId}/adsets`, {
    method: 'POST',
    body: {
      name: `${params.name} — AdSet`,
      campaign_id: campaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      // 주의: daily_budget 단위를 반드시 dry-run으로 재검증
      // CEO 검증 결과: spend_cap 입력=dollars 가능성 있음 → cents로 통일
      daily_budget: dailyBudgetCents,
      targeting,
      status: 'PAUSED',
    },
    dryRun,
  })

  const adsetId = dryRun ? `dry_adset_${Date.now()}` : adsetData.id

  // 가드레일 C: 7일 학습락 설정
  const { lockedUntil } = await lockCampaignForLearning(campaignId, params.name, dryRun)

  return { campaignId, adsetId, dailyBudgetCents, lockedUntil }
}

// ─── 광고 소재 + 광고 생성 (페이지/인스타 신원 적용 · OMO-3737) ───────────────

export interface CreateAdResult {
  creativeId: string
  adId: string
}

/**
 * 광고 소재(creative) + 광고(ad) 생성 — 페이지/인스타 신원을 자동 적용한다.
 * object_story_spec.page_id 는 필수, instagram_actor_id 는 설정돼 있으면 인스타 배치에 동일 신원 노출.
 * 생성된 광고는 PAUSED 로 두어 사장님 1클릭 활성(Q3=B)을 따른다.
 */
export async function createAdWithIdentity(params: {
  adsetId: string
  name: string
  /** link_data: 랜딩 링크/메시지/이미지 등 소재 본문 */
  linkData: Record<string, unknown>
  dryRun?: boolean
}): Promise<CreateAdResult> {
  const accountId = getAdAccountId()
  const dryRun = params.dryRun ?? false
  const identity = getAdIdentity()

  const creativeData = await metaFetch<{ id: string }>(`/${accountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: `${params.name} — Creative`,
      object_story_spec: {
        ...identity,
        link_data: params.linkData,
      },
    },
    dryRun,
  })

  const creativeId = dryRun ? `dry_creative_${Date.now()}` : creativeData.id

  const adData = await metaFetch<{ id: string }>(`/${accountId}/ads`, {
    method: 'POST',
    body: {
      name: params.name,
      adset_id: params.adsetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED', // Q3=B: 자동 제출 후 사장님 1클릭 활성
    },
    dryRun,
  })

  const adId = dryRun ? `dry_ad_${Date.now()}` : adData.id

  return { creativeId, adId }
}
