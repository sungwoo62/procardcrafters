// OMO-3577 (부모 OMO-3568): 에디터 별색 후가공판(p2) — 캔버스 오브젝트 선택 + M100 래스터 상수.
//
// 소스 단일성("별도 추정 금지"): "어떤 캔버스 오브젝트가 별색판에 들어가는가"의 진실원천.
//   별색판 대상 = `data.finish` 마커가 부여되고 보이는(visible !== false) 오브젝트.
// editor-foil-detect.ts(박 자동 치수 합집합 bbox)와 EditorClient.getFinishPlateDataUrl()
// (M100 별색판 래스터)이 **모두** 이 모듈의 isFinishPlateObject 로 동일 집합을 선택한다.
//   → 박 자동감지가 측정하는 오브젝트 집합 ≡ 별색판에 그려지는 오브젝트 집합 (오브젝트 집합 동일성).
//
// data.finish 마커는 고객이 박/형압/도무송/에폭시/별색 "영역"으로 지정한 오브젝트에 붙는다
// (EditorClient 별색 레이어 UI). 어떤 후가공 value 가 별색판(2페이지 합본)을 요구하는지는
// finishing-combined-pdf.ts 의 FINISHING_REQUIRES_SPOT_PLATE 가 진실원천이다(역할 분리).

/**
 * 별색판 1도 색. 성원애드피아 별색 후가공판(p2)은 "후가공이 들어갈 영역만 단색"으로 식별한다.
 * 순수 채널 분리를 위해 sRGB 순마젠타(M100)로 래스터한다 — 디자인판(p1) CMYK 와 명확히 구분.
 */
export const SPOT_PLATE_FILL = 'rgb(255,0,255)'
/** 별색판 배경 = 흰색(후가공 없는 영역). */
export const SPOT_PLATE_BG = '#ffffff'

/** isFinishPlateObject 가 보는 fabric 오브젝트 최소 형태. */
export interface FinishPlateObjectLike {
  /** 별색판 소스 마커. truthy 면 별색판 대상. */
  data?: { finish?: unknown } | null
  /** fabric visible. false 면 제외. */
  visible?: boolean
}

/**
 * 이 오브젝트가 별색판 대상인가: `data.finish` 가 truthy 이고 visible !== false.
 * (editor-foil-detect 합집합 bbox 소스 조건과 **동일** — OMO-3568 일관성 보장.)
 */
export function isFinishPlateObject(
  o: FinishPlateObjectLike | null | undefined,
): boolean {
  return !!(o && o.data?.finish && o.visible !== false)
}

/**
 * 캔버스 오브젝트 배열 → 별색판 대상 부분집합(입력 순서 유지).
 * 박 자동 치수(editor-foil-detect)와 별색판 래스터(getFinishPlateDataUrl)가 동일하게 호출 →
 * 두 경로의 오브젝트 집합이 결정론적으로 일치한다.
 */
export function selectFinishPlateObjects<T extends FinishPlateObjectLike>(
  objects: readonly T[] | null | undefined,
): T[] {
  if (!objects) return []
  return objects.filter((o) => isFinishPlateObject(o))
}

/** 캔버스에 별색판 대상 오브젝트가 하나라도 있는가(별색 후가공 발주 전 가드용). */
export function hasFinishPlateObjects(
  objects: readonly FinishPlateObjectLike[] | null | undefined,
): boolean {
  return selectFinishPlateObjects(objects).length > 0
}
