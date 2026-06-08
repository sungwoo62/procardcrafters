import { describe, it, expect } from 'vitest'
import {
  finishingSurchargeKrw,
  finishingSurchargeKrwFromOptions,
  FINISHING_DEFAULT_AREA_MM,
} from '../finishing-surcharge'
import { expandFinishingToSwadpiaFields } from '../swadpia-finishing-fields'

// OMO-2667: 후가공 소비측 정합성 — 구성기 표시가 = 서버 결제 surcharge = 자동발주 면적단가.
// QA(OMO-2665) BLOCK 1~3 재발 방지 회귀 테스트.

const BASE_AREA_MM2 = FINISHING_DEFAULT_AREA_MM.width * FINISHING_DEFAULT_AREA_MM.height // 1,500

describe('finishingSurchargeKrwFromOptions — 결제 권위 재계산', () => {
  it('(a) 다중 후가공(박+도무송) surcharge 는 각 항목 합산과 일치 (BLOCK #1: 콤마결합 0원 청구 방지)', () => {
    const opts = { finishing: 'foil_stamp,die_cut' }
    const expected =
      finishingSurchargeKrw('foil_stamp') + finishingSurchargeKrw('die_cut')
    expect(finishingSurchargeKrwFromOptions(opts)).toBe(expected)
    // 단일 정확일치였다면 콤마값이 어떤 행과도 안 맞아 0 이 됐을 것 — 합산은 0 보다 커야 한다.
    expect(finishingSurchargeKrwFromOptions(opts)).toBeGreaterThan(0)
  })

  it('(b) 박 면적 100×60mm 청구가는 50×30mm 대비 ~4× (BLOCK #2: 면적 미반영 방지)', () => {
    const big = finishingSurchargeKrwFromOptions({
      finishing: 'foil_stamp',
      bak_x_size_1: '100',
      bak_y_size_1: '60',
    })
    const small = finishingSurchargeKrwFromOptions({
      finishing: 'foil_stamp',
      bak_x_size_1: '50',
      bak_y_size_1: '30',
    })
    expect(big / small).toBeCloseTo(4, 1)
  })

  it('면적키 없으면 기본면적(50×30) 으로 산출', () => {
    expect(finishingSurchargeKrwFromOptions({ finishing: 'foil_stamp' })).toBe(
      finishingSurchargeKrw('foil_stamp', BASE_AREA_MM2),
    )
  })

  it('형압(ap_*) 면적키도 동일하게 반영', () => {
    const big = finishingSurchargeKrwFromOptions({
      finishing: 'deboss_emboss',
      ap_x_size_1: '100',
      ap_y_size_1: '60',
    })
    const small = finishingSurchargeKrwFromOptions({
      finishing: 'deboss_emboss',
      ap_x_size_1: '50',
      ap_y_size_1: '30',
    })
    expect(big / small).toBeCloseTo(4, 1)
  })

  it('(d) 후가공 미선택 시 0 (회귀 없음 — None 기본)', () => {
    expect(finishingSurchargeKrwFromOptions({})).toBe(0)
    expect(finishingSurchargeKrwFromOptions({ paper_qty: '500' })).toBe(0)
  })

  it('매핑 안 된 후가공 value 는 0 기여 (안전)', () => {
    expect(finishingSurchargeKrwFromOptions({ finishing: 'unknown_xyz' })).toBe(0)
    // 알 수 없는 값 + 유효 값 혼합 시 유효 값만 합산
    expect(finishingSurchargeKrwFromOptions({ finishing: 'unknown_xyz,die_cut' })).toBe(
      finishingSurchargeKrw('die_cut'),
    )
  })
})

describe('expandFinishingToSwadpiaFields — 자동발주 면적·다중값 보존 (BLOCK #3)', () => {
  it('(c) 다중 후가공 → 박/도무송 성원 필드코드로 모두 확장', () => {
    const expanded = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp,die_cut' })
    // 박
    expect(expanded.bak_section_1).toBe('BKS10')
    expect(expanded.bak_type_1).toBe('BKT02')
    // 도무송
    expect(expanded.domusong_section).toBe('DMS20')
    // 집계키는 확장 후 제거
    expect(expanded.finishing).toBeUndefined()
  })

  it('(c) 고객 입력 면적키는 기본값보다 우선 보존 → 면적단가 산출', () => {
    const expanded = expandFinishingToSwadpiaFields({
      finishing: 'foil_stamp',
      bak_x_size_1: '100',
      bak_y_size_1: '60',
    })
    expect(expanded.bak_x_size_1).toBe('100')
    expect(expanded.bak_y_size_1).toBe('60')
  })

  it('면적키 미지정 시 보수적 기본면적(50×30) 채움', () => {
    const expanded = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp' })
    expect(expanded.bak_x_size_1).toBe('50')
    expect(expanded.bak_y_size_1).toBe('30')
  })

  it('finishing 키 없으면 입력 그대로 (기존 주문 무영향)', () => {
    const input = { paper_qty: '500', paper_code: 'X' }
    expect(expandFinishingToSwadpiaFields(input)).toEqual(input)
  })
})
