import { describe, it, expect } from 'vitest'
import {
  finishingSurchargeKrw,
  finishingSurchargeKrwFromOptions,
  serializeFinishingParams,
  FINISHING_DEFAULT_AREA_MM,
} from '../finishing-surcharge'
import { expandFinishingToSwadpiaFields } from '../swadpia-finishing-fields'

/** 구성기측 표시가 KRW 합산 재현(ProductConfigurator finishingSurchargeUsd 의 KRW 단계). */
function configuratorKrwTotal(
  finishings: Iterable<string>,
  areas: Record<string, { w: number; h: number }>,
): number {
  let total = 0
  for (const v of finishings) {
    const a = areas[v]
    total += finishingSurchargeKrw(v, a ? a.w * a.h : undefined)
  }
  return total
}

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

// OMO-2670: 3경로(구성기 표시가 → 결제/SSR 서버 surcharge → 자동발주 면적단가)가
// 단일소스(finishing-surcharge.ts) 직렬화↔재계산으로 라운드트립 일치하는지 단언.
// 구성기는 serializeFinishingParams 로 내보내고, 서버는 finishingSurchargeKrwFromOptions 로,
// 자동발주는 expandFinishingToSwadpiaFields 로 같은 직렬화를 소비한다.
describe('3경로 라운드트립 일치 (구성기↔결제↔자동발주, 단일소스)', () => {
  const CASES: Array<{
    name: string
    finishings: string[]
    areas: Record<string, { w: number; h: number }>
  }> = [
    { name: '단일 박(기본면적)', finishings: ['foil_stamp'], areas: {} },
    {
      name: '단일 박(고객면적 100×60)',
      finishings: ['foil_stamp'],
      areas: { foil_stamp: { w: 100, h: 60 } },
    },
    {
      name: '박+도무송(혼합, 박만 면적비례)',
      finishings: ['foil_stamp', 'die_cut'],
      areas: { foil_stamp: { w: 80, h: 40 } },
    },
    {
      name: '박+형압(둘 다 면적비례, 서로 다른 면적)',
      finishings: ['foil_stamp', 'deboss_emboss'],
      areas: { foil_stamp: { w: 100, h: 60 }, deboss_emboss: { w: 50, h: 30 } },
    },
    {
      name: '전체(타공+도무송+박+형압)',
      finishings: ['drilled_hole', 'die_cut', 'foil_stamp', 'deboss_emboss'],
      areas: { foil_stamp: { w: 70, h: 35 }, deboss_emboss: { w: 90, h: 45 } },
    },
  ]

  for (const c of CASES) {
    it(`[${c.name}] 구성기 표시가 KRW = 직렬화 후 서버 재계산 KRW`, () => {
      const expected = configuratorKrwTotal(c.finishings, c.areas)
      const serialized = serializeFinishingParams(c.finishings, c.areas)
      // 서버 권위 경로(create-order / order SSR)
      expect(finishingSurchargeKrwFromOptions(serialized)).toBe(expected)
      // 청구가가 실제로 발생(0원 과소청구 회귀 아님)
      expect(expected).toBeGreaterThan(0)
    })

    it(`[${c.name}] 직렬화 → 자동발주 확장이 면적·다중값 보존`, () => {
      const serialized = serializeFinishingParams(c.finishings, c.areas)
      const expanded = expandFinishingToSwadpiaFields(serialized)
      // 집계키는 확장 후 제거
      expect(expanded.finishing).toBeUndefined()
      // 고객 입력 면적은 자동발주 필드코드로 그대로 전달(면적단가 권위 산출 입력)
      if (c.areas.foil_stamp) {
        expect(expanded.bak_x_size_1).toBe(String(c.areas.foil_stamp.w))
        expect(expanded.bak_y_size_1).toBe(String(c.areas.foil_stamp.h))
      }
      if (c.areas.deboss_emboss) {
        expect(expanded.ap_x_size_1).toBe(String(c.areas.deboss_emboss.w))
        expect(expanded.ap_y_size_1).toBe(String(c.areas.deboss_emboss.h))
      }
    })
  }

  it('선택 없음 → 빈 직렬화 → 0 surcharge (전 경로 회귀 없음)', () => {
    const serialized = serializeFinishingParams(new Set<string>(), {})
    expect(serialized).toEqual({})
    expect(finishingSurchargeKrwFromOptions(serialized)).toBe(0)
    expect(expandFinishingToSwadpiaFields(serialized)).toEqual({})
  })

  it('유효하지 않은 면적(0/음수)은 직렬화에서 제외 → 소비측 기본면적 적용', () => {
    const serialized = serializeFinishingParams(['foil_stamp'], {
      foil_stamp: { w: 0, h: 60 },
    })
    expect(serialized.bak_x_size_1).toBeUndefined()
    expect(serialized.bak_y_size_1).toBeUndefined()
    // 기본면적(50×30)으로 재계산
    expect(finishingSurchargeKrwFromOptions(serialized)).toBe(
      finishingSurchargeKrw('foil_stamp', BASE_AREA_MM2),
    )
  })
})
