import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createServerClient } from '@/lib/supabase'
import { validateCode, applyCode } from '@/lib/promotion-engine'

// ─── Supabase 모킹 (vi.mock은 hoisted됨) ────────────────────
vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}))

const mockCreateServerClient = vi.mocked(createServerClient)

// ─── 공통 픽스처 ────────────────────────────────────────────

function makeCode(overrides: Partial<{
  id: string
  campaign_id: string | null
  code: string
  discount_pct: number
  discount_tier: string
  min_order_cents: number
  max_discount_cents: number | null
  valid_from: string
  valid_until: string
  max_uses: number | null
  per_user_max: number
  status: string
}> = {}) {
  const now = Date.now()
  return {
    id: 'code-id-1',
    campaign_id: null,
    code: 'TEST10',
    discount_pct: 10,
    discount_tier: 'standard',
    min_order_cents: 0,
    max_discount_cents: null,
    valid_from: new Date(now - 86400000).toISOString(),
    valid_until: new Date(now + 86400000).toISOString(),
    max_uses: null,
    per_user_max: 1,
    status: 'active',
    ...overrides,
  }
}

// ─── Supabase 클라이언트 빌더 ────────────────────────────────

function makeSupabaseMock({
  code,
  redemptionCount = 0,
  userRedemptionCount = 0,
  products = [] as Array<{ slug: string; margin_pct: number | null; is_bestseller: boolean }>,
  rpcResult = { ok: true, redemption_id: 'r-id', applied_at: new Date().toISOString() },
}: {
  code?: ReturnType<typeof makeCode>
  redemptionCount?: number
  userRedemptionCount?: number
  products?: Array<{ slug: string; margin_pct: number | null; is_bestseller: boolean }>
  rpcResult?: object
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'print_promo_codes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                code ? { data: code, error: null } : { data: null, error: { message: 'not found' } }
              ),
            }),
          }),
        }
      }

      if (table === 'print_promo_code_redemptions') {
        // 두 체크 모두 `.select('id', { count, head }).eq(code_id)[.eq(user_id)]` 패턴
        return {
          select: vi.fn().mockReturnValue({
            // 첫 번째 .eq (code_id) — max_uses는 여기서 resolve, per_user_max는 체인 계속
            eq: vi.fn().mockReturnValue({
              // 두 번째 .eq (user_id) — per_user_max용
              eq: vi.fn().mockResolvedValue({ count: userRedemptionCount, error: null }),
              // max_uses는 첫 번째 .eq에서 바로 resolve (then 프로토콜)
              then: (resolve: (v: unknown) => void) =>
                resolve({ count: redemptionCount, error: null }),
            }),
          }),
        }
      }

      if (table === 'print_products') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: products, error: null }),
          }),
        }
      }

      // BF campaign check
      if (table === 'print_promotion_campaigns') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { peak_start_at: null, calendar: { key: 'standard' } },
                error: null,
              }),
            }),
          }),
        }
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
    }),
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
  }
}

// ─── 테스트 ──────────────────────────────────────────────────

describe('validateCode — 기본 유효성 검증', () => {
  beforeEach(() => vi.clearAllMocks())

  it('존재하지 않는 코드를 reject한다', async () => {
    mockCreateServerClient.mockReturnValue(makeSupabaseMock() as unknown as ReturnType<typeof createServerClient>)

    const result = await validateCode('INVALID', { totalCents: 10000 })
    expect(result.valid).toBe(false)
  })

  it('만료된 코드를 reject한다', async () => {
    const expiredCode = makeCode({
      valid_until: new Date(Date.now() - 86400000).toISOString(),
    })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ code: expiredCode }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('TEST10', { totalCents: 10000 })
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/유효 기간/)
  })

  it('locked 코드를 reject한다', async () => {
    const lockedCode = makeCode({ status: 'locked' })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ code: lockedCode }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('TEST10', { totalCents: 10000 })
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/사용할 수 없는 코드/)
  })

  it('min_order 미달 시 reject한다', async () => {
    const code = makeCode({ min_order_cents: 50000 })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ code }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('TEST10', { totalCents: 10000 })
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/최소 주문 금액/)
  })
})

describe('validateCode — tier cap 강제', () => {
  beforeEach(() => vi.clearAllMocks())

  it('top tier 25% 코드 → cap 20%로 절삭', async () => {
    const code = makeCode({ discount_pct: 25, discount_tier: 'top' })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({
        code,
        products: [{ slug: 'business-cards', margin_pct: 40, is_bestseller: false }],
      }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('TOP25', {
      totalCents: 100000,
      productSlugs: ['business-cards'],
    })

    expect(result.valid).toBe(true)
    // top cap = 20% → 100000 * 0.20 = 20000 cents
    expect(result.discountAmount).toBe(20000)
    expect(result.effectivePct).toBeCloseTo(20, 1)
  })

  it('bestseller 상품에 standard 15% 코드 → 10%로 절삭', async () => {
    const code = makeCode({ discount_pct: 15, discount_tier: 'standard' })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({
        code,
        products: [{ slug: 'premium-foil-cards', margin_pct: 35, is_bestseller: true }],
      }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('STD15', {
      totalCents: 100000,
      productSlugs: ['premium-foil-cards'],
    })

    expect(result.valid).toBe(true)
    // bestseller cap = 10%
    expect(result.discountAmount).toBe(10000)
    expect(result.effectivePct).toBeCloseTo(10, 1)
  })

  it('always_on 코드 → 10% cap 적용', async () => {
    const code = makeCode({ discount_pct: 12, discount_tier: 'always_on' })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({
        code,
        products: [{ slug: 'stickers', margin_pct: 40, is_bestseller: false }],
      }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('AON12', {
      totalCents: 100000,
      productSlugs: ['stickers'],
    })

    expect(result.valid).toBe(true)
    // always_on cap = 10% → 10000 cents
    expect(result.discountAmount).toBe(10000)
  })

  it('저마진 라인만 카트에 있으면 프로모 제외', async () => {
    const code = makeCode({ discount_pct: 15, discount_tier: 'standard' })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({
        code,
        products: [{ slug: 'low-margin', margin_pct: 20, is_bestseller: false }],
      }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('STD15', {
      totalCents: 100000,
      productSlugs: ['low-margin'],
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/적용할 수 없/)
  })

  it('max_discount_cents 상한 초과 시 상한으로 절삭', async () => {
    const code = makeCode({ discount_pct: 15, discount_tier: 'standard', max_discount_cents: 5000 })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({
        code,
        products: [{ slug: 'business-cards', margin_pct: 40, is_bestseller: false }],
      }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('CAP5K', {
      totalCents: 100000,
      productSlugs: ['business-cards'],
    })

    expect(result.valid).toBe(true)
    // 15% of 100000 = 15000 → capped at 5000
    expect(result.discountAmount).toBe(5000)
  })
})

describe('validateCode — 사용 한도', () => {
  beforeEach(() => vi.clearAllMocks())

  it('per_user_max 초과 시 reject', async () => {
    const code = makeCode({ per_user_max: 1, max_uses: null })
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ code, userRedemptionCount: 1 }) as unknown as ReturnType<typeof createServerClient>
    )

    const result = await validateCode('TEST10', {
      userId: 'user-123',
      totalCents: 10000,
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/이미 사용/)
  })
})

describe('applyCode — 원자적 redemption', () => {
  beforeEach(() => vi.clearAllMocks())

  it('성공 시 Redemption 객체를 반환한다', async () => {
    const appliedAt = new Date().toISOString()
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({
        rpcResult: { ok: true, redemption_id: 'r-uuid', applied_at: appliedAt },
      }) as unknown as ReturnType<typeof createServerClient>
    )

    const redemption = await applyCode('order-id', 'code-id', 5000, 'user-id')
    expect(redemption.id).toBe('r-uuid')
    expect(redemption.discount_amount_cents).toBe(5000)
    expect(redemption.order_id).toBe('order-id')
  })

  it('RPC에서 max_uses_exceeded 반환 시 에러를 던진다 (race condition)', async () => {
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({
        rpcResult: { ok: false, reason: 'max_uses_exceeded' },
      }) as unknown as ReturnType<typeof createServerClient>
    )

    await expect(
      applyCode('order-id', 'code-id', 5000)
    ).rejects.toThrow(/max_uses_exceeded/)
  })

  it('RPC 호출 인자가 올바르다', async () => {
    const fakeRpc = vi.fn().mockResolvedValue({
      data: { ok: true, redemption_id: 'r-uuid', applied_at: new Date().toISOString() },
      error: null,
    })
    mockCreateServerClient.mockReturnValue({ from: vi.fn(), rpc: fakeRpc } as unknown as ReturnType<typeof createServerClient>)

    await applyCode('order-id', 'code-id', 3000, 'user-id')
    expect(fakeRpc).toHaveBeenCalledWith('print_redeem_promo_code', {
      p_code_id: 'code-id',
      p_order_id: 'order-id',
      p_user_id: 'user-id',
      p_discount_amount_cents: 3000,
    })
  })
})
