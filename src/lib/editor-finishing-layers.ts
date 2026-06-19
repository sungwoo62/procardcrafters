// OMO-3484: 에디터 후가공 레이어 정의 모듈.
//
// 구성기(Configurator)에서 선택한 후가공(finishing) 값을 에디터 캔버스에
// 시각적 가이드 레이어로 표현하는 순수 함수들을 정의한다.
//
// 설계 원칙:
// - EditorClient.tsx 내 인라인 addFinishingLayers 의 로직을 캡슐화.
// - React 클로저(dims, scale) 를 직접 참조하지 않고, 호출측이 trim 영역
//   픽셀 좌표(FinishingGeom)를 주입(dependency injection)한다.
// - fabric 인스턴스도 파라미터로 받아 단위 테스트 가능하도록 분리.

// FinishingType: 지원 후가공 코드 (URL ?finishing= 값과 동일)
export type FinishingType =
  | 'foil_stamp'
  | 'deboss_emboss'
  | 'score_crease'
  | 'perforation'
  | 'drilled_hole'
  | 'die_cut'

/** 캔버스 px 기준 트림(재단선) 영역 좌표 + mm↔px 환산 함수. */
export interface FinishingGeom {
  /** 트림 영역 좌상단 x (px). */
  trimX: number
  /** 트림 영역 좌상단 y (px). */
  trimY: number
  /** 트림 영역 너비 (px). */
  trimW: number
  /** 트림 영역 높이 (px). */
  trimH: number
  /** mm → px 환산: mmToPx(mm) = mm * scale. */
  mmToPx: (mm: number) => number
  /** 고유 오브젝트 ID 생성 함수. */
  makeId: () => string
}

/** fabric 캔버스 최소 인터페이스 (테스트 / 순수 함수 목적). */
export interface FinishingCanvas {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add: (obj: any) => void
}

/** fabric 인스턴스 최소 인터페이스. fabric 실제 타입과 호환되도록 any 허용. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FinishingFabric = any

// ── 각 후가공별 단일 레이어 추가 함수 ─────────────────────────────────────────

/**
 * 박(foil_stamp): 금색 반투명 Rect — 트림 중앙 60%×25%.
 * data.finish=true 로 태깅되어 OMO-2706 별색판/OMO-3261 자동 치수감지 소스로 쓰임.
 */
export function addFoilStampLayer(
  canvas: FinishingCanvas,
  fabric: FinishingFabric,
  geom: FinishingGeom,
): void {
  const { trimX, trimY, trimW, trimH, makeId } = geom
  const foilW = trimW * 0.6
  const foilH = trimH * 0.25
  const foilRect = new fabric.Rect({
    left: trimX + (trimW - foilW) / 2,
    top: trimY + (trimH - foilH) / 2,
    width: foilW,
    height: foilH,
    fill: 'rgba(212,175,55,0.22)',
    stroke: 'rgba(212,175,55,0.9)',
    strokeWidth: 1.5,
    strokeDashArray: [6, 3],
    selectable: true,
    evented: true,
    data: { id: makeId(), name: '박 (금박) 영역', layerType: 'rect', finish: true, finishingType: 'foil_stamp' },
  })
  canvas.add(foilRect)
}

/**
 * 형압(deboss_emboss): 자주색 반투명 Rect — 트림 중앙 50%×30%.
 */
export function addDebossEmbossLayer(
  canvas: FinishingCanvas,
  fabric: FinishingFabric,
  geom: FinishingGeom,
): void {
  const { trimX, trimY, trimW, trimH, makeId } = geom
  const emW = trimW * 0.5
  const emH = trimH * 0.3
  const emRect = new fabric.Rect({
    left: trimX + (trimW - emW) / 2,
    top: trimY + trimH * 0.15,
    width: emW,
    height: emH,
    fill: 'rgba(139,92,246,0.15)',
    stroke: 'rgba(139,92,246,0.8)',
    strokeWidth: 1.5,
    strokeDashArray: [4, 3],
    selectable: true,
    evented: true,
    data: { id: makeId(), name: '형압 영역', layerType: 'rect', finishingType: 'deboss_emboss' },
  })
  canvas.add(emRect)
}

/**
 * 오시(score_crease): 에메랄드 수평 점선 — 트림 수직 중앙.
 */
export function addScoreCreaseLayer(
  canvas: FinishingCanvas,
  fabric: FinishingFabric,
  geom: FinishingGeom,
): void {
  const { trimX, trimY, trimW, trimH, makeId } = geom
  const scoreLine = new fabric.Line(
    [trimX, trimY + trimH / 2, trimX + trimW, trimY + trimH / 2],
    {
      stroke: 'rgba(16,185,129,0.9)',
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      selectable: true,
      evented: true,
      data: { id: makeId(), name: '오시(접지선)', layerType: 'rect', finishingType: 'score_crease' },
    },
  )
  canvas.add(scoreLine)
}

/**
 * 미싱(perforation): 주황 수평 점선 — 트림 75% 위치.
 */
export function addPerforationLayer(
  canvas: FinishingCanvas,
  fabric: FinishingFabric,
  geom: FinishingGeom,
): void {
  const { trimX, trimY, trimW, trimH, makeId } = geom
  const perfLine = new fabric.Line(
    [trimX, trimY + trimH * 0.75, trimX + trimW, trimY + trimH * 0.75],
    {
      stroke: 'rgba(249,115,22,0.9)',
      strokeWidth: 2,
      strokeDashArray: [3, 4],
      selectable: true,
      evented: true,
      data: { id: makeId(), name: '미싱(점선)', layerType: 'rect', finishingType: 'perforation' },
    },
  )
  canvas.add(perfLine)
}

/**
 * 타공(drilled_hole): 회색 원형 가이드 — 좌측 세로 중앙, 6mm 지름.
 */
export function addDrilledHoleLayer(
  canvas: FinishingCanvas,
  fabric: FinishingFabric,
  geom: FinishingGeom,
): void {
  const { trimX, trimY, trimH, mmToPx, makeId } = geom
  const holePx = mmToPx(6)
  const holeCircle = new fabric.Circle({
    left: trimX + mmToPx(6),
    top: trimY + (trimH - holePx) / 2,
    radius: holePx / 2,
    fill: 'rgba(100,116,139,0.15)',
    stroke: 'rgba(100,116,139,0.8)',
    strokeWidth: 1.5,
    strokeDashArray: [3, 2],
    selectable: true,
    evented: true,
    data: { id: makeId(), name: '타공(구멍)', layerType: 'rect', finishingType: 'drilled_hole' },
  })
  canvas.add(holeCircle)
}

/**
 * 도무송(die_cut): 핑크 둥근 모서리 Rect — 트림 내측 4mm 인셋.
 */
export function addDieCutLayer(
  canvas: FinishingCanvas,
  fabric: FinishingFabric,
  geom: FinishingGeom,
): void {
  const { trimX, trimY, trimW, trimH, mmToPx, makeId } = geom
  const dcRect = new fabric.Rect({
    left: trimX + mmToPx(4),
    top: trimY + mmToPx(4),
    width: trimW - mmToPx(8),
    height: trimH - mmToPx(8),
    fill: 'transparent',
    stroke: 'rgba(236,72,153,0.85)',
    strokeWidth: 2,
    strokeDashArray: [5, 4],
    rx: mmToPx(4),
    ry: mmToPx(4),
    selectable: true,
    evented: true,
    data: { id: makeId(), name: '도무송 외곽선', layerType: 'rect', finishingType: 'die_cut' },
  })
  canvas.add(dcRect)
}

// ── 통합 진입점 ──────────────────────────────────────────────────────────────

/** 후가공 타입 → 레이어 추가 함수 매핑. */
const FINISHING_LAYER_HANDLERS: Record<
  FinishingType,
  (canvas: FinishingCanvas, fabric: FinishingFabric, geom: FinishingGeom) => void
> = {
  foil_stamp: addFoilStampLayer,
  deboss_emboss: addDebossEmbossLayer,
  score_crease: addScoreCreaseLayer,
  perforation: addPerforationLayer,
  drilled_hole: addDrilledHoleLayer,
  die_cut: addDieCutLayer,
}

/**
 * 후가공 문자열(쉼표 구분)을 파싱해 캔버스에 해당 시각적 가이드 레이어를 추가한다.
 *
 * EditorClient.tsx 의 인라인 addFinishingLayers 를 대체한다.
 * 호출측이 dims/scale 클로저 대신 미리 계산한 FinishingGeom 을 주입한다.
 *
 * @param canvas   fabric.Canvas 인스턴스 (또는 add() 를 구현한 mock).
 * @param fabric   fabric 네임스페이스 (Rect/Line/Circle 생성자).
 * @param geom     트림 영역 px 좌표 + mm↔px 환산 + makeId 함수.
 * @param finishingStr  쉼표 구분 후가공 코드 문자열 (URL ?finishing= 값).
 */
export function addFinishingLayers(
  canvas: FinishingCanvas,
  fabric: FinishingFabric,
  geom: FinishingGeom,
  finishingStr: string,
): void {
  if (!finishingStr) return
  const types = finishingStr.split(',').map((s) => s.trim()).filter(Boolean) as FinishingType[]
  if (types.length === 0) return

  for (const type of types) {
    const handler = FINISHING_LAYER_HANDLERS[type]
    if (handler) {
      handler(canvas, fabric, geom)
    }
  }
}

// ── 후가공 레이어 표시 메타 (레이어 패널 배지/범례용) ─────────────────────────
//
// OMO-3484(전체 스코프): 후가공 가이드 레이어가 사용자 디자인 요소와 구분되도록
// 레이어 패널에 색상 배지로 표시한다. 배지색은 캔버스 가이드 stroke 색과 일치시켜
// "같은 후가공 = 같은 색" 인지 단서를 준다(박=금/형압=보라/오시=초록/미싱=주황/타공=회/도무송=핑크).

export interface FinishingLayerMeta {
  /** 레이어 패널 배지 라벨(한국어 후가공 명). */
  label: string
  /** 배지 Tailwind 클래스(배경+텍스트). 캔버스 가이드 색과 정렬. */
  badgeClass: string
  /** 범례 점(dot) Tailwind 배경 클래스. */
  dotClass: string
}

/** 후가공 타입 → 레이어 패널 표시 메타. */
export const FINISHING_LAYER_META: Record<FinishingType, FinishingLayerMeta> = {
  foil_stamp: { label: '박', badgeClass: 'bg-amber-100 text-amber-700', dotClass: 'bg-amber-400' },
  deboss_emboss: { label: '형압', badgeClass: 'bg-violet-100 text-violet-700', dotClass: 'bg-violet-400' },
  score_crease: { label: '오시', badgeClass: 'bg-emerald-100 text-emerald-700', dotClass: 'bg-emerald-400' },
  perforation: { label: '미싱', badgeClass: 'bg-orange-100 text-orange-700', dotClass: 'bg-orange-400' },
  drilled_hole: { label: '타공', badgeClass: 'bg-slate-100 text-slate-700', dotClass: 'bg-slate-400' },
  die_cut: { label: '도무송', badgeClass: 'bg-pink-100 text-pink-700', dotClass: 'bg-pink-400' },
}
