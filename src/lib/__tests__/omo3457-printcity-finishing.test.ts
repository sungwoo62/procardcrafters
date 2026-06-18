// OMO-3465: printcity 명함 후가공 정밀복제(전 selecter + isHide + 수량브래킷) surcharge 검증.
import { describe, it, expect } from 'vitest'
import {
  FINISHING,
  getProductFinishing,
  finishingSurchargeKrw,
  finishingTotalKrw,
  findFinishingCombo,
  defaultSelecterCodes,
} from '@/lib/printcity-finishing'

const GOGEUP = '679c60008db6e006523747b9' // 고급 명함
const works = getProductFinishing(GOGEUP)
const byType = (t: string) => works.find((w) => w.workType === t)!

describe('OMO-3465 printcity 명함 후가공 정밀복제', () => {
  it('데이터 16제품·schemaVersion 2 로드, 고급명함 10 work-link', () => {
    expect(FINISHING.products.length).toBe(16)
    expect(FINISHING.schemaVersion).toBe(2)
    expect(works.length).toBe(10)
  })

  it('박은 2 selecter(면수·종류) 모두 가격키, 종류 12색 노출', () => {
    const bak = byType('bak')
    expect(bak.selecters.map((s) => s.codeCategory)).toEqual(['bakSideCode', 'bakKindCode'])
    expect(bak.selecters.every((s) => s.priceKeying)).toBe(true)
    expect(bak.selecters[1].select.length).toBe(12)
    expect(bak.foilSizeSpec).toBe(true)
  })

  it('엠보싱은 isHide(먹) 제외 — 종류는 투명만 노출', () => {
    const embo = byType('embo')
    const kind = embo.selecters.find((s) => s.codeCategory === 'emboKindCode')!
    expect(kind.select.map((o) => o.code)).toEqual(['EBK:TRANSPARENT'])
  })

  it('타공은 사이즈+구멍수 2 selecter 보유', () => {
    const tg = byType('tagong')
    expect(tg.selecters.map((s) => s.codeCategory)).toEqual(['tagongSizeCode', 'tagongCountCode'])
    expect(tg.selecters[0].select.map((o) => o.code)).toEqual(['TGR:3', 'TGR:4', 'TGR:5', 'TGR:7'])
  })

  it('박(per_order) 수량브래킷 고정 셋업비 — 금박유광 앞면 200매=4,000 / 1000매=5,000', () => {
    const bak = byType('bak')
    expect(bak.pricing).toBe('per_order')
    expect(finishingSurchargeKrw(bak, ['BKS:1F', 'BKK:GOLD-GS'], 200)).toBe(4000)
    expect(finishingSurchargeKrw(bak, ['BKS:1F', 'BKK:GOLD-GS'], 1000)).toBe(5000)
  })

  it('타공(per_unit) 매당단가×수량 — ⌀3mm 1개 200매=10×200=2,000', () => {
    const tg = byType('tagong')
    expect(tg.pricing).toBe('per_unit')
    expect(finishingSurchargeKrw(tg, ['TGR:3', 'TGH:1'], 200)).toBe(2000)
  })

  it('오시(per_order) 1선 200매=5,000(0~500 브래킷)', () => {
    expect(finishingSurchargeKrw(byType('osi'), ['OSL:1'], 200)).toBe(5000)
  })

  it('귀도리(per_unit) 반지름은 가격무관(단일 combo) — 200매=10×200=2,000', () => {
    const gd = byType('guido')
    expect(gd.pricing).toBe('per_unit')
    // guidoRadiusCode 는 priceKeying=false → 어느 반지름이든 동일 단일 combo.
    expect(gd.selecters[0].priceKeying).toBe(false)
    expect(finishingSurchargeKrw(gd, ['GDR:4'], 200)).toBe(2000)
    expect(finishingSurchargeKrw(gd, Object.values(defaultSelecterCodes(gd)), 200)).toBe(2000)
  })

  it('가격키 부분집합 매칭 — 스펙코드가 섞여도 올바른 combo 선택', () => {
    const nb = byType('numbering')
    // numbering: NBC(가격키) + NUK:NORMAL(스펙). flat codes 에 NUK 가 끼어도 NBC 로 매칭.
    const combo = findFinishingCombo(nb, ['NBC:1', 'NUK:NORMAL'])
    expect(combo?.codes).toEqual(['NBC:1'])
  })

  it('미선택은 0, 다중 선택은 합산', () => {
    expect(finishingTotalKrw(works, {}, 200).total).toBe(0)
    const sel = {
      bak: ['BKS:1F', 'BKK:GOLD-GS'],
      osi: ['OSL:1'],
      tagong: ['TGR:3', 'TGH:1'],
    }
    const r = finishingTotalKrw(works, sel, 200)
    expect(r.total).toBe(4000 + 5000 + 2000)
    expect(r.lines.length).toBe(3)
  })

  it('범위 밖 수량도 최근접 브래킷으로 안전 산출(null 아님)', () => {
    expect(finishingSurchargeKrw(byType('bak'), ['BKS:1F', 'BKK:GOLD-GS'], 999999)).not.toBeNull()
  })
})
