/**
 * OMO-3061 — 수량 기반 디지털/옵셋 자동 라우팅 단위 검증
 *
 * lookupPressCost / pickCheapestPress 의 순수 로직을, 명함(business-cards)의
 * 라이브 검증 가격(scripts/omo3061-verify.mjs 캡처)으로 검증한다. 핵심 보장:
 *  - 디지털(CDP1000)은 최대 400부까지만 생산 가능 → 그 이상은 옵셋만 eligible.
 *  - 옵셋(CNC1000)은 최소 200부(gang-run) → 요청 수량을 다음 단계로 라운드업.
 *  - 각 수량에서 더 싸거나 유일하게 가능한 프레스를 자동 선택.
 *    · 초소량(q1): 디지털이 저렴(600 vs 옵셋 4,000@200) → 디지털.
 *    · 소~중량(q10~200): 옵셋이 압도적 저렴 → 옵셋(라운드업 promo).
 *    · 대량(q500+): 디지털 불가(>400) → 옵셋.
 *
 * 실행: npx vitest run src/lib/__tests__/swadpia-press-routing.test.ts
 */
import { describe, it, expect } from 'vitest'
import { lookupPressCost, pickCheapestPress, type SwadpiaPrintEntry, type PressEntrySet } from '../swadpia'

// 라이브 캡처(명함, 양면 print_unit2) 단순화 매트릭스.
// 옵셋 CNC1000: 200부부터, gang-run 으로 장당 원가 거의 0.
const OFFSET: SwadpiaPrintEntry[] = [
  { quantity: 200, paper_code: 'SNW250CT0', print_method: 'PTM10', print_unit1: 4000, print_unit2: 4000, add_unit2: 0 },
  { quantity: 500, paper_code: 'SNW250CT0', print_method: 'PTM10', print_unit1: 3000, print_unit2: 3000, add_unit2: 0 },
  { quantity: 1000, paper_code: 'SNW250CT0', print_method: 'PTM10', print_unit1: 6000, print_unit2: 6000, add_unit2: 0 },
]
// 디지털 인디고 CDP1000: 1~400부, 장당 단가 높음.
const DIGITAL: SwadpiaPrintEntry[] = [
  { quantity: 1, paper_code: 'VNV186W00', print_method: 'PTM10', print_unit1: 600, print_unit2: 600, add_unit2: 0 },
  { quantity: 10, paper_code: 'VNV186W00', print_method: 'PTM10', print_unit1: 5850, print_unit2: 5850, add_unit2: 0 },
  { quantity: 100, paper_code: 'VNV186W00', print_method: 'PTM10', print_unit1: 51750, print_unit2: 51750, add_unit2: 0 },
  { quantity: 200, paper_code: 'VNV186W00', print_method: 'PTM10', print_unit1: 88500, print_unit2: 88500, add_unit2: 0 },
  { quantity: 400, paper_code: 'VNV186W00', print_method: 'PTM10', print_unit1: 170000, print_unit2: 170000, add_unit2: 0 },
]

const presses: PressEntrySet[] = [
  { press: 'offset', categoryCode: 'CNC1000', entries: OFFSET },
  { press: 'digital', categoryCode: 'CDP1000', entries: DIGITAL },
]

describe('lookupPressCost — eligibility & round-up', () => {
  it('옵셋: 요청 100부는 최소 단계 200으로 라운드업', () => {
    const r = lookupPressCost(OFFSET, 100)
    expect(r).not.toBeNull()
    expect(r!.effectiveQty).toBe(200)
    expect(r!.costKrw).toBe(4000)
  })

  it('디지털: 최대 생산량(400) 초과 요청은 null(생산 불가)', () => {
    expect(lookupPressCost(DIGITAL, 500)).toBeNull()
  })

  it('옵셋: 정확 일치 단계는 그대로', () => {
    const r = lookupPressCost(OFFSET, 500)
    expect(r!.effectiveQty).toBe(500)
    expect(r!.costKrw).toBe(3000)
  })

  it('print_unit2<=0(전화문의) 항목은 제외', () => {
    const phoneOnly: SwadpiaPrintEntry[] = [
      { quantity: 200, paper_code: 'X', print_method: 'PTM10', print_unit1: 0, print_unit2: 0, add_unit2: 0 },
    ]
    expect(lookupPressCost(phoneOnly, 200)).toBeNull()
  })
})

describe('pickCheapestPress — 수량별 최저가/유일 프레스 자동 선택', () => {
  it('초소량 q1 → 디지털(600 < 옵셋 4,000@200)', () => {
    const p = pickCheapestPress(1, presses)
    expect(p!.press).toBe('digital')
    expect(p!.costKrw).toBe(600)
  })

  it('q10 → 옵셋(4,000@200 < 디지털 5,850), 라운드업 promo', () => {
    const p = pickCheapestPress(10, presses)
    expect(p!.press).toBe('offset')
    expect(p!.effectiveQty).toBe(200)
    expect(p!.costKrw).toBe(4000)
  })

  it('q200 → 옵셋(4,000 << 디지털 88,500)', () => {
    const p = pickCheapestPress(200, presses)
    expect(p!.press).toBe('offset')
    expect(p!.costKrw).toBe(4000)
  })

  it('q500 → 디지털 불가(>400) → 옵셋 유일', () => {
    const p = pickCheapestPress(500, presses)
    expect(p!.press).toBe('offset')
    expect(p!.costKrw).toBe(3000)
  })

  it('모든 프레스 불가 시 null', () => {
    // 디지털만 있고 최대 400인데 1000 요청 → null
    expect(pickCheapestPress(1000, [{ press: 'digital', categoryCode: 'CDP1000', entries: DIGITAL }])).toBeNull()
  })

  it('preferredPaper 가 해당 단계에 있으면 우선 선택', () => {
    const mixed: SwadpiaPrintEntry[] = [
      { quantity: 200, paper_code: 'CHEAP', print_method: 'PTM10', print_unit1: 3000, print_unit2: 3000, add_unit2: 0 },
      { quantity: 200, paper_code: 'PREMIUM', print_method: 'PTM10', print_unit1: 5000, print_unit2: 5000, add_unit2: 0 },
    ]
    expect(lookupPressCost(mixed, 200)!.paperCode).toBe('CHEAP') // 미지정 → 최저가
    expect(lookupPressCost(mixed, 200, 'PREMIUM')!.paperCode).toBe('PREMIUM') // 지정 → 그 종이
  })
})
