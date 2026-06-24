import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const META_API_BASE = 'https://graph.facebook.com/v22.0'

const APP_ID = process.env.PCCF_META_APP_ID!
const APP_SECRET = process.env.PCCF_META_APP_SECRET!
const AD_ACCOUNT_ID = process.env.PCCF_META_AD_ACCOUNT_ID!
const LONG_LIVED_TOKEN = process.env.PCCF_META_LONG_LIVED_TOKEN!

// OMO-3737: procardcrafters.com Meta 자산 — 페이지/인스타/비즈니스/픽셀
// 광고 소재(creative)의 신원(identity)을 구성하려면 페이지 ID가 필수이고,
// 인스타 배치 노출용으로 인스타 actor ID를 함께 지정한다.
const PAGE_ID = process.env.PCCF_META_PAGE_ID!
const INSTAGRAM_ACTOR_ID = process.env.PCCF_META_INSTAGRAM_ACTOR_ID!
const BUSINESS_ID = process.env.PCCF_META_BUSINESS_ID!
const PIXEL_ID = process.env.PCCF_META_PIXEL_ID!

// OMO-3737: procard는 해외(US) 타겟·영어 운영 (국내/해외 분리, procard=overseas)
const TARGET_COUNTRIES = (process.env.PCCF_META_TARGET_COUNTRIES || 'US')
  .split(',').map((c) => c.trim()).filter(Boolean)
const AD_LOCALE = process.env.PCCF_META_AD_LOCALE || 'en_US'

// 서비스 롤 클라이언트 — 백그라운드 작업용 (쿠키 없음)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly subcode?: number
  ) {
    super(message)
    this.name = 'MetaApiError'
  }

  /** 정책 거절 (가드레일 B) */
  isPolicyRejection(): boolean {
    return this.subcode === 1487749 || this.code === 368
  }

  /** 재시도 불가 에러 (4xx) */
  isNonRetryable(): boolean {
    return this.code >= 100 && this.code < 200
  }
}

export function buildAppsecretProof(token: string = LONG_LIVED_TOKEN): string {
  if (!APP_SECRET) throw new Error('PCCF_META_APP_SECRET 미설정')
  return createHmac('sha256', APP_SECRET).update(token).digest('hex')
}

export function getAccessToken(): string {
  if (!LONG_LIVED_TOKEN) throw new Error('PCCF_META_LONG_LIVED_TOKEN 미설정')
  return LONG_LIVED_TOKEN
}

export function getAdAccountId(): string {
  if (!AD_ACCOUNT_ID) throw new Error('PCCF_META_AD_ACCOUNT_ID 미설정')
  return AD_ACCOUNT_ID
}

export function getAppId(): string {
  if (!APP_ID) throw new Error('PCCF_META_APP_ID 미설정')
  return APP_ID
}

// ─── procardcrafters Meta 자산 게터 (OMO-3737) ──────────────────────────────

/** 페이스북 페이지 ID — 광고 소재 신원(object_story_spec.page_id)에 필수 */
export function getPageId(): string {
  if (!PAGE_ID) throw new Error('PCCF_META_PAGE_ID 미설정')
  return PAGE_ID
}

/** 인스타그램 actor ID — 인스타 배치 노출 신원(instagram_actor_id). 미설정 시 null */
export function getInstagramActorId(): string | null {
  return INSTAGRAM_ACTOR_ID || null
}

/** 비즈니스 매니저 ID — 신규 광고계정/시스템유저 생성 시 사용 */
export function getBusinessId(): string {
  if (!BUSINESS_ID) throw new Error('PCCF_META_BUSINESS_ID 미설정')
  return BUSINESS_ID
}

/** 픽셀 ID — 도메인 매칭/전환 추적. 미설정 시 null */
export function getPixelId(): string | null {
  return PIXEL_ID || null
}

/**
 * 광고 소재의 신원(identity) 구성 — object_story_spec에 그대로 펼쳐 넣는다.
 * 페이지는 필수, 인스타 actor는 있으면 인스타 배치에 동일 신원으로 노출된다.
 */
export function getAdIdentity(): { page_id: string; instagram_actor_id?: string } {
  const identity: { page_id: string; instagram_actor_id?: string } = {
    page_id: getPageId(),
  }
  const ig = getInstagramActorId()
  if (ig) identity.instagram_actor_id = ig
  return identity
}

// ─── 타겟/언어 (OMO-3737: procard=해외 US·영어) ──────────────────────────────

/** 광고 지오타겟 국가 코드 (기본 US) */
export function getTargetCountries(): string[] {
  return TARGET_COUNTRIES.length ? TARGET_COUNTRIES : ['US']
}

/** 광고 카피/소재 언어 로케일 (기본 en_US) */
export function getAdLocale(): string {
  return AD_LOCALE
}

/**
 * 캠페인 기본 타겟팅 — 미지정 시 해외(US) 타겟을 적용한다.
 * 국내/해외 분리: procard는 해외, 나머지 서비스는 국내(KR) 타겟.
 */
export function getAdTargetingDefaults(): { geo_locations: { countries: string[] } } {
  return { geo_locations: { countries: getTargetCountries() } }
}

// ─── 반경(로컬) 타겟팅 — 공유 엔진 캠페인 단위 옵션 (OMO-3769) ──────────────────
//
// procard에는 미적용(US 광역 유지). 로컬 니즈가 있는 서비스/클라이언트가
// 캠페인 단위로 켜는 opt-in 옵션이다. 호출자가 좌표·반경·도달옵션을 지정해
// createCampaignWithGuardrails({ targeting }) 로 넘긴다.

/**
 * 반경 도달옵션 — "이 지역 거주"(home)가 기본.
 * home=거주, recent=최근 위치, travel_in=방문 중, home_recent=거주+최근.
 */
export type RadiusReachType = 'home' | 'recent' | 'travel_in' | 'home_recent'

export interface RadiusTargetingOptions {
  /** 핀 위도 (-90~90) */
  latitude: number
  /** 핀 경도 (-180~180) */
  longitude: number
  /** 반경 — 단위는 distanceUnit (기본 km) */
  radius: number
  /** 거리 단위 (Meta: kilometer 1~80, mile 1~50) */
  distanceUnit?: 'kilometer' | 'mile'
  /** 주소 문자열(선택) — 핀 라벨/검증용 */
  addressString?: string
  /** 도달옵션 (기본 home="이 지역 거주") */
  reach?: RadiusReachType
  /** 국가 제약(선택) — custom_locations와 함께 둘 수 있음 */
  countries?: string[]
}

// Meta 반경 제약: km 1~80, mile 1~50
const RADIUS_BOUNDS: Record<'kilometer' | 'mile', { min: number; max: number }> = {
  kilometer: { min: 1, max: 80 },
  mile: { min: 1, max: 50 },
}

const REACH_LOCATION_TYPES: Record<RadiusReachType, string[]> = {
  home: ['home'],
  recent: ['recent'],
  travel_in: ['travel_in'],
  home_recent: ['home', 'recent'],
}

export interface RadiusTargetingResult {
  geo_locations: {
    custom_locations: Array<{
      latitude: number
      longitude: number
      radius: number
      distance_unit: 'kilometer' | 'mile'
      address_string?: string
    }>
    location_types: string[]
    countries?: string[]
  }
}

/**
 * 핀(좌표) + 반경 + 도달옵션을 Meta 광고세트 targeting 형태로 빌드한다.
 * 좁은 반경은 모수 부족 → 학습 미진입/빈도 폭증 주의 → 단계적으로 좁힐 것(OMO-3769).
 */
export function buildRadiusTargeting(opts: RadiusTargetingOptions): RadiusTargetingResult {
  const unit = opts.distanceUnit ?? 'kilometer'
  const bounds = RADIUS_BOUNDS[unit]
  if (!Number.isFinite(opts.latitude) || opts.latitude < -90 || opts.latitude > 90)
    throw new Error('buildRadiusTargeting: latitude 범위(-90~90) 오류')
  if (!Number.isFinite(opts.longitude) || opts.longitude < -180 || opts.longitude > 180)
    throw new Error('buildRadiusTargeting: longitude 범위(-180~180) 오류')
  if (!Number.isFinite(opts.radius) || opts.radius < bounds.min || opts.radius > bounds.max)
    throw new Error(`buildRadiusTargeting: radius ${unit} 범위(${bounds.min}~${bounds.max}) 오류`)

  const customLocation: RadiusTargetingResult['geo_locations']['custom_locations'][number] = {
    latitude: opts.latitude,
    longitude: opts.longitude,
    radius: opts.radius,
    distance_unit: unit,
  }
  if (opts.addressString) customLocation.address_string = opts.addressString

  const geo: RadiusTargetingResult['geo_locations'] = {
    custom_locations: [customLocation],
    location_types: REACH_LOCATION_TYPES[opts.reach ?? 'home'],
  }
  if (opts.countries?.length) geo.countries = opts.countries
  return { geo_locations: geo }
}

// Special Ad Categories(주거/고용/신용)는 반경·우편번호 타겟 제한 → 광역만 허용(OMO-3769)
const RADIUS_RESTRICTED_CATEGORIES = ['HOUSING', 'EMPLOYMENT', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS']

/**
 * 반경 타겟 허용 여부 검증 — 제한 카테고리면 throw.
 * 호출 시점: custom_locations(반경) 타겟을 special_ad_categories와 함께 쓰려 할 때.
 */
export function assertRadiusAllowed(specialAdCategories: string[] = []): void {
  const blocked = specialAdCategories.filter((c) =>
    RADIUS_RESTRICTED_CATEGORIES.includes(c.toUpperCase())
  )
  if (blocked.length)
    throw new Error(
      `반경 타겟 불가: Special Ad Categories(${blocked.join(',')})는 광역 타겟만 허용 (OMO-3769)`
    )
}

interface MetaFetchOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  params?: Record<string, string | number | boolean>
  body?: Record<string, unknown>
  /** true면 실제 API 호출 없이 로그만 기록 */
  dryRun?: boolean
}

interface MetaApiResponse {
  error?: {
    message: string
    code: number
    error_subcode?: number
    type?: string
  }
}

async function logApiCall(
  endpoint: string,
  method: string,
  result: { statusCode?: number; errorCode?: number; errorSubcode?: number; errorMessage?: string; durationMs?: number; dryRun?: boolean }
): Promise<void> {
  try {
    const db = getServiceClient()
    await db.from('pccf_ads_api_log').insert({
      endpoint,
      method,
      status_code: result.statusCode,
      error_code: result.errorCode,
      error_subcode: result.errorSubcode,
      error_message: result.errorMessage,
      duration_ms: result.durationMs,
      dry_run: result.dryRun ?? false,
    })
  } catch {
    // 로그 실패는 메인 흐름에 영향 주지 않음
  }
}

export async function metaFetch<T = unknown>(
  endpoint: string,
  options: MetaFetchOptions = {}
): Promise<T> {
  const { method = 'GET', params = {}, body, dryRun = false } = options
  const token = getAccessToken()

  const url = new URL(`${META_API_BASE}${endpoint}`)
  url.searchParams.set('access_token', token)
  // appsecret_proof는 APP_SECRET이 설정된 경우에만 전송한다 (OMO-3737).
  // allpack-ai 시스템유저 앱은 proof를 요구하지 않으며, 앱 시크릿이 없을 때
  // 다른 앱 시크릿으로 잘못된 proof를 보내면 Meta가 거절하므로 생략한다.
  if (APP_SECRET) {
    url.searchParams.set('appsecret_proof', buildAppsecretProof(token))
  }

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  if (dryRun) {
    await logApiCall(endpoint, method, { statusCode: 0, dryRun: true })
    return { dryRun: true, endpoint, method } as T
  }

  const startMs = Date.now()
  let lastError: MetaApiError | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = (await res.json()) as T & MetaApiResponse
    const durationMs = Date.now() - startMs

    if (data.error) {
      const err = data.error
      const apiError = new MetaApiError(err.message, err.code, err.error_subcode)

      await logApiCall(endpoint, method, {
        statusCode: res.status,
        errorCode: err.code,
        errorSubcode: err.error_subcode,
        errorMessage: err.message,
        durationMs,
      })

      // 4xx는 재시도 금지
      if (res.status >= 400 && res.status < 500) throw apiError

      lastError = apiError
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }

    await logApiCall(endpoint, method, { statusCode: res.status, durationMs })
    return data
  }

  throw lastError ?? new MetaApiError('Meta API 요청 실패 (3회 재시도 초과)', 0)
}

/** 계정 수준 spend_cap 검증 — $600 (60000 cents) 유지 확인 */
export async function verifySpendCap(dryRun = false): Promise<{ spendCapCents: number; ok: boolean }> {
  if (dryRun) return { spendCapCents: 60000, ok: true }

  const accountId = getAdAccountId()
  const data = await metaFetch<{ spend_cap: string }>(`/${accountId}`, {
    params: { fields: 'spend_cap' },
  })

  // Meta API는 spend_cap을 cents 단위 문자열로 반환
  const spendCapCents = parseInt(data.spend_cap ?? '0', 10)
  const EXPECTED_CAP_CENTS = 60000 // $600

  if (spendCapCents !== EXPECTED_CAP_CENTS) {
    // 변경 감지 시 즉시 복원
    await metaFetch(`/${accountId}`, {
      method: 'POST',
      body: { spend_cap: EXPECTED_CAP_CENTS },
    })
    return { spendCapCents: EXPECTED_CAP_CENTS, ok: false }
  }

  return { spendCapCents, ok: true }
}
