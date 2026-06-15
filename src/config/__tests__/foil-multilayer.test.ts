import { describe, it, expect } from 'vitest'
import {
  MAX_FOIL_LAYERS,
  FOIL_AREA_MIN_MM2,
  FOIL_AREA_MAX_MM2,
  validateFoilLayers,
  foilLayersToFields,
  parseFoilLayersFromOptions,
  type FoilLayer,
} from '../swadpia-finishing-fields'
import { finishingSurchargeKrw, finishingSurchargeKrwFromOptions } from '../finishing-surcharge'

// OMO-3257: 박(foil) 멀티레이어 — 레이어별 가로×세로 입력 + 합산(최대 3).
// 성원 chk_size_low/high 면적 가드(640~60000mm²) 경계값 + 직렬화 + surcharge 합산 회귀.

describe('validateFoilLayers — 면적 가드(성원 chk_size_low/high)', () => {
  const layer = (x: number, y: number): FoilLayer => ({ x_size: x, y_size: y })

  it('경계값 639mm² 거부 / 640mm² 허용 (하한)', () => {
    // 640 = 32×20, 639 ≈ 가로세로로 정확히 만들기 어려우니 면적 직접 비교 케이스 사용
    expect(validateFoilLayers([layer(32, 19.96875)]).ok).toBe(false) // 638.9..
    expect(validateFoilLayers([layer(32, 20)]).ok).toBe(true) // 640
    expect(FOIL_AREA_MIN_MM2).toBe(640)
  })

  it('경계값 60000mm² 허용 / 60001mm² 거부 (상한)', () => {
    expect(validateFoilLayers([layer(300, 200)]).ok).toBe(true) // 60000
    expect(validateFoilLayers([layer(300, 200.01)]).ok).toBe(false) // 60003
    expect(FOIL_AREA_MAX_MM2).toBe(60000)
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

  it('한 레이어라도 범위 밖이면 전체 실패 + 해당 레이어 번호 메시지', () => {
    const v = validateFoilLayers([layer(50, 30), layer(5, 5)]) // 레이어2 = 25mm² < 640
    expect(v.ok).toBe(false)
    expect(v.errors.some((e) => e.includes('레이어 2'))).toBe(true)
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
