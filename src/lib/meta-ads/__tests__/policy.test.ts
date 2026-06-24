import { describe, it, expect } from 'vitest'
import {
  ACCOUNT_CURRENCY,
  DAILY_BUDGET_MINOR,
  PROCARD_TOTAL_CAP_MINOR,
  PROCARD_PREFIX,
  PROCARD_INSTAGRAM_ACTOR_ID,
  NUTRA_FORBIDDEN_PIXEL_ID,
  toMinorUnits,
  formatMinor,
  withProcardPrefix,
  isProcardName,
  assertProcardIdentity,
  assertProcardPixel,
  buildCampaignPayload,
  buildAdsetPayload,
  buildCreativePayload,
  buildAdPayload,
} from '../policy'

describe('통화: KRW 단위 (OMO-3752)', () => {
  it('KRW는 offset 0 → 원 단위 그대로', () => {
    expect(ACCOUNT_CURRENCY).toBe('KRW')
    expect(toMinorUnits(30000)).toBe(30000)
    expect(DAILY_BUDGET_MINOR).toBe(30000)
    expect(PROCARD_TOTAL_CAP_MINOR).toBe(800000)
  })

  it('formatMinor: ₩ 천단위 구분', () => {
    expect(formatMinor(30000)).toBe('₩30,000')
  })
})

describe('PROCARD 네이밍 강제', () => {
  it('프리픽스 멱등 적용', () => {
    expect(withProcardPrefix('POD MVP')).toBe('PROCARD — POD MVP')
    expect(withProcardPrefix('PROCARD — POD MVP')).toBe('PROCARD — POD MVP')
  })

  it('isProcardName: 프리픽스 판별', () => {
    expect(isProcardName('PROCARD — X')).toBe(true)
    expect(isProcardName('Nutrabiovis 콜라겐')).toBe(false)
    expect(isProcardName(undefined)).toBe(false)
  })
})

describe('혼용 차단 가드', () => {
  it('page_id 없으면 throw', () => {
    expect(() => assertProcardIdentity({})).toThrow(/page_id/)
  })

  it('IG actor가 procard와 불일치하면 throw', () => {
    expect(() =>
      assertProcardIdentity({ page_id: '123', instagram_actor_id: '99999' }),
    ).toThrow(/불일치/)
  })

  it('procard IG actor면 통과', () => {
    expect(() =>
      assertProcardIdentity({ page_id: '123', instagram_actor_id: PROCARD_INSTAGRAM_ACTOR_ID }),
    ).not.toThrow()
  })

  it('뉴트라 메인 픽셀이면 throw', () => {
    expect(() => assertProcardPixel(NUTRA_FORBIDDEN_PIXEL_ID)).toThrow(/뉴트라/)
  })

  it('procard 픽셀/미지정이면 통과', () => {
    expect(() => assertProcardPixel('1421706653319003')).not.toThrow()
    expect(() => assertProcardPixel(null)).not.toThrow()
  })
})

describe('payload 빌더 (토큰 불필요 dry-run)', () => {
  it('캠페인: PROCARD 네이밍 + PAUSED', () => {
    const p = buildCampaignPayload('POD MVP W1', 'OUTCOME_SALES')
    expect(p.name).toBe('PROCARD — POD MVP W1')
    expect(p.status).toBe('PAUSED')
    expect(p.special_ad_categories).toEqual([])
  })

  it('광고세트: KRW daily_budget + procard 픽셀 promoted_object', () => {
    const p = buildAdsetPayload({
      name: 'POD MVP W1',
      campaignId: 'c1',
      targeting: { geo_locations: { countries: ['US'] } },
      dailyBudgetMinor: DAILY_BUDGET_MINOR,
      pixelId: '1421706653319003',
    })
    expect(p.name).toBe('PROCARD — POD MVP W1 — AdSet')
    expect(p.daily_budget).toBe(30000) // KRW 원 단위 (cents 아님)
    expect(p.status).toBe('PAUSED')
    expect(p.promoted_object).toEqual({
      pixel_id: '1421706653319003',
      custom_event_type: 'PURCHASE',
    })
  })

  it('광고세트: 뉴트라 픽셀 주입 시 throw', () => {
    expect(() =>
      buildAdsetPayload({
        name: 'X',
        campaignId: 'c1',
        targeting: {},
        dailyBudgetMinor: DAILY_BUDGET_MINOR,
        pixelId: NUTRA_FORBIDDEN_PIXEL_ID,
      }),
    ).toThrow(/뉴트라/)
  })

  it('소재: procard 신원(page+IG)을 object_story_spec에 주입', () => {
    const p = buildCreativePayload(
      'POD MVP W1',
      { page_id: '1115260595012450', instagram_actor_id: PROCARD_INSTAGRAM_ACTOR_ID },
      { message: 'Pro business cards, fast.' },
    )
    expect(p.name).toBe('PROCARD — POD MVP W1 — Creative')
    const spec = p.object_story_spec as Record<string, unknown>
    expect(spec.page_id).toBe('1115260595012450')
    expect(spec.instagram_actor_id).toBe(PROCARD_INSTAGRAM_ACTOR_ID)
  })

  it('광고: PROCARD 네이밍 + PAUSED', () => {
    const p = buildAdPayload('POD MVP W1', 'as1', 'cr1')
    expect(p.name).toBe('PROCARD — POD MVP W1')
    expect(p.status).toBe('PAUSED')
  })

  it('프리픽스 상수', () => {
    expect(PROCARD_PREFIX).toBe('PROCARD —')
  })
})
