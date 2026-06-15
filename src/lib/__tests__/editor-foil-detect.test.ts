import { describe, it, expect } from 'vitest'
import {
  detectFoilLayersFromObjects,
  foilLayersToOrderParams,
  type FoilObjectRect,
} from '../editor-foil-detect'
import {
  validateFoilLayers,
  parseFoilLayersFromOptions,
  FOIL_DEFAULT_BAK_TYPE,
  FOIL_DEFAULT_BAK_SIDE,
} from '@/config/swadpia-finishing-fields'

// OMO-3261: 에디터 박 자동감지 — 합집합 bounding box → 가로×세로(mm) 추출의 결정론 회귀.
// scale = px-per-mm. EditorClient mmToPx(mm, scale)=mm*scale 와 동일.

describe('detectFoilLayersFromObjects — 합집합 bbox 결정론 추출', () => {
  it('박 오브젝트 없음 → 빈 배열(별색판 미생성, OMO-2706 "" 정합)', () => {
    expect(detectFoilLayersFromObjects([], { scale: 4 })).toEqual([])
  })

  it('단일 오브젝트 → 그 오브젝트의 가로×세로(mm). scale=4 → 80px×40px = 20×10mm', () => {
    const rects: FoilObjectRect[] = [{ left: 100, top: 50, width: 80, height: 40 }]
    const layers = detectFoilLayersFromObjects(rects, { scale: 4 })
    expect(layers).toEqual([
      { x_size: 20, y_size: 10, bak_type: FOIL_DEFAULT_BAK_TYPE, bak_side: FOIL_DEFAULT_BAK_SIDE },
    ])
  })

  it('복수 산재 오브젝트 → 단일 합집합 bbox 1 레이어(군집화 추론 금지)', () => {
    // (좌상 10,10~30,30) + (우하 110,60~150,100) → 합집합 10,10 ~ 150,100 = 140×90px
    const rects: FoilObjectRect[] = [
      { left: 10, top: 10, width: 20, height: 20 },
      { left: 110, top: 60, width: 40, height: 40 },
    ]
    const layers = detectFoilLayersFromObjects(rects, { scale: 2 }) // 2 px/mm
    expect(layers).toHaveLength(1)
    expect(layers[0].x_size).toBe(70) // 140px / 2
    expect(layers[0].y_size).toBe(45) // 90px / 2
  })

  it('px/scale 비정수 → 정수 mm 반올림(성원 입력은 정수)', () => {
    const rects: FoilObjectRect[] = [{ left: 0, top: 0, width: 85, height: 35 }]
    const layers = detectFoilLayersFromObjects(rects, { scale: 3 })
    expect(layers[0].x_size).toBe(28) // 85/3 = 28.33 → 28
    expect(layers[0].y_size).toBe(12) // 35/3 = 11.67 → 12
  })

  it('scale ≤ 0 또는 비유한 → 빈 배열(환산 불가)', () => {
    const rects: FoilObjectRect[] = [{ left: 0, top: 0, width: 80, height: 40 }]
    expect(detectFoilLayersFromObjects(rects, { scale: 0 })).toEqual([])
    expect(detectFoilLayersFromObjects(rects, { scale: -1 })).toEqual([])
    expect(detectFoilLayersFromObjects(rects, { scale: NaN })).toEqual([])
  })

  it('퇴화(0 크기) rect 는 합집합에서 제외', () => {
    const rects: FoilObjectRect[] = [
      { left: 0, top: 0, width: 80, height: 40 },
      { left: 500, top: 500, width: 0, height: 0 }, // 무시되어야 함
    ]
    const layers = detectFoilLayersFromObjects(rects, { scale: 4 })
    expect(layers[0].x_size).toBe(20)
    expect(layers[0].y_size).toBe(10)
  })

  it('모든 rect 가 퇴화 → 빈 배열', () => {
    const rects: FoilObjectRect[] = [{ left: 0, top: 0, width: 0, height: 5 }]
    expect(detectFoilLayersFromObjects(rects, { scale: 4 })).toEqual([])
  })
})

describe('detect → validate 면적 가드 정합(성원 chk_size_low/high)', () => {
  it('정상 면적(20×10=200... → 640 미만)은 가드에 걸린다', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 80, height: 40 }],
      { scale: 4 },
    ) // 20×10 = 200mm² < 640
    expect(validateFoilLayers(layers).ok).toBe(false)
  })

  it('면적 640~60000 범위 내는 통과 (40×40=1600mm²)', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 160, height: 160 }],
      { scale: 4 },
    ) // 40×40 = 1600
    expect(validateFoilLayers(layers).ok).toBe(true)
  })

  it('면적 60000 초과는 차단 (300×250=75000mm²)', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 1200, height: 1000 }],
      { scale: 4 },
    ) // 300×250 = 75000 > 60000
    expect(validateFoilLayers(layers).ok).toBe(false)
  })
})

describe('foilLayersToOrderParams — /order 직렬화 + finishing 병합', () => {
  it('레이어 없음 → 빈 맵(기존 finishing 불변)', () => {
    expect(foilLayersToOrderParams([], 'die_cut')).toEqual({})
  })

  it('foil_stamp 가 finishing 에 병합되고 bak_*_1 면적 키가 부착된다', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 160, height: 160 }],
      { scale: 4 },
    )
    const params = foilLayersToOrderParams(layers, 'die_cut')
    expect(params.finishing).toBe('die_cut,foil_stamp')
    expect(params.bak_x_size_1).toBe('40')
    expect(params.bak_y_size_1).toBe('40')
    // 라운드트립: 직렬화 키에서 레이어 복원 시 동일 치수
    const restored = parseFoilLayersFromOptions(params)
    expect(restored).toHaveLength(1)
    expect(restored[0].x_size).toBe(40)
    expect(restored[0].y_size).toBe(40)
  })

  it('foil_stamp 중복 추가 안 함(이미 finishing 에 존재)', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 160, height: 160 }],
      { scale: 4 },
    )
    const params = foilLayersToOrderParams(layers, 'foil_stamp')
    expect(params.finishing).toBe('foil_stamp')
  })

  it('기존 finishing 없음 → foil_stamp 단독', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 160, height: 160 }],
      { scale: 4 },
    )
    expect(foilLayersToOrderParams(layers).finishing).toBe('foil_stamp')
  })
})
