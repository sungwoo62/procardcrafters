import { describe, it, expect } from 'vitest'
import {
  finishingSurchargeKrw,
  finishingSurchargeKrwFromOptions,
  numberingSurchargeKrwFromOptions,
  buildOrderExtraPricesKrw,
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

describe('buildOrderExtraPricesKrw — 결제/표시 extra 합산 단일권위 (OMO-2673 이중청구 회귀)', () => {
  // 마이그레이션(20260608000020)이 시드하는 option_type='finishing' 행을 재현.
  const seededOptions = [
    { option_type: 'finishing', value: 'foil_stamp', extra_price_krw: 22300 },
    { option_type: 'finishing', value: 'die_cut', extra_price_krw: 21500 },
    { option_type: 'paper', value: 'premium', extra_price_krw: 5000 },
  ]

  it('단일 후가공(박)은 정확히 1회만 가산 — 시드 행 + surcharge 이중청구(2×) 방지', () => {
    const extras = buildOrderExtraPricesKrw({ finishing: 'foil_stamp' }, seededOptions)
    const total = extras.reduce((a, b) => a + b, 0)
    // 권위값 = surcharge 함수 1회 (44,600 이면 회귀)
    expect(total).toBe(finishingSurchargeKrw('foil_stamp', BASE_AREA_MM2))
    expect(total).not.toBe(22300 * 2)
  })

  it('평면 후가공(도무송) 단일도 1회만 가산', () => {
    const extras = buildOrderExtraPricesKrw({ finishing: 'die_cut' }, seededOptions)
    expect(extras.reduce((a, b) => a + b, 0)).toBe(finishingSurchargeKrw('die_cut'))
  })

  it('비후가공 옵션(paper)은 정확일치로 그대로 합산 + 후가공은 surcharge 권위', () => {
    const extras = buildOrderExtraPricesKrw(
      { paper: 'premium', finishing: 'foil_stamp' },
      seededOptions,
    )
    expect(extras.reduce((a, b) => a + b, 0)).toBe(
      5000 + finishingSurchargeKrw('foil_stamp', BASE_AREA_MM2),
    )
  })

  it('면적 입력은 surcharge 에 비례 반영(시드 flat 22300 과 무관)', () => {
    const total = buildOrderExtraPricesKrw(
      { finishing: 'foil_stamp', bak_x_size_1: '100', bak_y_size_1: '60' },
      seededOptions,
    ).reduce((a, b) => a + b, 0)
    expect(total).toBe(finishingSurchargeKrw('foil_stamp', 100 * 60))
  })

  it('후가공 미선택 시 후가공 가산 없음 (None 회귀)', () => {
    expect(buildOrderExtraPricesKrw({ paper: 'premium' }, seededOptions)).toEqual([5000])
    expect(buildOrderExtraPricesKrw({}, seededOptions)).toEqual([])
  })
})

// OMO-3528: 넘버링 도매 surcharge 적재 (보드 가격승인 게이트 통과). RE 공식 floor/unit 직산.
describe('numberingSurchargeKrwFromOptions — 넘버링 결정론 적재', () => {
  it('컨텍스트 없으면 일반(NBT10) floor 38,000 × order_count(기본 1)', () => {
    expect(numberingSurchargeKrwFromOptions({})).toBe(38000)
    expect(numberingSurchargeKrwFromOptions({ numbering_type: 'NBT10' })).toBe(38000)
  })

  it('난수(NBT20) floor 70,000', () => {
    expect(numberingSurchargeKrwFromOptions({ numbering_type: 'NBT20' })).toBe(70000)
  })

  it('order_count 가 floor 를 배수 (동일 주문 내 종 수)', () => {
    expect(numberingSurchargeKrwFromOptions({ numbering_order_count: '3' })).toBe(38000 * 3)
  })

  it('용지 게이트(SNW300/DNT250GP0/UPP250FB0)면 0 — 과다청구 방지', () => {
    expect(numberingSurchargeKrwFromOptions({ numbering_paper_code: 'SNW300W00' })).toBe(0)
    expect(numberingSurchargeKrwFromOptions({ numbering_paper_code: 'DNT250GP0' })).toBe(0)
    expect(numberingSurchargeKrwFromOptions({ numbering_paper_code: 'UPP250FB0' })).toBe(0)
  })

  it('SNW250 은 무광코팅(matte) 일 때만 게이트', () => {
    // 무광 → 0
    expect(
      numberingSurchargeKrwFromOptions({ numbering_paper_code: 'SNW250W00', numbering_matte_coated: '1' }),
    ).toBe(0)
    // 무광 아님 → floor 청구
    expect(numberingSurchargeKrwFromOptions({ numbering_paper_code: 'SNW250W00' })).toBe(38000)
  })

  it('대량(매수·면적 큰) 주문은 unit 이 floor 를 초과', () => {
    const big = numberingSurchargeKrwFromOptions({
      numbering_type: 'NBT10',
      numbering_cut_x: '90',
      numbering_cut_y: '50',
      numbering_paper_qty: '20000',
    })
    expect(big).toBeGreaterThan(38000)
  })

  it('NCR/양식 모델 floor 47,000', () => {
    expect(numberingSurchargeKrwFromOptions({ numbering_model: 'ncr' })).toBe(47000)
  })

  it('finishing="numbering" 으로 통합 경로에서 floor 가산', () => {
    expect(finishingSurchargeKrwFromOptions({ finishing: 'numbering' })).toBe(38000)
  })

  it('박+넘버링 혼합 → 각 항목 합산', () => {
    const mixed = finishingSurchargeKrwFromOptions({ finishing: 'foil_stamp,numbering' })
    expect(mixed).toBe(finishingSurchargeKrw('foil_stamp', BASE_AREA_MM2) + 38000)
  })

  it('buildOrderExtraPricesKrw 에서 넘버링 1회만 가산', () => {
    const extras = buildOrderExtraPricesKrw({ finishing: 'numbering' }, [])
    expect(extras.reduce((a, b) => a + b, 0)).toBe(38000)
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
