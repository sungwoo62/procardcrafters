/**
 * OMO-3241 — 매트릭스 라우팅 코어 룩업/보간 단위 검증.
 *
 * 보장:
 *  - qty 정확매치 = sampled, 표본 사이 = piecewise-linear 보간, 범위 밖 = clamped(끝값).
 *  - lookupMatrixCell: 조합(size/paper/side/pct) 필터 + 단일조합 보장. 모호하면 null(폴백 유도).
 *  - 미스(조합 부재/모호) → null → 호출측 기존 경로 폴백(회귀금지).
 *
 * 표본값은 라이브 적재(print_swadpia_price_matrix, CPR3000 leaflets)에서 채취.
 * 실행: npx vitest run src/lib/__tests__/swadpia-matrix-core.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  interpolateByQty,
  lookupMatrixCell,
  isMatrixRoutedCategory,
  deriveMatrixKey,
  type MatrixCell,
} from '@/lib/swadpia-matrix-core'

// 라이브 적재 발췌 — leaflets CPR3000 / A0300 / ART100W00 / side1, PTM10·PTM20 두 인쇄방식.
const PTM10 = (qty: number, total: number): MatrixCell => ({
  size_code: 'A0300', paper_code: 'ART100W00', side: 1, print_color_type: 'PTM10', qty, total_price_krw: total, source: 'sampled',
})
const PTM20 = (qty: number, total: number): MatrixCell => ({
  size_code: 'A0300', paper_code: 'ART100W00', side: 1, print_color_type: 'PTM20', qty, total_price_krw: total, source: 'sampled',
})
const CELLS: MatrixCell[] = [
  PTM10(1000, 120400), PTM10(2000, 148300), PTM10(4000, 239900), PTM10(8000, 385200),
  PTM20(1000, 150000), PTM20(2000, 190000),
]

describe('interpolateByQty', () => {
  const series = [PTM10(1000, 120400), PTM10(2000, 148300), PTM10(4000, 239900), PTM10(8000, 385200)]

  it('정확 qty = sampled', () => {
    expect(interpolateByQty(series, 2000)).toEqual({ totalPriceKrw: 148300, source: 'sampled', resolvedQty: 2000 })
  })
  it('표본 사이 = 선형보간 (qty 3000 = 2000·4000 중점)', () => {
    expect(interpolateByQty(series, 3000)).toEqual({ totalPriceKrw: 194100, source: 'interpolated', resolvedQty: 3000 })
  })
  it('최소 미만 = 끝값 고정(clamped)', () => {
    expect(interpolateByQty(series, 500)).toEqual({ totalPriceKrw: 120400, source: 'clamped', resolvedQty: 1000 })
  })
  it('최대 초과 = 끝값 고정(clamped)', () => {
    expect(interpolateByQty(series, 99999)).toEqual({ totalPriceKrw: 385200, source: 'clamped', resolvedQty: 8000 })
  })
  it('빈 시계열 = null', () => {
    expect(interpolateByQty([], 1000)).toBeNull()
  })
})

describe('lookupMatrixCell', () => {
  it('완전 조합 지정 → sampled 룩업', () => {
    const hit = lookupMatrixCell(CELLS, {
      categoryCode: 'CPR3000', sizeCode: 'A0300', paperCode: 'ART100W00', side: 1, printColorType: 'PTM10', qty: 4000,
    })
    expect(hit?.totalPriceKrw).toBe(239900)
    expect(hit?.source).toBe('sampled')
  })

  it('pct 미지정 + 다중 인쇄방식 → 모호 → null (폴백 유도)', () => {
    const hit = lookupMatrixCell(CELLS, { categoryCode: 'CPR3000', sizeCode: 'A0300', paperCode: 'ART100W00', qty: 2000 })
    expect(hit).toBeNull()
  })

  it('조합 부재(미보유 용지) → null', () => {
    const hit = lookupMatrixCell(CELLS, { categoryCode: 'CPR3000', sizeCode: 'A0300', paperCode: 'NOPE000', qty: 2000 })
    expect(hit).toBeNull()
  })

  it('단일조합으로 좁혀지면(빈 pct) 룩업', () => {
    const blankPct: MatrixCell[] = [
      { size_code: 'A2', paper_code: 'MGC120CG0', side: 1, print_color_type: '', qty: 100, total_price_krw: 50000, source: 'sampled' },
      { size_code: 'A2', paper_code: 'MGC120CG0', side: 1, print_color_type: '', qty: 200, total_price_krw: 70000, source: 'sampled' },
    ]
    const hit = lookupMatrixCell(blankPct, { categoryCode: 'CPR2000', sizeCode: 'A2', paperCode: 'MGC120CG0', qty: 150 })
    expect(hit?.totalPriceKrw).toBe(60000) // 100·200 중점
    expect(hit?.source).toBe('interpolated')
  })
})

describe('deriveMatrixKey — 카테고리별 인쇄축 매핑', () => {
  it('leaflets(CPR3000): print_color_type → 매트릭스 pct 직접', () => {
    expect(deriveMatrixKey('CPR3000', { paper_size: 'A0400', paper_code: 'ART100W00', print_color_type: 'PTM10' }))
      .toEqual({ sizeCode: 'A0400', paperCode: 'ART100W00', side: undefined, printColorType: 'PTM10' })
  })
  it('posters(CPR2000): 인쇄축 없음 → pct=""', () => {
    expect(deriveMatrixKey('CPR2000', { paper_size: 'A0300', paper_code: 'ART100W00' }))
      .toEqual({ sizeCode: 'A0300', paperCode: 'ART100W00', side: undefined, printColorType: '' })
  })
  it('postcards(CDP3000): DPD10→side1·DPD20→side2, pct=""(매트릭스가 side 로 단/양면 인코딩)', () => {
    expect(deriveMatrixKey('CDP3000', { paper_size: 'V0500', paper_code: 'SNW120W00', print_color_type: 'DPD20' }))
      .toEqual({ sizeCode: 'V0500', paperCode: 'SNW120W00', side: 2, printColorType: '' })
  })
  it('비라우팅 카테고리(CNC1000 명함) → null', () => {
    expect(deriveMatrixKey('CNC1000', { paper_size: '90x50' })).toBeNull()
  })
})

describe('isMatrixRoutedCategory', () => {
  it('라우팅 대상만 true', () => {
    expect(isMatrixRoutedCategory('CPR3000')).toBe(true)
    expect(isMatrixRoutedCategory('CDP3000')).toBe(true)
    expect(isMatrixRoutedCategory('CNC1000')).toBe(false) // 단일포맷 명함 — 제외
    expect(isMatrixRoutedCategory(null)).toBe(false)
  })
})
