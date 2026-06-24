import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  process.env.PCCF_META_APP_ID = 'test_app_id'
  process.env.PCCF_META_APP_SECRET = 'test_app_secret'
  process.env.PCCF_META_AD_ACCOUNT_ID = 'act_test_123'
  process.env.PCCF_META_LONG_LIVED_TOKEN = 'test_token'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key'
})

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('enforceMaxDailyBudget', () => {
  it('요청 예산 > $20 → $20(2000 cents) 반환', async () => {
    const { enforceMaxDailyBudget, DAILY_BUDGET_CENTS } = await import('../guardrails')
    expect(enforceMaxDailyBudget(5000)).toBe(DAILY_BUDGET_CENTS)
  })

  it('요청 예산 ≤ $20 → 그대로 반환', async () => {
    const { enforceMaxDailyBudget } = await import('../guardrails')
    expect(enforceMaxDailyBudget(1000)).toBe(1000)
  })

  it('정확히 $20(2000 cents) → 그대로 반환', async () => {
    const { enforceMaxDailyBudget, DAILY_BUDGET_CENTS } = await import('../guardrails')
    expect(enforceMaxDailyBudget(DAILY_BUDGET_CENTS)).toBe(DAILY_BUDGET_CENTS)
  })
})

describe('runDailyCapCheck (dry-run)', () => {
  it('dry-run: spend 0, paused 없음', async () => {
    const { runDailyCapCheck } = await import('../guardrails')
    const result = await runDailyCapCheck(true)
    expect(result.spendCents).toBe(0)
    expect(result.paused).toHaveLength(0)
    expect(result.warning).toBe(false)
  })
})

describe('가드레일 B: 정책 거절 처리', () => {
  it('정책 거절 에러 → handlePolicyRejection 호출 (dry-run)', async () => {
    const { handlePolicyRejection } = await import('../guardrails')
    const { MetaApiError } = await import('../auth')

    // Supabase 모킹
    vi.mock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          insert: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }))

    const policyError = new MetaApiError('정책 위반', 368, 1487749)
    expect(policyError.isPolicyRejection()).toBe(true)

    // dry-run으로 DB 저장 없이 실행
    await expect(
      handlePolicyRejection({
        error: policyError,
        campaignId: 'test_campaign',
        dryRun: true,
      })
    ).resolves.not.toThrow()
  })

  it('정책 거절이 아닌 에러 → 아무것도 하지 않음', async () => {
    const { handlePolicyRejection } = await import('../guardrails')
    const { MetaApiError } = await import('../auth')

    const normalError = new MetaApiError('서버 오류', 500)
    await handlePolicyRejection({ error: normalError, dryRun: true })
    // 에러 없이 통과
  })
})

describe('가드레일 C: 학습락', () => {
  it('lockCampaignForLearning: 7일 후 날짜 반환 (dry-run)', async () => {
    const { lockCampaignForLearning } = await import('../guardrails')

    const before = new Date()
    const { lockedUntil } = await lockCampaignForLearning('camp_123', '테스트 캠페인', true)
    const after = new Date()

    const expectedMin = new Date(before.getTime() + 6.9 * 24 * 60 * 60 * 1000)
    const expectedMax = new Date(after.getTime() + 7.1 * 24 * 60 * 60 * 1000)

    expect(lockedUntil.getTime()).toBeGreaterThan(expectedMin.getTime())
    expect(lockedUntil.getTime()).toBeLessThan(expectedMax.getTime())
  })

  it('assertNotLearningLocked: 잠금 해제 상태에서 통과', async () => {
    // Supabase 모킹 — unlocked_at이 있는 상태
    vi.mock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { locked_until: new Date().toISOString(), unlocked_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }))

    const { assertNotLearningLocked } = await import('../guardrails')
    await expect(assertNotLearningLocked('camp_unlocked')).resolves.not.toThrow()
  })
})

describe('가드레일 D: ROAS (dry-run)', () => {
  it('fetchCampaignInsights dry-run: 기본값 반환', async () => {
    const { fetchCampaignInsights } = await import('../guardrails')
    const snapshot = await fetchCampaignInsights('camp_test', true)
    expect(snapshot.roas).toBe(4.0)
    expect(snapshot.spendCents).toBe(1000)
    expect(snapshot.revenueCents).toBe(4000)
  })

  it('runRoasWatcher dry-run: 에러 없이 실행', async () => {
    const { runRoasWatcher } = await import('../guardrails')
    const result = await runRoasWatcher(true)
    expect(result.actions).toBeInstanceOf(Array)
  })
})

describe('checkAndRestoreSpendCap (dry-run)', () => {
  it('dry-run: 검증 스킵, 에러 없이 완료', async () => {
    const { checkAndRestoreSpendCap } = await import('../guardrails')
    await expect(checkAndRestoreSpendCap(true)).resolves.not.toThrow()
  })
})
