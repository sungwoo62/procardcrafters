import { describe, it, expect } from 'vitest'
import {
  MAX_FOIL_LAYERS,
  validateFoilLayers,
  foilLayersToFields,
  parseFoilLayersFromOptions,
  resolveFoilPaperCut,
  type FoilLayer,
} from '../swadpia-finishing-fields'
import { finishingSurchargeKrw, finishingSurchargeKrwFromOptions } from '../finishing-surcharge'

// OMO-3257: 박(foil) 멀티레이어 — 레이어별 가로×세로 입력 + 합산(최대 3).
// OMO-3262 라이브 RE: 성원 박 가드는 고정 면적창(640~60000)이 아니라 용지 cut 규격 대비
//   per-axis 상한(0 < x ≤ cutX && 0 < y ≤ cutY). 면적 하한 없음. → 양수·개수 + paperCut per-axis.

describe('validateFoilLayers — 양수·개수 + per-axis(용지규격) 가드', () => {
  const layer = (x: number, y: number): FoilLayer => ({ x_size: x, y_size: y })

  it('면적 하한 없음: 소형 박(2×2=4mm²) 허용 (OMO-3262: 거짓거부 방지)', () => {
    expect(validateFoilLayers([layer(2, 2)]).ok).toBe(true)
    expect(validateFoilLayers([layer(10, 10)]).ok).toBe(true)
  })

  it('paperCut 주면 per-axis 상한 적용 — 8×80(640mm²)도 세로>cutY 면 거부', () => {
    const cut = { cutX: 90, cutY: 50 }
    expect(validateFoilLayers([layer(8, 80)], cut).ok).toBe(false) // 세로 80 > cutY 50
    expect(validateFoilLayers([layer(80, 8)], cut).ok).toBe(true) // 가로 80≤90, 세로 8≤50 → 통과
    expect(validateFoilLayers([layer(80, 40)], cut).ok).toBe(true) // 둘 다 규격 내
    expect(validateFoilLayers([layer(95, 40)], cut).ok).toBe(false) // 가로 95 > cutX 90
  })

  it('paperCut 미지정 시 큰 치수도 양수면 통과(성원 calcuEstimate 가 최종 권위)', () => {
    expect(validateFoilLayers([layer(8, 80)]).ok).toBe(true)
  })

  it('경계: 용지규격과 같으면 허용(≤), 1mm 라도 초과면 거부 (OMO-3262 RE: y50=cutY50 허용)', () => {
    const cut = { cutX: 90, cutY: 50 }
    expect(validateFoilLayers([layer(90, 50)], cut).ok).toBe(true) // 정확히 규격 = 허용
    expect(validateFoilLayers([layer(91, 50)], cut).ok).toBe(false) // 가로 91 > 90
    expect(validateFoilLayers([layer(90, 51)], cut).ok).toBe(false) // 세로 51 > 50
  })

  it('레이어 개수 1~3 허용, 0개·4개 거부', () => {
    expect(validateFoilLayers([]).ok).toBe(false)
    expect(validateFoilLayers([layer(50, 30)]).ok).toBe(true)
    expect(
      validateFoilLayers([layer(50, 30), layer(50, 30), layer(50, 30)]).ok,
    ).toBe(true)
    expect(
      validateFoilLayers([layer(50, 30), layer(50, 30), layer(50, 30), layer(50, 30)]).ok,
    ).toBe(false)
    expect(MAX_FOIL_LAYERS).toBe(3)
  })

  it('0·음수·비숫자 가로세로 거부', () => {
    expect(validateFoilLayers([layer(0, 30)]).ok).toBe(false)
    expect(validateFoilLayers([layer(50, -1)]).ok).toBe(false)
    expect(validateFoilLayers([{ x_size: NaN, y_size: 30 }]).ok).toBe(false)
  })

  it('한 레이어라도 규격 밖이면 전체 실패 + 해당 레이어 번호 메시지', () => {
    const cut = { cutX: 90, cutY: 50 }
    const v = validateFoilLayers([layer(50, 30), layer(50, 99)], cut) // 레이어2 세로 99 > 50
    expect(v.ok).toBe(false)
    expect(v.errors.some((e) => e.includes('layer 2'))).toBe(true)
  })
})

describe('resolveFoilPaperCut — 용지규격 → cut 치수(mm) 해석 (OMO-3264)', () => {
  const namecard = {
    size_type_code: 'N0100',
    size_type_name: '(90*50)',
    cut_norm_x_size: '90',
    cut_norm_y_size: '50',
  }

  it('size_type_code 일치 시 그 규격의 cut 치수 반환', () => {
    expect(resolveFoilPaperCut([namecard], 'N0100')).toEqual({ cutX: 90, cutY: 50 })
  })

  it('치수쌍("90x50")이 size_type_name 과 일치하면 매칭(스왑 허용)', () => {
    const other = { size_type_code: 'X', size_type_name: '(50*30)', cut_norm_x_size: '50', cut_norm_y_size: '30' }
    expect(resolveFoilPaperCut([namecard, other], '90x50')).toEqual({ cutX: 90, cutY: 50 })
    expect(resolveFoilPaperCut([namecard, other], '50x90')).toEqual({ cutX: 90, cutY: 50 }) // 스왑
  })

  it('규격이 1개뿐이면 선택값 없이도 그것 사용', () => {
    expect(resolveFoilPaperCut([namecard])).toEqual({ cutX: 90, cutY: 50 })
  })

  it('모호(다중 규격·매칭 실패)하면 undefined → per-axis 가드 스킵(양수만)', () => {
    const other = { size_type_code: 'X', size_type_name: '(50*30)', cut_norm_x_size: '50', cut_norm_y_size: '30' }
    expect(resolveFoilPaperCut([namecard, other], 'ZZZ')).toBeUndefined()
  })

  it('빈 입력·유효치수 없는 규격은 undefined', () => {
    expect(resolveFoilPaperCut(undefined, 'N0100')).toBeUndefined()
    expect(resolveFoilPaperCut([], 'N0100')).toBeUndefined()
    expect(
      resolveFoilPaperCut([{ size_type_code: 'B', cut_norm_x_size: '0', cut_norm_y_size: 'x' }], 'B'),
    ).toBeUndefined()
  })

  it('해석된 cut 을 validateFoilLayers 에 주입하면 RE 케이스 재현', () => {
    const cut = resolveFoilPaperCut([namecard], 'N0100')
    expect(validateFoilLayers([{ x_size: 8, y_size: 80 }], cut).ok).toBe(false) // 세로>50
    expect(validateFoilLayers([{ x_size: 2, y_size: 2 }], cut).ok).toBe(true) // 소형 허용
    expect(validateFoilLayers([{ x_size: 95, y_size: 40 }], cut).ok).toBe(false) // 가로>90
  })
})

describe('foilLayersToFields — 성원 발주 필드코드 직렬화', () => {
  it('레이어별 bak_*_N 필드 생성 (N=1..3)', () => {
    const fields = foilLayersToFields([
      { x_size: 50, y_size: 30 },
      { x_size: 40, y_size: 20, bak_type: 'BKT01', bak_side: 'BKD30' },
    ])
    expect(fields.bak_x_size_1).toBe('50')
    expect(fields.bak_y_size_1).toBe('30')
    expect(fields.bak_type_1).toBe('BKT02') // 기본 금박(유광)
    expect(fields.bak_side_1).toBe('BKD10') // 기본 전면
    expect(fields.bak_x_size_2).toBe('40')
    expect(fields.bak_y_size_2).toBe('20')
    expect(fields.bak_type_2).toBe('BKT01') // 명시값 우선
    expect(fields.bak_side_2).toBe('BKD30')
    // 레이어 3 없음
    expect(fields.bak_x_size_3).toBeUndefined()
  })

  it('최대 3 레이어 초과분은 무시', () => {
    const fields = foilLayersToFields([
      { x_size: 50, y_size: 30 },
      { x_size: 50, y_size: 30 },
      { x_size: 50, y_size: 30 },
      { x_size: 99, y_size: 99 },
    ])
    expect(fields.bak_x_size_3).toBe('50')
    expect(fields['bak_x_size_4']).toBeUndefined()
  })

  it('직렬화 → 복원 라운드트립', () => {
    const layers = [
      { x_size: 50, y_size: 30 },
      { x_size: 40, y_size: 25 },
    ]
    const restored = parseFoilLayersFromOptions(foilLayersToFields(layers))
    expect(restored).toHaveLength(2)
    expect(restored[0].x_size).toBe(50)
    expect(restored[1].y_size).toBe(25)
  })
})

describe('finishingSurchargeKrwFromOptions — 박 멀티레이어 면적 합산', () => {
  it('2 레이어 surcharge = 각 레이어 면적단가 합산', () => {
    const opts = {
      finishing: 'foil_stamp',
      ...foilLayersToFields([
        { x_size: 50, y_size: 30 }, // 1500mm²
        { x_size: 100, y_size: 60 }, // 6000mm²
      ]),
    }
    const expected =
      finishingSurchargeKrw('foil_stamp', 1500) + finishingSurchargeKrw('foil_stamp', 6000)
    expect(finishingSurchargeKrwFromOptions(opts)).toBe(expected)
  })

  it('2 레이어(동일면적)는 1 레이어의 2배', () => {
    const one = finishingSurchargeKrwFromOptions({
      finishing: 'foil_stamp',
      ...foilLayersToFields([{ x_size: 50, y_size: 30 }]),
    })
    const two = finishingSurchargeKrwFromOptions({
      finishing: 'foil_stamp',
      ...foilLayersToFields([
        { x_size: 50, y_size: 30 },
        { x_size: 50, y_size: 30 },
      ]),
    })
    expect(two).toBe(one * 2)
  })

  it('단일레이어 레거시 키(bak_x_size_1)는 기존과 동일', () => {
    expect(
      finishingSurchargeKrwFromOptions({
        finishing: 'foil_stamp',
        bak_x_size_1: '50',
        bak_y_size_1: '30',
      }),
    ).toBe(finishingSurchargeKrw('foil_stamp', 1500))
  })
})
