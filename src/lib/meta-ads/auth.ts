import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const META_API_BASE = 'https://graph.facebook.com/v22.0'

const APP_ID = process.env.PCCF_META_APP_ID!
const APP_SECRET = process.env.PCCF_META_APP_SECRET!
const AD_ACCOUNT_ID = process.env.PCCF_META_AD_ACCOUNT_ID!
const LONG_LIVED_TOKEN = process.env.PCCF_META_LONG_LIVED_TOKEN!

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
  url.searchParams.set('appsecret_proof', proof)

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
