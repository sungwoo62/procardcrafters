/**
 * OMO-3190 — 수량 기반 배송 예상 무게 산출 단위 검증.
 *
 * 보장:
 *  - 평량(gsm) × 재단면적 × 수량 = 종이 무게 (수량 증가 시 선형 증가).
 *  - gsm 텍스트 추출(라벨/값에서 "350g", "300gsm").
 *  - 박스 tier 선택 + tare 가산, overflow 비례 가산.
 *  - calculateOrderWeightKg: 물리 산식 > unit_weight_g > default 우선순위 + 단일 박스 tare.
 *
 * 실행: npx vitest run src/lib/__tests__/weight-estimate.test.ts
 */
import { describe, it, expect } from 'vitest'
import { extractGsm, estimateItemWeight, pickBox, BOX_TIERS } from '@/lib/weight-estimate'
import { calculateOrderWeightKg } from '@/lib/shipping'

describe('extractGsm', () => {
  it('라벨/값에서 평량을 추출한다', () => {
    expect(extractGsm('스노우지 350g')).toBe(350)
    expect(extractGsm('Snow 300gsm')).toBe(300)
    expect(extractGsm('snow_250')).toBe(250)
    expect(extractGsm(null, undefined, '아트 150g')).toBe(150)
  })
  it('평량이 없거나 비현실적이면 null', () => {
    expect(extractGsm('coated paper')).toBeNull()
    expect(extractGsm('5g')).toBeNull()      // 30 미만
    expect(extractGsm('9999g')).toBeNull()   // 1200 초과
  })
})

describe('estimateItemWeight', () => {
  it('명함(90×50, 300gsm) 1매 ≈ 1.35g, 수량 선형', () => {
    const one = estimateItemWeight({ gsm: 300, sheetWidthMm: 90, sheetHeightMm: 50, quantity: 1 })
    // 300 × (90×50/1e6) = 300 × 0.0045 = 1.35g
    expect(one.paperWeightG).toBeCloseTo(1.35, 2)
    const fiveHundred = estimateItemWeight({ gsm: 300, sheetWidthMm: 90, sheetHeightMm: 50, quantity: 500 })
    expect(fiveHundred.paperWeightG).toBeCloseTo(675, 1) // 1.35 × 500
  })
  it('수량이 늘면 무게가 늘고 박스 tier 가 커진다', () => {
    const small = estimateItemWeight({ gsm: 300, sheetWidthMm: 90, sheetHeightMm: 50, quantity: 100 })
    const large = estimateItemWeight({ gsm: 300, sheetWidthMm: 90, sheetHeightMm: 50, quantity: 5000 })
    expect(large.totalKg).toBeGreaterThan(small.totalKg)
    expect(large.boxTareG).toBeGreaterThanOrEqual(small.boxTareG)
  })
  it('치수/평량 미지정 시 안전 기본값으로 양수 무게', () => {
    const r = estimateItemWeight({ quantity: 10 })
    expect(r.paperWeightG).toBeGreaterThan(0)
    expect(r.gsmUsed).toBe(200)
  })
})

describe('pickBox', () => {
  it('무게에 맞는 최소 tier 선택', () => {
    expect(pickBox(200).tier?.label).toBe('mailer-S')
    expect(pickBox(900).tier?.label).toBe('box-S')
    expect(pickBox(2500).tier?.label).toBe('box-M')
  })
  it('최대 tier 초과 시 비례 가산', () => {
    const largest = BOX_TIERS[BOX_TIERS.length - 1]
    const over = pickBox(largest.maxPaperWeightG + 5000)
    expect(over.tareG).toBeGreaterThan(largest.tareG)
  })
})

describe('calculateOrderWeightKg', () => {
  it('물리 산식 경로: 수량 변화가 총 무게에 반영된다', () => {
    const w100 = calculateOrderWeightKg([
      { quantity: 1, basis_weight_gsm: 300, sheet_width_mm: 90, sheet_height_mm: 50, selected_options: { quantity: '100' } },
    ])
    const w1000 = calculateOrderWeightKg([
      { quantity: 1, basis_weight_gsm: 300, sheet_width_mm: 90, sheet_height_mm: 50, selected_options: { quantity: '1000' } },
    ])
    expect(w1000).toBeGreaterThan(w100)
  })
  it('박스 tare 가 항상 더해진다 (일괄 고정 아님)', () => {
    const w = calculateOrderWeightKg([
      { quantity: 1, basis_weight_gsm: 300, sheet_width_mm: 90, sheet_height_mm: 50, selected_options: { quantity: '100' } },
    ])
    // 종이 135g + mailer-S tare 40g = 175g = 0.175kg
    expect(w).toBeCloseTo(0.175, 3)
  })
  it('gsm 없으면 unit_weight_g 경로로 fallback', () => {
    const w = calculateOrderWeightKg([
      { quantity: 1, unit_weight_g: 1.0, selected_options: { quantity: '500' } },
    ])
    // 500g 종이 + box-S tare 120g = 620g
    expect(w).toBeCloseTo(0.62, 3)
  })
  it('빈/0 무게는 0.5kg 하한', () => {
    expect(calculateOrderWeightKg([])).toBe(0.5)
  })
})
