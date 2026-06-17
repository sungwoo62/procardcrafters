import { describe, it, expect } from 'vitest'
import {
  getPrintcityNamecardData,
  getPrintcityFoilByQty,
  lookupPrintcityFoilKrw,
} from '../printcity-namecard'
import { supplierForSlug, isNamecardSlug } from '@/config/namecard-supplier'

// OMO-3417: printcity 명함 결선 어댑터 회귀 방지.

describe('namecard supplier flag', () => {
  it('명함 slug 만 명함으로 식별', () => {
    expect(isNamecardSlug('business-cards')).toBe(true)
    expect(isNamecardSlug('premium-foil-cards')).toBe(true)
    expect(isNamecardSlug('hardcase')).toBe(false)
  })
  it('기본 플래그(swadpia)에서는 명함 slug 도 swadpia 유지 (가격 컷오버 보드 게이트)', () => {
    // NEXT_PUBLIC_NAMECARD_SUPPLIER 미설정 = 'swadpia' 기본 → 라이브 무영향.
    expect(supplierForSlug('business-cards')).toBe('swadpia')
    expect(supplierForSlug('plaque')).toBe('swadpia')
  })
})

describe('printcity base 매트릭스 어댑터', () => {
  it('business-cards 는 printcity 용지×수량 base 사다리를 SwadpiaClientData 형태로 공급', () => {
    const d = getPrintcityNamecardData('business-cards')
    expect(d).not.toBeNull()
    expect(d!.papers.length).toBeGreaterThan(0)
    expect(d!.printEntries.length).toBeGreaterThan(0)
    // print_unit2(=base) 는 모두 양수(0/전화문의 제거됨)
    expect(d!.printEntries.every((e) => e.print_unit2 > 0)).toBe(true)
    // 동일 용지·수량축 단조 증가(combo 잡음 제거 확인)
    const code = d!.printEntries[0].paper_code
    const ladder = d!.printEntries
      .filter((e) => e.paper_code === code)
      .sort((a, b) => a.quantity - b.quantity)
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].print_unit2).toBeGreaterThanOrEqual(ladder[i - 1].print_unit2)
    }
  })
  it('매핑 없는 명함 갭(letterpress 등)은 null → 호출측 DB 폴백', () => {
    expect(getPrintcityNamecardData('letterpress-business-cards')).toBeNull()
  })
})

describe('printcity 박(foil) 수량브래킷', () => {
  it('premium-foil-cards 는 수량브래킷 byQty 를 제공(면적모델 아님)', () => {
    const f = getPrintcityFoilByQty('premium-foil-cards')
    expect(f).not.toBeNull()
    expect(Object.keys(f!.byQty).length).toBeGreaterThan(0)
  })
  it('lookupPrintcityFoilKrw 는 상위 수량브래킷으로 라운드업', () => {
    const byQty = { '100': 27000, '200': 43100, '500': 86000 }
    expect(lookupPrintcityFoilKrw(byQty, 100)).toBe(27000)
    expect(lookupPrintcityFoilKrw(byQty, 150)).toBe(43100) // 상위 브래킷
    expect(lookupPrintcityFoilKrw(byQty, 5000)).toBe(86000) // 최대
    expect(lookupPrintcityFoilKrw({}, 100)).toBe(0)
  })
})
