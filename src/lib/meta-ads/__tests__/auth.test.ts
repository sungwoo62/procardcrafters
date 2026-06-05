import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'

// Supabase 전역 모킹 — logApiCall의 DB 호출이 fetch를 우회
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

// 환경변수 모킹
beforeEach(() => {
  process.env.PCCF_META_APP_ID = 'test_app_id'
  process.env.PCCF_META_APP_SECRET = 'test_app_secret'
  process.env.PCCF_META_AD_ACCOUNT_ID = 'act_test_123'
  process.env.PCCF_META_LONG_LIVED_TOKEN = 'test_token_abc'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key'
})

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('buildAppsecretProof', () => {
  it('HMAC-SHA256 올바르게 생성', async () => {
    const { buildAppsecretProof } = await import('../auth')
    const proof = buildAppsecretProof('test_token_abc')
    const expected = createHmac('sha256', 'test_app_secret')
      .update('test_token_abc')
      .digest('hex')
    expect(proof).toBe(expected)
  })

  it('APP_SECRET 미설정 시 에러', async () => {
    process.env.PCCF_META_APP_SECRET = ''
    const { buildAppsecretProof } = await import('../auth')
    expect(() => buildAppsecretProof('token')).toThrow('PCCF_META_APP_SECRET 미설정')
  })
})

describe('getAccessToken', () => {
  it('토큰 반환', async () => {
    const { getAccessToken } = await import('../auth')
    expect(getAccessToken()).toBe('test_token_abc')
  })

  it('토큰 미설정 시 에러', async () => {
    process.env.PCCF_META_LONG_LIVED_TOKEN = ''
    const { getAccessToken } = await import('../auth')
    expect(() => getAccessToken()).toThrow('PCCF_META_LONG_LIVED_TOKEN 미설정')
  })
})

describe('getAdAccountId', () => {
  it('계정 ID 반환', async () => {
    const { getAdAccountId } = await import('../auth')
    expect(getAdAccountId()).toBe('act_test_123')
  })
})

describe('MetaApiError', () => {
  it('정책 거절 감지 (subcode=1487749)', async () => {
    const { MetaApiError } = await import('../auth')
    const err = new MetaApiError('정책 위반', 368, 1487749)
    expect(err.isPolicyRejection()).toBe(true)
  })

  it('일반 에러는 정책 거절 아님', async () => {
    const { MetaApiError } = await import('../auth')
    const err = new MetaApiError('서버 오류', 500)
    expect(err.isPolicyRejection()).toBe(false)
  })

  it('4xx 에러는 재시도 불가', async () => {
    const { MetaApiError } = await import('../auth')
    const err = new MetaApiError('잘못된 요청', 100)
    expect(err.isNonRetryable()).toBe(true)
  })
})

describe('metaFetch', () => {
  it('dry-run 모드: API 호출 없이 반환', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { metaFetch } = await import('../auth')
    const result = await metaFetch('/test', { dryRun: true })
    expect((result as Record<string, unknown>).dryRun).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('appsecret_proof가 URL에 포함됨', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'test_result' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { metaFetch } = await import('../auth')
    await metaFetch('/test_endpoint')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('appsecret_proof=')
    expect(calledUrl).toContain('access_token=test_token_abc')
  })

  it('4xx 응답: 재시도 없이 즉시 에러', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: '잘못된 파라미터', code: 100, error_subcode: 0 },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { metaFetch, MetaApiError } = await import('../auth')
    await expect(metaFetch('/bad_endpoint')).rejects.toThrow(MetaApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1) // 재시도 없음
  })
})

describe('verifySpendCap', () => {
  it('dry-run: 검증 스킵, ok=true 반환', async () => {
    const { verifySpendCap } = await import('../auth')
    const result = await verifySpendCap(true)
    expect(result.ok).toBe(true)
    expect(result.spendCapCents).toBe(60000)
  })
})
