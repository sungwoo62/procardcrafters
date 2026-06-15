// OMO-3261: 에디터(디자인) 주문 경로의 박(foil) 멀티레이어 자동 치수 매핑.
//
// 소스 단일성(이슈 요구 "별도 추정 금지"): bounding box 산출에 쓰는 박 오브젝트 집합은
// OMO-2706 `getFinishPlateDataUrl()` 이 M100 별색 후가공판으로 렌더하는 집합과 **동일**하다.
//   → 박 오브젝트 = `canvas.getObjects().filter(o => o.data?.finish && o.visible !== false)`
// 그 오브젝트들의 캔버스 px bounding rect 를 입력으로 받아, 동일판이 차지하는 영역의
// **가로×세로(mm)** 를 추출값만으로 산출한다(추론·여백 가정 없음).
//
// 레이어 모델: OMO-2706 합본 PDF p2 는 박 오브젝트 전체를 **단일 M100 별색판(=1 동판)** 으로
// 출력한다. 따라서 자동감지의 결정론적 매핑은 **합집합 bounding box = 1 레이어**다.
// (산재한 오브젝트를 임의로 군집화해 2~3 동판으로 쪼개는 것은 추론이므로 금지. 멀티레이어
//  2~3 입력은 OMO-3257 고객 직접 주문 경로의 수동 입력에 한정된다.)
//
// 결정론: 치수는 추출 px / scale 환산값만 사용. 가격은 성원 bak_amt/pay_amt(이 모듈 무관).

import {
  FoilLayer,
  FoilPaperCut,
  FOIL_DEFAULT_BAK_TYPE,
  FOIL_DEFAULT_BAK_SIDE,
  foilLayersToFields,
  validateFoilLayers,
} from '@/config/swadpia-finishing-fields'

/** fabric 오브젝트의 캔버스 px 기준 bounding rect (`object.getBoundingRect()` 형태). */
export interface FoilObjectRect {
  left: number
  top: number
  width: number
  height: number
}

/** px ↔ mm 환산 기준. EditorClient 의 `mmToPx(mm, scale) = mm * scale` 와 동일 → mm = px / scale. */
export interface FoilDetectGeom {
  /** mmToPx 의 scale (px-per-mm). 0 이하이면 환산 불가 → 레이어 없음. */
  scale: number
}

/**
 * 박 오브젝트 px rect 배열 → 박 레이어 배열(FoilLayer[]).
 *
 * 합집합 bounding box(모든 박 오브젝트를 감싸는 최소 사각형)를 1개 레이어로 매핑한다.
 *  - 박 오브젝트가 없으면 [] (박 미사용 → 별색판/레이어 미생성, OMO-2706 '' 반환과 정합).
 *  - 치수는 (px / scale) 을 **정수 mm 로 반올림**(성원 가로·세로 입력은 정수 mm).
 *  - 사이즈 가드(성원 chk_size_high = 용지 cut 규격 대비 per-axis 상한, OMO-3262/3264)·개수
 *    검증은 호출측에서 validateFoilLayers(layers, paperCut) 로 수행(여기선 추출만).
 */
export function detectFoilLayersFromObjects(
  rects: FoilObjectRect[],
  geom: FoilDetectGeom,
): FoilLayer[] {
  const scale = geom.scale
  if (!Number.isFinite(scale) || scale <= 0) return []

  // 퇴화(0 크기) rect 제외 — 보이지 않는 점/빈 오브젝트가 합집합을 왜곡하지 않도록.
  const valid = rects.filter(
    (r) =>
      Number.isFinite(r.left) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.width) &&
      Number.isFinite(r.height) &&
      r.width > 0 &&
      r.height > 0,
  )
  if (valid.length === 0) return []

  let minL = Infinity
  let minT = Infinity
  let maxR = -Infinity
  let maxB = -Infinity
  for (const r of valid) {
    if (r.left < minL) minL = r.left
    if (r.top < minT) minT = r.top
    if (r.left + r.width > maxR) maxR = r.left + r.width
    if (r.top + r.height > maxB) maxB = r.top + r.height
  }

  const xMm = Math.round((maxR - minL) / scale)
  const yMm = Math.round((maxB - minT) / scale)
  if (xMm <= 0 || yMm <= 0) return []

  return [
    {
      x_size: xMm,
      y_size: yMm,
      bak_type: FOIL_DEFAULT_BAK_TYPE,
      bak_side: FOIL_DEFAULT_BAK_SIDE,
    },
  ]
}

/** fabric 오브젝트의 박 자동감지에 필요한 최소 형태(테스트 가능하도록 인터페이스로 분리). */
export interface FoilCanvasObject {
  /** OMO-2706 별색판 소스: data.finish 가 truthy 인 오브젝트만 박으로 본다. */
  data?: { finish?: unknown } | null
  /** fabric visible. false 면 제외(OMO-2706 getFinishPlateDataUrl 과 동일 조건). */
  visible?: boolean
  /** fabric `getBoundingRect()` — 캔버스 px 기준 bounding rect. */
  getBoundingRect: () => FoilObjectRect
}

/** EditorClient 가 넘기는 캔버스 최소 형태. */
export interface FoilCanvasLike {
  getObjects: () => FoilCanvasObject[]
}

/** detectFoilLayersFromCanvas 결과 — 직렬화 파라미터 + 레이어 + 검증. */
export interface FoilDetectResult {
  /** /order 진입용 직렬화 파라미터(박 없으면 빈 맵). */
  params: Record<string, string>
  /** 자동감지된 박 레이어(박 없으면 빈 배열). */
  layers: FoilLayer[]
  /** validateFoilLayers 결과(박 없으면 ok=true·빈 errors). */
  validation: { ok: boolean; errors: string[] }
}

/**
 * EditorClient 통합 진입점: 캔버스의 박(data.finish) 오브젝트를 OMO-2706 별색판과 **동일 소스**로
 * 모아 합집합 bbox → 레이어 → /order 직렬화 파라미터 + per-axis 사이즈 검증을 한 번에 산출한다.
 *
 *  - 박 오브젝트 없음 → params {} / layers [] / validation.ok=true (회귀 없음).
 *  - paperCut(제품 cut 규격 mm)을 주면 성원 chk_size_high 와 동일하게 가로/세로 ≤ 용지 cut 검증.
 *    위반 시 validation.ok=false — 호출측이 발주 전 차단하고 errors 를 노출한다.
 */
export function detectFoilLayersFromCanvas(
  canvas: FoilCanvasLike | null | undefined,
  geom: FoilDetectGeom,
  opts?: { existingFinishing?: string; paperCut?: FoilPaperCut },
): FoilDetectResult {
  const empty: FoilDetectResult = { params: {}, layers: [], validation: { ok: true, errors: [] } }
  if (!canvas || typeof canvas.getObjects !== 'function') return empty

  const finishObjs = canvas
    .getObjects()
    .filter((o) => o && o.data?.finish && o.visible !== false)
  if (finishObjs.length === 0) return empty

  const rects = finishObjs.map((o) => o.getBoundingRect())
  const layers = detectFoilLayersFromObjects(rects, geom)
  if (layers.length === 0) return empty

  return {
    params: foilLayersToOrderParams(layers, opts?.existingFinishing),
    layers,
    validation: validateFoilLayers(layers, opts?.paperCut),
  }
}

/**
 * 자동감지한 박 레이어 → /order 진입용 직렬화 파라미터.
 *
 * `finishing` 에 `foil_stamp` 를 병합(기존 후가공 value 보존)하고, bak_*_N 면적 키를 부착한다.
 * 반환 맵은 FINISHING_PASSTHROUGH_KEYS 로 /order URL 에 전달되어 surcharge·자동발주에 쓰인다.
 *  - layers 가 비면 빈 맵({}) 반환(박 미사용 → 기존 finishing 불변).
 */
export function foilLayersToOrderParams(
  layers: FoilLayer[],
  existingFinishing?: string,
): Record<string, string> {
  if (layers.length === 0) return {}

  const values = (existingFinishing ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (!values.includes('foil_stamp')) values.push('foil_stamp')

  return {
    finishing: values.join(','),
    ...foilLayersToFields(layers),
  }
}
