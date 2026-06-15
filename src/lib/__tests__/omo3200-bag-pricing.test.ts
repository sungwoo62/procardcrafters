import { describe, it, expect } from 'vitest'
import { lookupPrintCost, type SwadpiaCategoryData } from '@/lib/swadpia'
import { synthesizeBagPrintEntries, BAG_PRICE_MATRIX } from '@/config/bag-pricing'
import { calculatePriceFromSwadpia } from '@/lib/pricing'

// OMO-3200: 쇼핑백 수량별 가격엔진 연동 검증.
// calcuEstimate 인터랙티브로 추출한 도매원가 매트릭스가 기존 가격경로
// (lookupPrintCost → calculatePriceFromSwadpia)와 정확히 맞물리는지 회귀 보장.
function dataFor(code: string): SwadpiaCategoryData {
  return { categoryCode: code, papers: [], printEntries: synthesizeBagPrintEntries(code)!, sizes: [], fetchedAt: 0, fetchSuccess: true }
}

describe('OMO-3200 쇼핑백 수량별 가격 연동', () => {
  it('4종 bag code 모두 매트릭스 합성, 비-bag 은 null', () => {
    for (const c of ['CPK2000', 'CPK4000', 'CPK3000', 'CPK5000']) {
      expect(synthesizeBagPrintEntries(c)!.length).toBe(BAG_PRICE_MATRIX[c].matrix.length)
    }
    expect(synthesizeBagPrintEntries('CDP4000')).toBeNull()
  })

  it('lookupPrintCost 가 추출 도매원가를 반환 (CPK4000 종이끈)', () => {
    const d = dataFor('CPK4000')
    expect(lookupPrintCost(d, 'ART180W00', 1000)).toBe(691400)
    expect(lookupPrintCost(d, 'ART180W00', 50000)).toBe(26510800)
  })

  it('정확 수량 미존재 시 상위 수량으로 라운드업 (700→1000)', () => {
    expect(lookupPrintCost(dataFor('CPK4000'), 'ART180W00', 700)).toBe(691400)
  })

  it('모든 매트릭스 단조증가 (수량↑ → 도매원가↑)', () => {
    for (const c of Object.keys(BAG_PRICE_MATRIX)) {
      const m = BAG_PRICE_MATRIX[c].matrix
      for (let i = 1; i < m.length; i++) expect(m[i].cost_krw).toBeGreaterThanOrEqual(m[i - 1].cost_krw)
    }
  })

  it('소매가가 수량에 따라 증가하고 개당 단가는 하락 (CPK5000 소량)', () => {
    const d = dataFor('CPK5000')
    const r50 = calculatePriceFromSwadpia({ swadpiaCostKrw: lookupPrintCost(d, 'WHT160W00', 50)!, marginMultiplier: 4, exchangeRate: 1350 })
    const r100 = calculatePriceFromSwadpia({ swadpiaCostKrw: lookupPrintCost(d, 'WHT160W00', 100)!, marginMultiplier: 4, exchangeRate: 1350 })
    expect(r100).toBeGreaterThan(r50)
    expect(r100 / 100).toBeLessThan(r50 / 50)
  })
})
