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

/**
 * appsecret_proof 계산. APP_SECRET 미설정이면 null(proof 생략).
 * OMO-3752: 공용 allpack-ai 앱은 APP_SECRET 미설정 운영 → proof는 선택값으로 둔다.
 * (Graph API는 앱에서 "app secret 요구" 옵션을 켜지 않은 한 proof 없이도 호출 가능)
 */
export function buildAppsecretProof(token: string = LONG_LIVED_TOKEN): string | null {
  if (!APP_SECRET) return null
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
  const proof = buildAppsecretProof(token)

  const url = new URL(`${META_API_BASE}${endpoint}`)
  url.searchParams.set('access_token', token)
  if (proof) url.searchParams.set('appsecret_proof', proof)

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

/**
 * 계정 수준 spend_cap "읽기 전용" 조회 (OMO-3752).
 *
 * ⚠️ 광고계정이 뉴트라와 공용이므로 계정 spend_cap을 절대 변경(POST)하지 않는다.
 * (예전 PCCF 전용계정에서는 $600으로 자동 복원했으나, 공용계정에서 복원하면
 *  뉴트라의 설정을 덮어써 혼용 사고가 난다.) procard 예산 가드는 계정 캡이 아니라
 *  PROCARD 네이밍으로 선별한 캠페인의 per-campaign daily_budget으로만 적용한다.
 *
 * @returns spendCapMinor: 계정 통화 최소단위의 현재 캡(0=무제한). ok는 항상 true(읽기 전용).
 */
export async function verifySpendCap(dryRun = false): Promise<{ spendCapMinor: number; ok: boolean }> {
  if (dryRun) return { spendCapMinor: 0, ok: true }

  const accountId = getAdAccountId()
  const data = await metaFetch<{ spend_cap: string }>(`/${accountId}`, {
    params: { fields: 'spend_cap' },
  })

  // Meta는 spend_cap을 계정 통화 최소단위 문자열로 반환(KRW면 원 단위). 변경 없이 보고만.
  const spendCapMinor = parseInt(data.spend_cap ?? '0', 10)
  return { spendCapMinor, ok: true }
}
