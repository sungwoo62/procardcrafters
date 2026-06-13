import { describe, it, expect } from 'vitest'
import {
  ENGINE_PRICE_TABLES,
  enginePaperQuantities,
  lookupEnginePay,
} from '../swadpia-engine-prices'

// OMO-3105: CNC1000 일반지명함 ±0 권위 가격표 회귀.
// 출처: printing-site/scripts/swadpia/driver_cnc1000.cjs 엔진렌더(VAT 포함 결제가, OMO-3098 라이브 ±0).
const CNC1000 = ENGINE_PRICE_TABLES['business-cards']

describe('CNC1000 엔진 권위 가격표 — VAT 포함 결제가 ±0', () => {
  it('250g 양면(CTN40) 검증 스팟이 라이브 결제가와 ±0', () => {
    expect(lookupEnginePay(CNC1000, 'SNW250W00', 'CTN40', 500)?.payKrw).toBe(4620)
    expect(lookupEnginePay(CNC1000, 'SNW250W00', 'CTN40', 1000)?.payKrw).toBe(9240)
    expect(lookupEnginePay(CNC1000, 'SNW250W00', 'CTN40', 5000)?.payKrw).toBe(37400)
    expect(lookupEnginePay(CNC1000, 'SNW250W00', 'CTN40', 10000)?.payKrw).toBe(67100)
  })

  it('250g 단면(CTN10) 검증 스팟 ±0', () => {
    expect(lookupEnginePay(CNC1000, 'SNW250W00', 'CTN10', 1000)?.payKrw).toBe(7040)
    expect(lookupEnginePay(CNC1000, 'SNW250W00', 'CTN10', 2000)?.payKrw).toBe(14080)
  })

  it('300g 양면(CTN40)은 용지종속 — 250g 와 다른 단가·사다리(200단위)', () => {
    // 보드 지적 600매 구간(300g 전용) 존재
    expect(lookupEnginePay(CNC1000, 'SNW300W00', 'CTN40', 600)?.payKrw).toBe(13860)
    expect(lookupEnginePay(CNC1000, 'SNW300W00', 'CTN40', 1000)?.payKrw).toBe(23100)
    expect(lookupEnginePay(CNC1000, 'SNW300W00', 'CTN40', 5000)?.payKrw).toBe(115500)
    // 동일 1000매라도 300g(23,100) ≠ 250g(9,240) — 용지선택이 가격에 반영되어야 함
    expect(lookupEnginePay(CNC1000, 'SNW300W00', 'CTN40', 1000)?.payKrw).not.toBe(
      lookupEnginePay(CNC1000, 'SNW250W00', 'CTN40', 1000)?.payKrw,
    )
  })

  it('용지종속 수량 사다리 — 250g 최소500, 300g 최소200/600 구간', () => {
    const q250 = enginePaperQuantities(CNC1000, 'SNW250W00', 'CTN40')
    const q300 = enginePaperQuantities(CNC1000, 'SNW300W00', 'CTN40')
    expect(q250[0]).toBe(500)
    expect(q250).not.toContain(200) // 250g 에 200매 없음
    expect(q300[0]).toBe(200)
    expect(q300).toContain(600) // 300g 전용 600매 구간
  })
})

describe('lookupEnginePay — 수량 스냅(상위 최근접)', () => {
  it('사다리에 없는 하위 수량은 상위로 스냅(±0, 추가매수 무료)', () => {
    // 250g: 100·200 요청 → 500 으로 스냅(최소수량)
    const r = lookupEnginePay(CNC1000, 'SNW250W00', 'CTN40', 100)
    expect(r?.effectiveQty).toBe(500)
    expect(r?.payKrw).toBe(4620)
    // 300g: 500 요청 → 600 으로 스냅(200단위 사다리)
    const r300 = lookupEnginePay(CNC1000, 'SNW300W00', 'CTN40', 500)
    expect(r300?.effectiveQty).toBe(600)
    expect(r300?.payKrw).toBe(13860)
  })

  it('사다리 최대 초과는 null(임의 하향 금지)', () => {
    // 300g 최대 20000 초과
    expect(lookupEnginePay(CNC1000, 'SNW300W00', 'CTN40', 50000)).toBeNull()
  })

  it('미등록 용지/카테고리는 null', () => {
    expect(lookupEnginePay(CNC1000, 'UNKNOWN', 'CTN40', 1000)).toBeNull()
  })
})
