import { describe, it, expect } from 'vitest'
import {
  lookupSwadpiaCost,
  calculatePriceFromSwadpia,
  buildSwadpiaPricingTable,
} from '@/lib/pricing'
import type { SwadpiaPrintEntry } from '@/lib/swadpia'

/**
 * OMO-3593 회귀 가드: 가격계산 서버사이드 이동이 고객 표시가(USD)를 바꾸지 않음을 증명한다.
 *
 * 이전(클라이언트): printEntries(도매 KRW) → lookupSwadpiaCost → calculatePriceFromSwadpia → USD
 * 이후(서버):       buildSwadpiaPricingTable → table[paperCode][qty].totalUsd (USD only, KRW 비노출)
 *
 * 두 경로가 비트단위로 동일한 USD 를 내는지 검증 → "고객 표시 USD 불변" 수용기준 충족.
 */

// 명함(CNC1000) 격자 일부를 모사한 픽스처 — 도매 KRW 단가(print_unit2)와 수량 사다리.
const ENTRIES: SwadpiaPrintEntry[] = [
  { quantity: 200, paper_code: 'P1', print_method: 'PTM10', print_unit1: 8000, print_unit2: 9000, add_unit2: 0 },
  { quantity: 500, paper_code: 'P1', print_method: 'PTM10', print_unit1: 11000, print_unit2: 12500, add_unit2: 0 },
  { quantity: 1000, paper_code: 'P1', print_method: 'PTM10', print_unit1: 16000, print_unit2: 18000, add_unit2: 0 },
  { quantity: 500, paper_code: 'P2', print_method: 'PTM10', print_unit1: 13000, print_unit2: 15000, add_unit2: 0 },
  { quantity: 1000, paper_code: 'P2', print_method: 'PTM10', print_unit1: 19000, print_unit2: 22000, add_unit2: 0 },
  // "전화문의"(print_unit2<=0) — 가격경로에서 제외돼야 한다.
  { quantity: 3000, paper_code: 'P3', print_method: 'PTM10', print_unit1: 0, print_unit2: 0, add_unit2: 0 },
]

const MARGIN = 3.3
const RATE = 1 / 1525 // USD per KRW

// 고객이 선택 가능한 수량(옵션값) ∪ 기본값 100. 보간(nearest-higher) 케이스 포함: 100, 300.
const QUANTITIES = [100, 200, 300, 500, 1000, 1500]

function oldClientUsd(paperCode: string, qty: number): number | null {
  const sw = lookupSwadpiaCost(ENTRIES, paperCode, qty)
  if (sw === null || sw.costKrw <= 0) return null
  return calculatePriceFromSwadpia({ swadpiaCostKrw: sw.costKrw, marginMultiplier: MARGIN, exchangeRate: RATE })
}

describe('OMO-3593 buildSwadpiaPricingTable — customer USD parity', () => {
  const table = buildSwadpiaPricingTable({
    printEntries: ENTRIES,
    quantities: QUANTITIES,
    marginMultiplier: MARGIN,
    exchangeRate: RATE,
  })

  it('유효 용지코드만(print_unit2>0) 순서 보존하여 포함', () => {
    expect(table.validPaperCodes).toEqual(['P1', 'P2'])
    expect(table.useSwadpia).toBe(true)
  })

  it('모든 (paperCode, qty) 셀의 USD 가 이전 클라이언트 경로와 비트단위 동일', () => {
    for (const code of ['P1', 'P2']) {
      for (const qty of QUANTITIES) {
        const expected = oldClientUsd(code, qty)
        const cell = table.table[code]?.[String(qty)]
        if (expected === null) {
          expect(cell).toBeUndefined()
        } else {
          expect(cell).toBeDefined()
          // toFixed(2) 표시가뿐 아니라 raw double 까지 동일해야 한다.
          expect(cell!.totalUsd).toBe(expected)
        }
      }
    }
  })

  it('effectiveQty(성원 반올림 수량)도 이전 lookup 과 동일 — 프로모/단가 표시 정합', () => {
    // qty=100 → 200 으로 반올림(P1 최소 200). qty=300 → 500.
    expect(table.table['P1']['100'].effectiveQty).toBe(200)
    expect(table.table['P1']['300'].effectiveQty).toBe(500)
    expect(table.table['P1']['1000'].effectiveQty).toBe(1000)
    // 사다리 초과(1500) → 최댓값(1000) 으로 클램프.
    expect(table.table['P1']['1500'].effectiveQty).toBe(1000)
  })

  it('printEntries 가 비면 useSwadpia=false (실시간 배지 게이트 원본과 동일)', () => {
    const empty = buildSwadpiaPricingTable({ printEntries: [], quantities: QUANTITIES, marginMultiplier: MARGIN, exchangeRate: RATE })
    expect(empty.useSwadpia).toBe(false)
    expect(empty.validPaperCodes).toEqual([])
  })

  it('클라이언트 페이로드에 도매 KRW 필드가 존재하지 않음(직렬화 누출 방지)', () => {
    const serialized = JSON.stringify(table)
    // 픽스처 도매 단가가 그대로 직렬화되면 안 됨.
    for (const krw of ['9000', '12500', '18000', '15000', '22000', 'print_unit', 'costKrw']) {
      expect(serialized).not.toContain(krw)
    }
  })
})
