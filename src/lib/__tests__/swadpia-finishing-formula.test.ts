// OMO-3512: 성원 후가공 단가 RE 결정론 구현 검증.
// 값은 raw-unpacked/postpress_class_*.unpacked.js 수식과 1:1 대응.
import { describe, it, expect } from 'vitest'
import {
  numberingPriceNbt,
  numberingPriceUnitNbt,
  numberingPriceNcr,
  bakDongpanPriceCnc,
  bakDongpanPriceCst,
  bakAmtSum,
  NUMBERING_BLOCKED_PAPERS,
} from '../swadpia-finishing-formula'

describe('① 넘버링 NBT/NBN (명함류 CNC1000)', () => {
  const base = {
    type: 'NBT10' as const,
    kind: 'NBN11' as const,
    cutXSize: 90,
    cutYSize: 50,
    paperQty: 1000,
    orderCount: 1,
    categoryCode: 'CNC1000',
  }

  it('NBT10 일반 = 바닥 38,000 (저매수에서 unit < typeRate)', () => {
    expect(numberingPriceNbt(base)).toBe(38000)
  })

  it('NBT20 난수 = 바닥 70,000', () => {
    expect(numberingPriceNbt({ ...base, type: 'NBT20' })).toBe(70000)
  })

  it('order_count 배수 적용', () => {
    expect(numberingPriceNbt({ ...base, orderCount: 3 })).toBe(38000 * 3)
  })

  it('NBN12(2개) KIND_RATE 1.2 — 고매수에서 unit*1.2 가 바닥 초과', () => {
    const single = numberingPriceNbt({ ...base, kind: 'NBN11', paperQty: 50000 })
    const dbl = numberingPriceNbt({ ...base, kind: 'NBN12', paperQty: 50000 })
    expect(dbl).toBeGreaterThan(single)
  })

  it('용지 게이트 → 0', () => {
    expect(numberingPriceNbt({ ...base, paperCode: 'SNW300W00' })).toBe(0)
    expect(numberingPriceNbt({ ...base, paperCode: 'DNT250GP0' })).toBe(0)
    expect(numberingPriceNbt({ ...base, paperCode: 'SNW250W00', matteCoated: true })).toBe(0)
    expect(NUMBERING_BLOCKED_PAPERS.has('UPP250FB0')).toBe(true)
  })

  it('unit 은 매수·면적에 단조 증가', () => {
    const u1 = numberingPriceUnitNbt({ ...base, paperQty: 1000 })
    const u2 = numberingPriceUnitNbt({ ...base, paperQty: 10000 })
    expect(u2).toBeGreaterThan(u1)
  })
})

describe('① 넘버링 NCR (양식 CNR1000)', () => {
  it('바닥 47,000', () => {
    const p = numberingPriceNcr({
      typeUnit: 1,
      cutXSize: 210,
      cutYSize: 297,
      paperPrice1: 5,
      bundleQty: 1,
      bindingQty: 1,
      doubleDigit: false,
    })
    expect(p).toBeGreaterThanOrEqual(47000)
    expect(p % 1000).toBe(0)
  })
})

describe('③ 보유동판(BKS20) setup 면제', () => {
  const dim = { bakXSize: 50, bakYSize: 30 }

  it('CNC 신규(BKS10) 동판비 > 0, 보유(BKS20) = 0', () => {
    expect(bakDongpanPriceCnc({ section: 'BKS10', ...dim })).toBeGreaterThan(0)
    expect(bakDongpanPriceCnc({ section: 'BKS20', ...dim })).toBe(0)
  })

  it('CNC 50×30 신규 동판비 = 3,500 (max(50*30*1.6+1100, 3000)→3500, ceil/100)', () => {
    expect(bakDongpanPriceCnc({ section: 'BKS10', ...dim })).toBe(3500)
  })

  it('CST 보유(BKS20) = 0, 신규는 매수 가산', () => {
    expect(bakDongpanPriceCst({ section: 'BKS20', ...dim, paperQty: 5000 })).toBe(0)
    const lo = bakDongpanPriceCst({ section: 'BKS10', ...dim, paperQty: 1000 })
    const hi = bakDongpanPriceCst({ section: 'BKS10', ...dim, paperQty: 5000 })
    expect(hi).toBeGreaterThan(lo)
  })
})

describe('② 박 멀티레이어 합산 (setPPBakAmtSum)', () => {
  it('3레이어 합산', () => {
    expect(bakAmtSum([22300, 18500, 0])).toBe(40800)
  })
  it('단일 레이어 = 그 값(부모 22,300 고정 = 레이어 2/3 미생성)', () => {
    expect(bakAmtSum([22300])).toBe(22300)
    expect(bakAmtSum([22300, NaN, NaN])).toBe(22300)
  })
})
