import { describe, it, expect } from 'vitest'
import {
  isFinishPlateObject,
  selectFinishPlateObjects,
  hasFinishPlateObjects,
  SPOT_PLATE_FILL,
  POSITION_OVERLAY_FILL,
  SPOT_PLATE_BG,
  type FinishPlateObjectLike,
} from '../editor-finish-plate'
import { detectFoilLayersFromCanvas, type FoilCanvasObject } from '../editor-foil-detect'

// OMO-3577 (부모 OMO-3568): 별색판(p2) 오브젝트 선택의 결정론 + 오브젝트 집합 동일성.
// 검증 핵심: getFinishPlateDataUrl 가 래스터하는 오브젝트 집합 ≡ editor-foil-detect 가
// 박 자동 치수로 측정하는 오브젝트 집합 (data.finish && visible !== false).

describe('isFinishPlateObject — 별색판 대상 판정', () => {
  it('data.finish truthy & visible !== false → true', () => {
    expect(isFinishPlateObject({ data: { finish: 'foil_stamp' } })).toBe(true)
    expect(isFinishPlateObject({ data: { finish: true }, visible: true })).toBe(true)
    expect(isFinishPlateObject({ data: { finish: 'spot_color' }, visible: undefined })).toBe(true)
  })

  it('finish 마커 없음 → false', () => {
    expect(isFinishPlateObject({ data: {} })).toBe(false)
    expect(isFinishPlateObject({ data: null })).toBe(false)
    expect(isFinishPlateObject({})).toBe(false)
    expect(isFinishPlateObject(null)).toBe(false)
    expect(isFinishPlateObject(undefined)).toBe(false)
  })

  it('finish 있어도 visible === false → false (숨긴 영역 제외)', () => {
    expect(isFinishPlateObject({ data: { finish: 'epoxy' }, visible: false })).toBe(false)
  })

  it('finish 값이 falsy(빈 문자열/0) → false', () => {
    expect(isFinishPlateObject({ data: { finish: '' } })).toBe(false)
    expect(isFinishPlateObject({ data: { finish: 0 } })).toBe(false)
  })
})

describe('selectFinishPlateObjects — 부분집합 추출(입력 순서 유지)', () => {
  it('빈/누락 입력 → 빈 배열', () => {
    expect(selectFinishPlateObjects([])).toEqual([])
    expect(selectFinishPlateObjects(null)).toEqual([])
    expect(selectFinishPlateObjects(undefined)).toEqual([])
  })

  it('finish 오브젝트만 골라 입력 순서대로 반환', () => {
    const a = { data: { finish: 'foil_stamp' }, tag: 'a' }
    const b = { data: {}, tag: 'b' }
    const c = { data: { finish: 'die_cut' }, visible: false, tag: 'c' }
    const d = { data: { finish: 'spot_color' }, tag: 'd' }
    expect(selectFinishPlateObjects([a, b, c, d])).toEqual([a, d])
  })
})

describe('hasFinishPlateObjects — 별색 발주 전 가드', () => {
  it('별색 오브젝트 1개 이상이면 true, 없으면 false', () => {
    expect(hasFinishPlateObjects([{ data: { finish: 'foil_stamp' } }])).toBe(true)
    expect(hasFinishPlateObjects([{ data: {} }])).toBe(false)
    expect(hasFinishPlateObjects([])).toBe(false)
  })
})

describe('별색판/위치보기 색 상수 (OMO-3581 교정)', () => {
  it('박파일(별색판) = K100(순흑), 위치보기용 = M100(순마젠타), 둘은 다르다', () => {
    expect(SPOT_PLATE_FILL).toBe('rgb(0,0,0)') // K100 별색판(박파일/동판/목형/에폭시)
    expect(POSITION_OVERLAY_FILL).toBe('rgb(255,0,255)') // M100 위치보기용 오버레이
    expect(SPOT_PLATE_FILL).not.toBe(POSITION_OVERLAY_FILL)
    expect(SPOT_PLATE_BG).toBe('#ffffff')
  })
})

// ── 오브젝트 집합 동일성: 별색판 래스터 ≡ 박 자동 치수 ───────────────────────────
//
// editor-foil-detect 는 selectFinishPlateObjects 와 동일한 isFinishPlateObject 로
// 박 오브젝트를 고른다. 따라서 동일 캔버스에서 둘이 보는 집합은 항상 같다.
describe('오브젝트 집합 동일성 (별색판 ↔ editor-foil-detect)', () => {
  type TestObj = FinishPlateObjectLike & FoilCanvasObject

  const rect = (left: number, top: number, width: number, height: number) => () => ({
    left,
    top,
    width,
    height,
  })

  it('별색판 선택 집합과 박 자동감지 측정 집합이 동일 오브젝트로 구성된다', () => {
    const objs: TestObj[] = [
      { data: { finish: 'foil_stamp' }, getBoundingRect: rect(0, 0, 40, 40) }, // 포함
      { data: {}, getBoundingRect: rect(0, 0, 10, 10) }, // 제외(마커 없음)
      { data: { finish: 'die_cut' }, visible: false, getBoundingRect: rect(0, 0, 10, 10) }, // 제외(숨김)
      { data: { finish: 'spot_color' }, getBoundingRect: rect(80, 80, 40, 40) }, // 포함
    ]
    const canvas = { getObjects: () => objs }

    const plateObjs = selectFinishPlateObjects(objs)
    expect(plateObjs).toHaveLength(2)

    // 박 자동감지가 별색판 집합과 동일 오브젝트만 본다면, 합집합 bbox = (0,0)~(120,120).
    // scale=2 px/mm → 120px / 2 = 60mm. 제외 오브젝트가 섞였다면 이 값이 달라진다.
    const detected = detectFoilLayersFromCanvas(canvas, { scale: 2 })
    expect(detected.layers).toHaveLength(1)
    expect(detected.layers[0].x_size).toBe(60)
    expect(detected.layers[0].y_size).toBe(60)
  })

  it('별색 오브젝트가 없으면 양쪽 모두 빈 결과(회귀 없음)', () => {
    const objs: TestObj[] = [{ data: {}, getBoundingRect: rect(0, 0, 10, 10) }]
    const canvas = { getObjects: () => objs }
    expect(selectFinishPlateObjects(objs)).toEqual([])
    expect(detectFoilLayersFromCanvas(canvas, { scale: 2 }).layers).toEqual([])
  })
})
