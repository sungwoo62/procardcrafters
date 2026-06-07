import { describe, it, expect } from 'vitest'
import { sanitizeAttribution, deriveChannel } from '@/lib/attribution'

describe('sanitizeAttribution (체크아웃 신뢰 경계, OMO-2594)', () => {
  it('신호 없으면 전 컬럼 null (→ direct)', () => {
    const cols = sanitizeAttribution(undefined)
    expect(cols.utm_source).toBeNull()
    expect(cols.gclid).toBeNull()
    expect(cols.referrer_host).toBeNull()
    expect(deriveChannel(cols)).toBe('direct')
  })

  it('유효 페이로드를 trim 후 보존', () => {
    const cols = sanitizeAttribution({
      utm_source: '  google ',
      utm_medium: 'cpc',
      gclid: 'abc123',
      landing_path: '/products/business-cards?utm_source=google',
      referrer_host: 'www.google.com',
    })
    expect(cols.utm_source).toBe('google')
    expect(cols.utm_medium).toBe('cpc')
    expect(cols.gclid).toBe('abc123')
    expect(deriveChannel(cols)).toBe('paid_search')
  })

  it('문자열 아닌 값/객체 아님 → null (throw 금지, P0 안전)', () => {
    const cols = sanitizeAttribution({ utm_source: 123, gclid: { x: 1 }, fbclid: null })
    expect(cols.utm_source).toBeNull()
    expect(cols.gclid).toBeNull()
    expect(cols.fbclid).toBeNull()
    expect(() => sanitizeAttribution('not-an-object')).not.toThrow()
    expect(() => sanitizeAttribution(42)).not.toThrow()
  })

  it('과도한 길이는 잘라낸다 (utm 255 / clickid 512)', () => {
    const cols = sanitizeAttribution({
      utm_source: 'x'.repeat(1000),
      gclid: 'g'.repeat(1000),
    })
    expect(cols.utm_source?.length).toBe(255)
    expect(cols.gclid?.length).toBe(512)
  })

  it('빈 문자열/공백은 null 로 정규화', () => {
    const cols = sanitizeAttribution({ utm_source: '   ', utm_campaign: '' })
    expect(cols.utm_source).toBeNull()
    expect(cols.utm_campaign).toBeNull()
  })
})
