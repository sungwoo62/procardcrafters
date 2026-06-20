import { describe, it, expect } from 'vitest'
import {
  evaluateFinishingGate,
  DBAK_ALLOWED_PAPERS,
  NUMBERING_BLOCKED_PAPERS,
  type FinishingToken,
} from '../finishing-gate'

// OMO-3567 (← OMO-3566 31-rules.json): 성원 chkPostPress 조합제약 규칙 평가 검증.

function sel(...tokens: FinishingToken[]): Set<FinishingToken> {
  return new Set(tokens)
}

describe('evaluateFinishingGate — 조합제약 규칙', () => {
  it('R02: 박 + 디지털박 동시선택 → dbak block', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC2000', paperCode: 'VNV233W00', selected: sel('bak', 'dbak') })
    expect(v.some((x) => x.token === 'dbak' && x.action === 'block' && x.ruleId === 'R02')).toBe(true)
  })

  it('R01: dbak 비허용 용지 → dbak block', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC1000', paperCode: 'ZZZ999X00', selected: sel('dbak') })
    expect(v.some((x) => x.token === 'dbak' && x.action === 'block' && x.ruleId === 'R01')).toBe(true)
  })

  it('R01: dbak 허용 용지(9종) → dbak block 없음', () => {
    const paper = DBAK_ALLOWED_PAPERS[0]
    const v = evaluateFinishingGate({ categoryCode: 'CNC1000', paperCode: paper, selected: sel('dbak') })
    expect(v.some((x) => x.token === 'dbak' && x.ruleId === 'R01')).toBe(false)
  })

  it('R03/R04: 넘버링 불가용지(어두움/벨벳359) → numbering block', () => {
    for (const paper of NUMBERING_BLOCKED_PAPERS) {
      const v = evaluateFinishingGate({ categoryCode: 'CNC1000', paperCode: paper, selected: sel('numbering') })
      expect(v.some((x) => x.token === 'numbering' && x.action === 'block')).toBe(true)
    }
  })

  it('R03/R04: 일반 용지 넘버링 → block 없음', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC1000', paperCode: 'SNW300W00', selected: sel('numbering') })
    expect(v.some((x) => x.token === 'numbering' && x.action === 'block')).toBe(false)
  })

  it('R05: CNC2000 에폭시 불가용지 → epoxy block', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC2000', paperCode: 'RBE359W00', selected: sel('epoxy') })
    expect(v.some((x) => x.token === 'epoxy' && x.action === 'block' && x.ruleId === 'R05')).toBe(true)
  })

  it('R05: CNC1000(타 카테고리) 동일 용지 에폭시 → block 없음', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC1000', paperCode: 'RBE359W00', selected: sel('epoxy') })
    expect(v.some((x) => x.token === 'epoxy' && x.ruleId === 'R05')).toBe(false)
  })

  it('R07: CNC6000(에폭시명함) → epoxy force_on', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC6000', paperCode: 'SNW300W00', selected: sel() })
    expect(v.some((x) => x.token === 'epoxy' && x.action === 'force_on' && x.ruleId === 'R07')).toBe(true)
  })

  it('R09: CNC5000(투명) → guidori force_on', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC5000', paperCode: 'SNW300W00', selected: sel() })
    expect(v.some((x) => x.token === 'guidori' && x.action === 'force_on' && x.ruleId === 'R09')).toBe(true)
  })

  it('제약 없음 → 빈 배열', () => {
    const v = evaluateFinishingGate({ categoryCode: 'CNC1000', paperCode: 'SNW300W00', selected: sel('bak') })
    expect(v).toEqual([])
  })
})
