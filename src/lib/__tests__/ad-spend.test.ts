import { describe, it, expect } from 'vitest'
import { parseGoogleAdsRows, parseMetaInsights, dateRange } from '@/lib/ad-spend'

describe('parseGoogleAdsRows (OMO-2595)', () => {
  it('cost_micros를 통화 단위로 환산하고 int64 문자열을 숫자화', () => {
    const rows = parseGoogleAdsRows([
      {
        campaign: { name: '  Brand Search ' },
        segments: { date: '2026-06-05' },
        customer: { currencyCode: 'USD' },
        metrics: { costMicros: '12340000', impressions: '1000', clicks: '42', conversions: 3.5 },
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      spend_date: '2026-06-05',
      channel: 'google_ads',
      campaign: 'Brand Search',
      spend_usd: 12.34,
      impressions: 1000,
      clicks: 42,
      conversions: 3.5,
      source: 'google_ads',
      currency: 'USD',
    })
  })

  it('date 없는 행은 건너뛰고, 캠페인명 부재 시 (all)', () => {
    const rows = parseGoogleAdsRows([
      { segments: {}, metrics: { costMicros: '1000000' } },
      { segments: { date: '2026-06-05' }, metrics: {} },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].campaign).toBe('(all)')
    expect(rows[0].spend_usd).toBe(0)
    expect(rows[0].currency).toBe('USD') // fallback
  })
})

describe('parseMetaInsights (OMO-2595)', () => {
  it('actions[]에서 구매 전환만 합산', () => {
    const rows = parseMetaInsights([
      {
        date_start: '2026-06-05',
        campaign_name: 'Retargeting',
        spend: '55.50',
        impressions: '2000',
        clicks: '88',
        account_currency: 'USD',
        actions: [
          { action_type: 'link_click', value: '88' },
          { action_type: 'offsite_conversion.fb_pixel_purchase', value: '4' },
          { action_type: 'purchase', value: '1' },
        ],
      },
    ])
    expect(rows[0]).toMatchObject({
      spend_date: '2026-06-05',
      channel: 'meta',
      campaign: 'Retargeting',
      spend_usd: 55.5,
      impressions: 2000,
      clicks: 88,
      conversions: 5, // 4 + 1, link_click 제외
      source: 'meta',
    })
  })

  it('actions 없으면 conversions 0', () => {
    const rows = parseMetaInsights([{ date_start: '2026-06-05', spend: '10' }])
    expect(rows[0].conversions).toBe(0)
    expect(rows[0].campaign).toBe('(all)')
  })
})

describe('dateRange (폐구간, 오늘 포함)', () => {
  it('days=3 → 오늘 포함 최근 3일', () => {
    const now = Date.parse('2026-06-07T09:00:00Z')
    expect(dateRange(now, 3)).toEqual({ since: '2026-06-05', until: '2026-06-07' })
  })
  it('days=1 → 오늘 하루', () => {
    const now = Date.parse('2026-06-07T09:00:00Z')
    expect(dateRange(now, 1)).toEqual({ since: '2026-06-07', until: '2026-06-07' })
  })
})
