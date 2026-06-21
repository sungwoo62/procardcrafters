import { createServerClient } from '@/lib/supabase'
import {
  META_AD_SETS,
  INSTAGRAM_POSTS,
  type MetaAdSet,
} from '@/config/adStudio'

/**
 * 프로카드 메타(Facebook/Instagram) Marketing API 실집행 클라이언트 (OMO-3691).
 *
 * 광고 스튜디오(adStudio.ts)의 META_AD_SETS 30종을 메타 Marketing API 로 집행한다
 * — Campaign → AdSet → AdCreative → Ad. 뉴트리바이오비스(bioridge) 검증 파이프라인
 * 패턴 복제(OMO-3309/3413). 정적 SSOT(META_AD_SETS)를 소스로 쓰는 점만 다르다.
 *
 * ── 게이트(OMO-1908) — 외부 직접 발송 금지 ────────────────────────────
 *  1) 사람 승인 없이는 절대 집행하지 않는다. 라이프사이클: generated → approved → PAUSED.
 *     publishAdSetToMeta()는 opts.approved === true 가 아니면 throw(defense-in-depth).
 *  2) 메타 자격증명(액세스 토큰/광고계정/페이지)이 없거나 앱심사 미완이면
 *     'simulated'(드라이런) 모드로만 동작한다 — 실제 메타 호출 0건.
 *  3) 실제 집행 시에도 광고 객체는 기본 PAUSED 로 생성한다(META_LAUNCH_PAUSED).
 *     사장님이 메타 광고관리자에서 최종 게시(ACTIVE)하는 2차 안전장치.
 *
 * ── 전사 META_ADS 표준(OMO-3444) ─────────────────────────────────────
 *  - 신규 소재 테스트 = 1캠페인-1광고세트-1광고(adStudio structure 필드 참조).
 *  - 1차 지표 = CTR + ROI(대시보드 ROAS 는 보조).
 *  - 테스트 예산 = CAC(마진)×3~5. 본 모듈 일예산은 META_TEST_DAILY_BUDGET_USD 로 주입.
 *
 * 자격증명은 전부 서버 전용 env. 클라이언트로 절대 노출하지 않는다.
 */

const API_VERSION = process.env.META_API_VERSION || 'v21.0'
const GRAPH = `https://graph.facebook.com/${API_VERSION}`

/** 실제 집행에 필요한 서버 전용 자격증명. */
function metaCreds() {
  const accessToken = process.env.META_ACCESS_TOKEN || ''
  // act_ 접두 없는 광고계정 ID 도 허용 → 정규화.
  const rawAccount = process.env.META_AD_ACCOUNT_ID || ''
  const adAccountId = rawAccount
    ? rawAccount.startsWith('act_')
      ? rawAccount
      : `act_${rawAccount}`
    : ''
  const pageId = process.env.META_PAGE_ID || ''
  const instagramId = process.env.META_INSTAGRAM_ACTOR_ID || ''
  return { accessToken, adAccountId, pageId, instagramId }
}

/** 실제 메타 집행이 가능한 상태인지(자격증명·앱심사 완료). */
export function isMetaConfigured(): boolean {
  const { accessToken, adAccountId, pageId } = metaCreds()
  return Boolean(accessToken && adAccountId && pageId)
}

/** 집행 시 광고를 PAUSED 로 생성할지(기본 true = 2차 안전장치). */
function launchPaused(): boolean {
  return (process.env.META_LAUNCH_PAUSED || 'true').toLowerCase() !== 'false'
}

/** 미국 광고계정 일예산 — USD. CAC×3~5 표준 가이드(기본 $20/일). */
function dailyBudgetMinorUnits(): number {
  const usd = Number(process.env.META_TEST_DAILY_BUDGET_USD)
  const dollars = Number.isFinite(usd) && usd > 0 ? usd : 20
  // 메타 예산 단위 = 통화 최소단위(USD = 센트).
  return Math.round(dollars * 100)
}

/** 랜딩 사이트 베이스 URL. */
function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PROCARD_SITE_URL ||
    'https://www.procardcrafters.com'
  ).replace(/\/$/, '')
}

/** 광고 집행 라이프사이클 상태(generated → approved → PAUSED/published). */
export type AdLifecycleStatus = 'generated' | 'approved' | 'published' | 'paused'

export interface PublishResult {
  adId: string // META_AD_SETS 의 AD-xx
  adName: string // Procard_{platform}_{code}_v1
  mode: 'simulated' | 'live'
  status: 'success' | 'failed'
  metaCampaignId: string | null
  metaAdsetId: string | null
  metaCreativeId: string | null
  metaAdId: string | null
  effectiveStatus: string | null
  requestPayload: Record<string, unknown>
  response: Record<string, unknown>
  error: string | null
}

/** 메타 캠페인 목표 → 광고세트 최적화 목표(optimization_goal/billing_event) 매핑. */
function optimizationFor(objective: string): {
  optimization_goal: string
  billing_event: string
} {
  switch (objective) {
    case 'OUTCOME_ENGAGEMENT':
      return { optimization_goal: 'POST_ENGAGEMENT', billing_event: 'IMPRESSIONS' }
    case 'OUTCOME_LEADS':
      return { optimization_goal: 'LEAD_GENERATION', billing_event: 'IMPRESSIONS' }
    case 'OUTCOME_SALES':
      return { optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS' }
    case 'OUTCOME_TRAFFIC':
    default:
      return { optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' }
  }
}

/**
 * adStudio 의 freeform placements 문자열(예: 'IG Feed + Stories, FB Feed')을
 * 메타 publisher_platforms/positions targeting 으로 파싱한다.
 */
function placementTargeting(placements: string): Record<string, unknown> {
  const p = placements.toLowerCase()
  const platforms = new Set<string>()
  const fbPos = new Set<string>()
  const igPos = new Set<string>()

  const hasIg = /\big\b|instagram/.test(p)
  const hasFb = /\bfb\b|facebook/.test(p)

  if (hasIg) {
    platforms.add('instagram')
    if (p.includes('story') || p.includes('stories')) igPos.add('story')
    if (p.includes('reel')) igPos.add('reels')
    if (p.includes('feed') || igPos.size === 0) igPos.add('stream')
  }
  if (hasFb) {
    platforms.add('facebook')
    if (p.includes('story') || p.includes('stories')) fbPos.add('story')
    if (p.includes('feed') || fbPos.size === 0) fbPos.add('feed')
  }
  // 둘 다 못 찾으면 IG 피드 기본.
  if (platforms.size === 0) {
    platforms.add('instagram')
    igPos.add('stream')
  }

  const spec: Record<string, unknown> = { publisher_platforms: [...platforms] }
  if (fbPos.size) spec.facebook_positions = [...fbPos]
  if (igPos.size) spec.instagram_positions = [...igPos]
  return spec
}

/** 타겟팅 spec — 미국 전체(US B2C POD) + Advantage+ 오디언스 명시. */
function audienceTargeting(placements: string): Record<string, unknown> {
  return {
    geo_locations: { countries: ['US'] },
    // 메타가 광고세트 생성 시 Advantage+ 오디언스 명시를 필수로 요구한다(OMO-3413
    // 실집행 검증, subcode 1870227). 0=정의한 타겟 그대로(자동 확장 안 함).
    targeting_automation: { advantage_audience: 0 },
    ...placementTargeting(placements),
  }
}

/** adStudio CTA 라벨 → 메타 call_to_action type. */
function ctaType(button: MetaAdSet['ctaButton']): string {
  switch (button) {
    case 'Shop Now':
      return 'SHOP_NOW'
    case 'Get Offer':
      return 'GET_OFFER'
    case 'Get Quote':
      return 'GET_QUOTE'
    case 'Sign Up':
      return 'SIGN_UP'
    case 'Learn More':
    default:
      return 'LEARN_MORE'
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  에셋 귀속 네이밍 + UTM (전사 컨벤션, nutrabiovis OMO-3356 패턴)
//
//  ad.name(Procard_{platform}_{code}_v1)과 landing_url 의 utm_content 가 동일한
//  {code}_v{n} 을 담아 성과를 에셋(크리에이티브) 단위로 귀속한다. 분석가는
//  ad.name 을 정규식 Procard_(IG|FB|MIX)_(.+)_v(\d+) 으로 파싱한다.
// ─────────────────────────────────────────────────────────────────────────

/** adName(Procard_{platform}_{code}_v{n})에서 platform/code/version 추출. */
function parseAdName(adName: string): {
  platform: string
  code: string
  version: number
} {
  const m = adName.match(/^Procard_([A-Za-z]+)_(.+)_v(\d+)$/)
  if (!m) return { platform: 'IG', code: 'X', version: 1 }
  return { platform: m[1].toUpperCase(), code: m[2], version: Number(m[3]) }
}

/** 에셋 귀속 키 {code}_v{n}(utm_content ★). ad name 과 공유하는 단일 키. */
function assetKey(adName: string): string {
  const { code, version } = parseAdName(adName)
  return `${code}_v${version}`
}

/** placement군 → utm_medium. reels > story > social 우선순위. */
function utmMediumFor(placements: string): string {
  const p = placements.toLowerCase()
  if (p.includes('reel')) return 'paid_reels'
  if (p.includes('story') || p.includes('stories')) return 'paid_story'
  return 'paid_social'
}

/** 메타 목표 → 짧은 토큰(OUTCOME_TRAFFIC → TRAFFIC). */
function objectiveShort(objective: string): string {
  return (objective || 'OUTCOME_TRAFFIC').replace(/^OUTCOME_/, '').toUpperCase()
}

/**
 * 집행 시점의 YYYYMM(미국 동부 기준 근사 — 캠페인/utm 월 토큰).
 * UTC 기준으로 두어 결정성을 유지(테스트·재집행 시 동월이면 동일).
 */
function yyyymm(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

/** META_AD_SETS destination(슬러그) → 절대 랜딩 URL. */
function landingUrlFor(adSet: MetaAdSet): string {
  const dest = adSet.destination.trim()
  // 절대 URL 이면 그대로, 슬래시 포함 경로면 베이스에 붙이고, 단일 슬러그면 /products/{slug}.
  if (/^https?:\/\//.test(dest)) return dest
  const path = dest.startsWith('/')
    ? dest
    : dest.includes('/')
      ? `/${dest}`
      : `/products/${dest}`
  return `${siteBaseUrl()}${path}`
}

/** UTM 5종을 랜딩 URL 에 병합(기존 쿼리 보존, fragment 앞 삽입). */
function appendUtm(adSet: MetaAdSet): string {
  const landing = landingUrlFor(adSet)
  const utm: Record<string, string> = {
    utm_source: 'meta',
    utm_medium: utmMediumFor(adSet.placements),
    utm_campaign: `procard_${objectiveShort(adSet.objective).toLowerCase()}_${yyyymm()}`,
    utm_content: assetKey(adSet.adName),
    utm_term: adSet.adsetName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  }
  try {
    const u = new URL(landing)
    for (const [k, v] of Object.entries(utm)) {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v) // 기존 보존
    }
    return u.toString()
  } catch {
    const [beforeFrag, frag] = landing.split('#')
    const [path, query = ''] = beforeFrag.split('?')
    const params = new URLSearchParams(query)
    for (const [k, v] of Object.entries(utm)) {
      if (!params.has(k)) params.set(k, v)
    }
    const qs = params.toString()
    return `${path}${qs ? `?${qs}` : ''}${frag ? `#${frag}` : ''}`
  }
}

/** META_AD_SETS.creativeRef(IG-xx) → INSTAGRAM_POSTS 이미지 경로(있으면). */
function creativeImagePath(adSet: MetaAdSet): string | null {
  const post = INSTAGRAM_POSTS.find((p) => p.id === adSet.creativeRef)
  return post?.imageUrl?.trim() || null
}

async function graphPost(
  path: string,
  token: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const form = new URLSearchParams()
  form.set('access_token', token)
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    form.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = (json.error as { message?: string } | undefined)?.message
    throw new Error(err || `메타 API 오류(${res.status}) on ${path}`)
  }
  return json
}

/** mkt-uploads 원본 이미지를 메타 /adimages 에 업로드 → image_hash. */
async function uploadImageHash(
  storagePath: string | null,
  adAccountId: string,
  token: string,
): Promise<string | null> {
  if (!storagePath) return null
  const supabase = createServerClient()
  const { data } = await supabase.storage.from('mkt-uploads').download(storagePath)
  if (!data) return null
  const bytes = Buffer.from(await data.arrayBuffer())
  const form = new URLSearchParams()
  form.set('access_token', token)
  form.set('bytes', bytes.toString('base64'))
  const res = await fetch(`${GRAPH}/${adAccountId}/adimages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as {
    images?: Record<string, { hash?: string }>
  }
  if (!res.ok || !json.images) return null
  const first = Object.values(json.images)[0]
  return first?.hash ?? null
}

/**
 * 승인된 단일 광고세트를 메타에 집행한다.
 *
 * 게이트 1: opts.approved !== true 이면 즉시 거부(throw, OMO-1908).
 * 게이트 2: 자격증명/앱심사 미완이면 'simulated' 결과 반환(실제 호출 없음).
 * 게이트 3: 광고 객체는 기본 PAUSED(META_LAUNCH_PAUSED).
 */
export async function publishAdSetToMeta(
  adSet: MetaAdSet,
  opts: { approved: boolean },
): Promise<PublishResult> {
  // ── 게이트 1: 사람 승인 없이는 절대 집행 금지 ──
  if (!opts.approved) {
    throw new Error(
      `승인되지 않은 광고(${adSet.id})는 집행할 수 없습니다. generated→approved 게이트 통과 후 다시 시도하세요.`,
    )
  }

  const opt = optimizationFor(adSet.objective)
  const targeting = audienceTargeting(adSet.placements)
  const effectiveStatus = launchPaused() ? 'PAUSED' : 'ACTIVE'
  const attributedLandingUrl = appendUtm(adSet)
  const dailyBudget = dailyBudgetMinorUnits()

  const requestPayload: Record<string, unknown> = {
    ad_id: adSet.id,
    ad_name: adSet.adName,
    campaign: adSet.campaign,
    objective: adSet.objective,
    daily_budget_minor_units: dailyBudget,
    targeting,
    landing_url: attributedLandingUrl,
    headline: adSet.headline,
    primary_text: adSet.primaryText,
    cta: ctaType(adSet.ctaButton),
    utm_content: assetKey(adSet.adName),
    effective_status: effectiveStatus,
  }

  // ── 게이트 2: 자격증명/앱심사 미완 → 드라이런(시뮬레이션) ──
  if (!isMetaConfigured()) {
    return {
      adId: adSet.id,
      adName: adSet.adName,
      mode: 'simulated',
      status: 'success',
      metaCampaignId: null,
      metaAdsetId: null,
      metaCreativeId: null,
      metaAdId: null,
      effectiveStatus,
      requestPayload,
      response: {
        simulated: true,
        note: '메타 자격증명/앱심사 미완 — 실제 집행 없이 페이로드만 검증했습니다.',
      },
      error: null,
    }
  }

  // ── 실제 집행(live) ──
  const { accessToken, adAccountId, pageId, instagramId } = metaCreds()
  try {
    // 1) Campaign — 항상 PAUSED 로 생성(adset/ad 까지 만든 뒤 ad 레벨에서 게시 제어).
    const campRes = await graphPost(`${adAccountId}/campaigns`, accessToken, {
      // Procard_{objective}_{YYYYMM}_{AD-xx} — 동월·동목표 캠페인 구분.
      name: `Procard_${objectiveShort(adSet.objective)}_${yyyymm()}_${adSet.id}`,
      objective: adSet.objective,
      status: 'PAUSED',
      special_ad_categories: [],
      // 예산이 광고세트 레벨에 있으므로 메타가 이 플래그를 필수로 요구(subcode 4834011).
      is_adset_budget_sharing_enabled: false,
    })
    const metaCampaignId = String(campRes.id)

    // 2) AdSet — 일예산·타겟·최적화.
    const adsetRes = await graphPost(`${adAccountId}/adsets`, accessToken, {
      name: adSet.adsetName,
      campaign_id: metaCampaignId,
      daily_budget: dailyBudget,
      // 입찰 전략은 예산 레벨(광고세트)에 지정(미지정 시 subcode 2490487 실패).
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      billing_event: opt.billing_event,
      optimization_goal: opt.optimization_goal,
      targeting,
      status: 'PAUSED',
    })
    const metaAdsetId = String(adsetRes.id)

    // 3) AdCreative — 이미지(있으면) + 카피 + 링크.
    const imageHash = await uploadImageHash(
      creativeImagePath(adSet),
      adAccountId,
      accessToken,
    )
    const linkData: Record<string, unknown> = {
      link: attributedLandingUrl,
      message: adSet.primaryText,
      name: adSet.headline,
      description: adSet.description,
      call_to_action: { type: ctaType(adSet.ctaButton) },
    }
    if (imageHash) linkData.image_hash = imageHash
    const objectStorySpec: Record<string, unknown> = {
      page_id: pageId,
      link_data: linkData,
    }
    // v21 규격: instagram_user_id(구 instagram_actor_id deprecated). (OMO-3413 검증)
    if (instagramId) objectStorySpec.instagram_user_id = instagramId

    const creativeRes = await graphPost(`${adAccountId}/adcreatives`, accessToken, {
      name: `${adSet.adName} creative`,
      object_story_spec: objectStorySpec,
    })
    const metaCreativeId = String(creativeRes.id)

    // 4) Ad — effective_status 로 최종 게시 여부 제어. ad.name = Procard_{platform}_{code}_v1.
    const adRes = await graphPost(`${adAccountId}/ads`, accessToken, {
      name: adSet.adName,
      adset_id: metaAdsetId,
      creative: { creative_id: metaCreativeId },
      status: effectiveStatus,
    })
    const metaAdId = String(adRes.id)

    return {
      adId: adSet.id,
      adName: adSet.adName,
      mode: 'live',
      status: 'success',
      metaCampaignId,
      metaAdsetId,
      metaCreativeId,
      metaAdId,
      effectiveStatus,
      requestPayload,
      response: { campaign: campRes, adset: adsetRes, creative: creativeRes, ad: adRes },
      error: null,
    }
  } catch (err) {
    return {
      adId: adSet.id,
      adName: adSet.adName,
      mode: 'live',
      status: 'failed',
      metaCampaignId: null,
      metaAdsetId: null,
      metaCreativeId: null,
      metaAdId: null,
      effectiveStatus: null,
      requestPayload,
      response: {},
      error: err instanceof Error ? err.message : '메타 집행 중 알 수 없는 오류',
    }
  }
}

/**
 * 승인된 광고세트 묶음을 순차 집행한다 — "30세트 게시" 진입점.
 *
 * @param approvedAdIds 집행 승인된 META_AD_SETS 의 id 목록(generated→approved 게이트 결과).
 *                      미지정 시 빈 배열로 간주 → 아무것도 집행하지 않는다(안전 기본값).
 *
 * 자격증명 미완이면 전부 simulated 로 돌아오며, 호출자는 페이로드를 사전검증할 수 있다.
 * 실제 집행 시 각 광고는 PAUSED 로 생성된다(사장님 최종 게시 2차 게이트).
 */
export async function publishApprovedAdSets(
  approvedAdIds: string[] = [],
): Promise<PublishResult[]> {
  const approved = new Set(approvedAdIds)
  const targets = META_AD_SETS.filter((a) => approved.has(a.id))
  const results: PublishResult[] = []
  for (const adSet of targets) {
    // 게이트는 publishAdSetToMeta 내부에서도 재확인(approved=true 명시).
    results.push(await publishAdSetToMeta(adSet, { approved: true }))
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────────
//  인사이트 read (분석가 데이터 피드, nutrabiovis OMO-3355 패턴)
//
//  노출·CTR·CPC·spend 등 성과지표 read 전용. 집행(write)과 달리 승인 게이트가
//  없다 — 읽기만 한다. 자격증명 미설정/라이브 광고 0건이면 throw 없이 빈 배열.
// ─────────────────────────────────────────────────────────────────────────

export type InsightsLevel = 'campaign' | 'adset' | 'ad'
export type InsightsRange = 'today' | 'yesterday' | 'last_7d' | 'last_30d'

export interface InsightsQuery {
  level?: InsightsLevel
  range?: InsightsRange
  since?: string
  until?: string
}

export interface InsightRow {
  level: InsightsLevel
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  /** 분석가가 정규식으로 에셋 귀속(Procard_(IG|FB|MIX)_(.+)_v(\d+)). */
  ad_name?: string
  date_start?: string
  date_stop?: string
  impressions?: string
  reach?: string
  frequency?: string
  ctr?: string
  inline_link_click_ctr?: string
  cpc?: string
  cpm?: string
  spend?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
}

const RANGE_PRESET: Record<InsightsRange, string> = {
  today: 'today',
  yesterday: 'yesterday',
  last_7d: 'last_7d',
  last_30d: 'last_30d',
}

/**
 * 메타 인사이트를 조회한다(분석가 피드). 자격증명 미완이면 빈 배열.
 */
export async function getMetaInsights(query: InsightsQuery = {}): Promise<InsightRow[]> {
  if (!isMetaConfigured()) return []
  const { accessToken, adAccountId } = metaCreds()
  const level: InsightsLevel = query.level || 'campaign'

  const params = new URLSearchParams()
  params.set('access_token', accessToken)
  params.set('level', level)
  params.set(
    'fields',
    [
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      'impressions',
      'reach',
      'frequency',
      'ctr',
      'inline_link_click_ctr',
      'cpc',
      'cpm',
      'spend',
      'actions',
      'action_values',
    ].join(','),
  )
  if (query.since && query.until) {
    params.set('time_range', JSON.stringify({ since: query.since, until: query.until }))
  } else {
    params.set('date_preset', RANGE_PRESET[query.range || 'last_7d'])
  }
  params.set('limit', '500')

  try {
    const res = await fetch(`${GRAPH}/${adAccountId}/insights?${params.toString()}`)
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<Record<string, unknown>>
    }
    if (!res.ok || !Array.isArray(json.data)) return []
    return json.data.map((row) => ({ level, ...(row as object) })) as InsightRow[]
  } catch {
    return []
  }
}
