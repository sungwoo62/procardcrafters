import { describe, it, expect } from 'vitest'
import {
  NAMECARD_PARITY,
  buildParitySummary,
  PARITY_BOARD_THRESHOLD_PCT,
} from '../printcity-namecard'

// OMO-3418: 명함 컷오버 parity(printcity↔현행 성원) 승인 자료 — 결정론·구조 회귀 방지.

describe('namecard cutover parity (OMO-3418)', () => {
  it('5개 printcity base 보유 슬러그를 대표수량(100/200/500/1000)으로 산정', () => {
    const priced = NAMECARD_PARITY.slugs.filter((s) => !s.skipped && s.rows?.length)
    expect(priced.length).toBe(5)
    expect(NAMECARD_PARITY.repQtys).toEqual([100, 200, 500, 1000])
    for (const s of priced) {
      expect(s.rows!.map((r) => r.qty)).toEqual([100, 200, 500, 1000])
    }
  })

  it('parity%는 base 단가 비(margin/환율 소거) — KRW 값과 일치', () => {
    const bc = NAMECARD_PARITY.slugs.find((s) => s.slug === 'business-cards')!
    const q200 = bc.rows!.find((r) => r.qty === 200)!
    // default = printcity 단면(canonical) vs 성원 양면(현행 표시)
    const expected = Math.round(((q200.printcitySingleKrw! - q200.swadpiaDoubleKrw!) / q200.swadpiaDoubleKrw!) * 1000) / 10
    expect(q200.defaultShiftPct).toBe(expected)
  })

  it('보드 카드는 |default 이동|≥임계(30%) 항목만, 상승/하락 합과 일치', () => {
    const sum = buildParitySummary()
    expect(sum.boardCardCount).toBe(sum.movers.length)
    expect(sum.up + sum.down).toBe(sum.movers.length)
    for (const m of sum.movers) {
      expect(Math.abs(m.defaultShiftPct)).toBeGreaterThanOrEqual(PARITY_BOARD_THRESHOLD_PCT)
    }
    // premium-foil-cards 는 용지 등급차 포함(재맵핑 필요) 플래그
    const foil = sum.movers.find((m) => m.slug === 'premium-foil-cards')
    if (foil) expect(foil.paperMismatch).toBe(true)
  })
})
