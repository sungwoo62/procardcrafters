import { describe, it, expect } from 'vitest'
import {
  detectFoilLayersFromObjects,
  detectFoilLayersFromCanvas,
  foilLayersToOrderParams,
  type FoilObjectRect,
  type FoilCanvasObject,
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

describe('detect → validate per-axis 용지 cut 가드(성원 chk_size_high, OMO-3262/3264)', () => {
  it('paperCut 미지정 → 양수 검사만 통과(면적창 가정 제거)', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 160, height: 160 }],
      { scale: 4 },
    ) // 40×40
    expect(validateFoilLayers(layers).ok).toBe(true)
  })

  it('박 bbox 가 용지 cut 규격 이내면 통과', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 120, height: 80 }],
      { scale: 4 },
    ) // 30×20mm
    // 명함 cut 90×50 → 30≤90, 20≤50 통과
    expect(validateFoilLayers(layers, { cutX: 90, cutY: 50 }).ok).toBe(true)
  })

  it('박 가로가 용지 cut 가로 초과 → 차단', () => {
    const layers = detectFoilLayersFromObjects(
      [{ left: 0, top: 0, width: 400, height: 80 }],
      { scale: 4 },
    ) // 100×20mm
    // 명함 cut 90×50 → 100 > 90 차단
    expect(validateFoilLayers(layers, { cutX: 90, cutY: 50 }).ok).toBe(false)
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

// 캔버스 통합 진입점 — OMO-2706 별색판과 동일 소스(data.finish) 필터링.
function mkObj(rect: FoilObjectRect, finish: boolean, visible = true): FoilCanvasObject {
  return { data: { finish }, visible, getBoundingRect: () => rect }
}

describe('detectFoilLayersFromCanvas — 캔버스 통합(동일 소스 필터링)', () => {
  it('null 캔버스 → 빈 결과(회귀 없음)', () => {
    const r = detectFoilLayersFromCanvas(null, { scale: 4 })
    expect(r).toEqual({ params: {}, layers: [], validation: { ok: true, errors: [] } })
  })

  it('data.finish 오브젝트 없음(디자인 요소만) → 빈 결과', () => {
    const canvas = {
      getObjects: () => [
        mkObj({ left: 0, top: 0, width: 100, height: 100 }, false),
        mkObj({ left: 0, top: 0, width: 50, height: 50 }, false),
      ],
    }
    const r = detectFoilLayersFromCanvas(canvas, { scale: 4 })
    expect(r.layers).toEqual([])
    expect(r.params).toEqual({})
  })

  it('finish 오브젝트만 합집합 — 디자인 요소는 bbox 에서 제외', () => {
    const canvas = {
      getObjects: () => [
        mkObj({ left: 0, top: 0, width: 1000, height: 1000 }, false), // 디자인(무시)
        mkObj({ left: 40, top: 40, width: 120, height: 80 }, true), // 박 30×20mm @scale4
      ],
    }
    const r = detectFoilLayersFromCanvas(canvas, { scale: 4 }, {
      existingFinishing: 'die_cut',
      paperCut: { cutX: 90, cutY: 50 },
    })
    expect(r.layers).toHaveLength(1)
    expect(r.layers[0].x_size).toBe(30)
    expect(r.layers[0].y_size).toBe(20)
    expect(r.params.finishing).toBe('die_cut,foil_stamp')
    expect(r.params.bak_x_size_1).toBe('30')
    expect(r.validation.ok).toBe(true)
  })

  it('visible:false 인 finish 오브젝트는 제외(OMO-2706 조건 일치)', () => {
    const canvas = {
      getObjects: () => [mkObj({ left: 0, top: 0, width: 120, height: 80 }, true, false)],
    }
    expect(detectFoilLayersFromCanvas(canvas, { scale: 4 }).layers).toEqual([])
  })

  it('박 bbox 가 용지 cut 초과 → validation.ok=false (발주 전 차단 신호)', () => {
    const canvas = {
      getObjects: () => [mkObj({ left: 0, top: 0, width: 400, height: 80 }, true)], // 100×20mm
    }
    const r = detectFoilLayersFromCanvas(canvas, { scale: 4 }, { paperCut: { cutX: 90, cutY: 50 } })
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.length).toBeGreaterThan(0)
  })
})
