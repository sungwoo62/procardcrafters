// OMO-3457: printcity 명함 후가공 surcharge 해석 검증.
import { describe, it, expect } from 'vitest'
import {
  FINISHING,
  getProductFinishing,
  finishingSurchargeKrw,
  finishingTotalKrw,
} from '@/lib/printcity-finishing'

const GOGEUP = '679c60008db6e006523747b9' // 고급 명함
const works = getProductFinishing(GOGEUP)
const byType = (t: string) => works.find((w) => w.workType === t)!

describe('OMO-3457 printcity 명함 후가공', () => {
  it('데이터가 16제품 로드되고 고급명함은 10 work-link', () => {
    expect(FINISHING.products.length).toBe(16)
    expect(works.length).toBe(10)
  })

  it('박(per_order)은 수량브래킷 고정 셋업비 — 금박유광 앞면 200매=4,000원', () => {
    const bak = byType('bak')
    expect(bak.pricing).toBe('per_order')
    expect(finishingSurchargeKrw(bak, ['BKS:1F', 'BKK:GOLD-GS'], 200)).toBe(4000)
    // 801~1200매 브래킷 = 5,000원
    expect(finishingSurchargeKrw(bak, ['BKS:1F', 'BKK:GOLD-GS'], 1000)).toBe(5000)
  })

  it('타공(per_unit)은 매당 단가×수량 — ⌀3mm 1개 200매=10원×200=2,000원', () => {
    const tg = byType('tagong')
    expect(tg.pricing).toBe('per_unit')
    expect(finishingSurchargeKrw(tg, ['TGR:3', 'TGH:1'], 200)).toBe(2000)
  })

  it('오시(per_order) 1선 200매 = 5,000원(0~500 브래킷)', () => {
    expect(finishingSurchargeKrw(byType('osi'), ['OSL:1'], 200)).toBe(5000)
  })

  it('귀도리(per_unit) 200매 = 10원×200 = 2,000원', () => {
    const gd = byType('guido')
    expect(gd.pricing).toBe('per_unit')
    expect(finishingSurchargeKrw(gd, gd.options[0].codes, 200)).toBe(2000)
  })

  it('미선택 work 는 합계 0, 다중 선택은 합산', () => {
    const empty = finishingTotalKrw(works, {}, 200)
    expect(empty.total).toBe(0)

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
    const bak = byType('bak')
    expect(finishingSurchargeKrw(bak, ['BKS:1F', 'BKK:GOLD-GS'], 999999)).not.toBeNull()
  })
})
