// OMO-3568/OMO-3581: 후가공(박/형압/도무송/에폭시/별색) 자동발주용 **별색 합본 PDF** 파이프라인.
//
// 성원애드피아 별색 후가공 발주는 업로드 파일이 성원 "박인쇄 작업방법"(단면/양면) 규격의
// 합본 PDF여야 한다. OMO-3581 교정 규격(보드 지적 OMO-3578 3f7ecd85):
//   ① 박위치 보기용  — 박부분 **M100** 오버레이(디자인 위)
//   ② 인쇄파일(앞/뒤) — 칼라인쇄 파일에서 **박모양 삭제**
//   ③ 박파일         — 박모양 색상 **K100** (별색판; 양면 동일 박이면 박파일 1개)
// (종전 OMO-3577 은 p1 디자인 + p2 별색판(M100) 2페이지였다 → ① 누락, ② 미삭제,
//  ③ 색 M100 오류. 박 동판/도무송 목형/에폭시판은 이 K100 별색판 기준 제작이므로
//  잘못된 색·구성이면 후가공 손해. 본 모듈이 교정 합본 빌더 + 결정론 가드를 제공한다.)
//
// 업로드 슬롯(라이브 실측 OMO-3581): 성원 바로주문 = **단일 파일 슬롯**(order_file_name2).
//   → 위 ①②③ 을 **하나의 다중 페이지 PDF** 로 합본해 단일 슬롯에 업로드한다(다중 슬롯 없음).
//
// 소스 단일성: "어떤 후가공이 별색판을 요구하는가"는 이 모듈의 FINISHING_REQUIRES_SPOT_PLATE
// 하나가 진실원천이다(swadpia-finishing-fields.ts 의 finishingValue 키와 동일).
//
// 결정론: 페이지수 가드는 pdf-lib 의 실제 파싱 페이지수만 본다(OCR/추론 금지).
//   합본 빌더는 캔버스에서 래스터된 판 이미지들을 mm→pt 환산으로 순서대로 합본한다.

import { PDFDocument } from 'pdf-lib'

/**
 * 별색 후가공판(p2)을 **물리적으로 요구**하는 후가공 value 집합.
 * (finishing-catalog.ts / swadpia-finishing-fields.ts 의 finishingValue 와 동일 키)
 *
 *  - foil_stamp(박): 동판 = 별색판 영역 기준 제작
 *  - deboss_emboss(형압): 형압 동판 = 별색판 영역 기준
 *  - die_cut(도무송): 칼선/목형 = 별색판 영역 기준
 *  - epoxy(에폭시): 에폭시 도포 영역 = 별색판
 *  - spot_color(별색): 별색 인쇄 영역 = 별색판
 *
 * 타공/넘버링/귀도리/오시/미싱/코팅은 위치 좌표·수치 옵션으로 발주되며 별색판이
 * 필요 없다(별도 판 없이 후가공). 따라서 이 집합에서 제외한다.
 */
export const FINISHING_REQUIRES_SPOT_PLATE: ReadonlySet<string> = new Set([
  'foil_stamp',
  'deboss_emboss',
  'die_cut',
  'epoxy',
  'spot_color',
])

/** selectedOptions.finishing(콤마구분 value) 에서 후가공 value 목록을 파싱. */
/**
 * 확장된 성원 발주 폼 필드 prefix → 별색판을 요구하는 후가공 value.
 *
 * 왜 필요한가(OMO-3578): 자동발주 파이프라인은 `expandFinishingToSwadpiaFields()` 로
 * `finishing`(콤마 value) 키를 **제거**하고 성원 필드코드(bak_·ap_·domusong_·epoxy_)만
 * 남긴 options_snapshot 을 적재한다. 따라서 `selectedOptions.finishing` 만 보면 확장된
 * 실주문에서 가드가 한 번도 발동하지 못하는 dead code 가 된다(별색판 없이 발주 → 손해).
 * 이 prefix 매핑으로 확장된 옵션에서도 별색판 요구를 결정론적으로 검출한다.
 * (spot_color 는 별도 폼 필드가 없어 prefix 가 없다 → finishing value 로만 검출.)
 */
export const SPOT_PLATE_FIELD_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['bak_', 'foil_stamp'],
  ['ap_', 'deboss_emboss'],
  ['domusong_', 'die_cut'],
  ['epoxy_', 'epoxy'],
]

/** selectedOptions.finishing(콤마구분 value) 에서 후가공 value 목록을 파싱. */
export function parseFinishingValues(
  selectedOptions: Record<string, string> | undefined | null,
): string[] {
  const raw = selectedOptions?.finishing
  if (!raw) return []
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/**
 * 선택된 후가공 중 별색판을 요구하는 value 목록(중복 제거, 입력 순서 유지).
 * 두 경로를 모두 검출한다(OMO-3578):
 *   1) `finishing` value 목록(콤마구분) — 미확장 selectedOptions.
 *   2) 확장된 폼 필드 prefix(bak_·ap_·domusong_·epoxy_) — factory options_snapshot.
 * (2) 가 없으면 expandFinishingToSwadpiaFields 산출물에서 가드가 dead code 가 된다.
 */
export function listSpotPlateFinishings(
  selectedOptions: Record<string, string> | undefined | null,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (v: string) => {
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  // 1) finishing value 목록
  for (const v of parseFinishingValues(selectedOptions)) {
    if (FINISHING_REQUIRES_SPOT_PLATE.has(v)) add(v)
  }
  // 2) 확장된 폼 필드 prefix (finishing 키가 제거된 options_snapshot 대응)
  if (selectedOptions) {
    const keys = Object.keys(selectedOptions)
    for (const [prefix, finishingValue] of SPOT_PLATE_FIELD_PREFIXES) {
      if (keys.some((k) => k.startsWith(prefix))) add(finishingValue)
    }
  }
  return out
}

/** 이 주문이 별색 합본 PDF(p1+p2)를 요구하는가. */
export function requiresSpotPlate(
  selectedOptions: Record<string, string> | undefined | null,
): boolean {
  return listSpotPlateFinishings(selectedOptions).length > 0
}

/** pdf-lib 로 파싱한 실제 페이지수. (바이트가 PDF 가 아니면 throw) */
export async function getPdfPageCount(
  bytes: Uint8Array | ArrayBuffer,
): Promise<number> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  return doc.getPageCount()
}

export interface FinishingPdfGuardResult {
  /** 가드 통과 여부 */
  ok: boolean
  /** 별색판을 요구하는 후가공 value 목록(없으면 빈 배열) */
  spotPlateFinishings: string[]
  /** 이 주문이 요구하는 합본 PDF 페이지수(교정 규격). */
  expectedPageCount: number
  /** 실패 시 사유(한국어). ok=true 면 undefined. */
  errorMessage?: string
}

/** 단면/양면 분기 입력(성원 bak_side=BKD30 등에서 doubleSided 도출). */
export interface FinishingSideSpec {
  /** 양면 후가공 여부. */
  doubleSided?: boolean
  /** 양면이지만 앞/뒤 별색(박)이 동일 → 박파일 1개. */
  sameSpotBothSides?: boolean
}

/**
 * 교정 규격(OMO-3581) 합본 PDF 페이지수.
 *   위치보기용(1) + 인쇄(단면1·양면2) + 박파일(단면1·양면 distinct2·양면 동일1).
 * 단면 = 3 (위치보기용 + 인쇄 + 박파일K100).
 * 양면 distinct = 5, 양면 동일박 = 4.
 */
export function expectedFinishingPageCount(side?: FinishingSideSpec): number {
  const printPages = side?.doubleSided ? 2 : 1
  const spotPages = side?.doubleSided ? (side?.sameSpotBothSides ? 1 : 2) : 1
  return 1 /* 위치보기용 */ + printPages + spotPages
}

/**
 * 별색판 누락 결정론 가드(OMO-3581 교정). 별색 후가공이 선택됐는데 업로드 PDF 가
 * 교정 규격 페이지수(위치보기용+인쇄+박파일K100)와 다르면 차단한다.
 * 별색 후가공이 없으면 페이지수와 무관하게 통과(기존 주문 무영향).
 *
 * - pageCount === null      → PDF 가 아닌 업로드(.ai 등) → 별색 후가공이면 차단.
 * - pageCount !== expected   → 위치보기용/인쇄(박제거)/박파일(K100) 구성 불일치 → 차단.
 */
export function assertFinishingPlatePresent(args: {
  selectedOptions: Record<string, string> | undefined | null
  /** 업로드 파일 페이지수. PDF 가 아니어서 셀 수 없으면 null. */
  pageCount: number | null
  /** 업로드 파일 확장자(로그용, '.pdf' 등). */
  fileExt?: string
  /** 단면/양면 분기(미지정 시 단면=3페이지 기준). */
  side?: FinishingSideSpec
}): FinishingPdfGuardResult {
  const spotPlateFinishings = listSpotPlateFinishings(args.selectedOptions)
  const expectedPageCount = expectedFinishingPageCount(args.side)
  if (spotPlateFinishings.length === 0) {
    return { ok: true, spotPlateFinishings, expectedPageCount }
  }

  const labels = spotPlateFinishings.join(', ')
  const spec = `위치보기용(M100) + 인쇄(박제거) + 박파일(K100) ${expectedPageCount}페이지`
  if (args.pageCount === null) {
    return {
      ok: false,
      spotPlateFinishings,
      expectedPageCount,
      errorMessage:
        `별색 후가공(${labels})은 합본 PDF(${spec}) 업로드가 필요합니다. ` +
        `현재 업로드(${args.fileExt ?? '비PDF'})는 페이지 검증이 불가합니다.`,
    }
  }
  if (args.pageCount !== expectedPageCount) {
    return {
      ok: false,
      spotPlateFinishings,
      expectedPageCount,
      errorMessage:
        `별색 후가공(${labels})은 합본 PDF ${spec}가 필요합니다. ` +
        `현재 업로드 페이지수=${args.pageCount}. 위치보기용/인쇄(박제거)/박파일(K100) 구성 불일치.`,
    }
  }
  return { ok: true, spotPlateFinishings, expectedPageCount }
}

const MM_TO_PT = 72 / 25.4

/** mm → PDF point. */
export function mmToPt(mm: number): number {
  return mm * MM_TO_PT
}

export type PlateImageMime = 'image/png' | 'image/jpeg'

export interface PlateImage {
  bytes: Uint8Array | ArrayBuffer
  mime: PlateImageMime
}

/**
 * 교정 규격(OMO-3581) 합본 PDF 구성 판들. 페이지는 아래 순서로 합본된다(성원 가이드 기준):
 *   위치보기용(M100) → 인쇄(앞, 박제거) → [인쇄(뒤)] → 박파일(앞, K100) → [박파일(뒤)].
 */
export interface BuildCombinedFinishingPdfOptions {
  /** 박위치 보기용 — 박부분 M100 오버레이(디자인 위). */
  positionOverlay: PlateImage
  /** 인쇄파일(앞) — 칼라인쇄에서 박모양 삭제. */
  printPlate: PlateImage
  /** 박파일(앞) — 박모양 K100 별색판. */
  spotPlate: PlateImage
  /** 인쇄파일(뒤) — 양면 후가공 시. */
  backPrintPlate?: PlateImage
  /** 박파일(뒤) — 양면 후가공 시. 앞/뒤 동일 박이면 생략(박파일 1개). */
  backSpotPlate?: PlateImage
  /** 페이지 가로(mm) — 보통 trim + bleed. */
  pageWidthMm: number
  /** 페이지 세로(mm) — 보통 trim + bleed. */
  pageHeightMm: number
}

async function embedPlate(doc: PDFDocument, plate: PlateImage) {
  return plate.mime === 'image/png'
    ? doc.embedPng(plate.bytes)
    : doc.embedJpg(plate.bytes)
}

/**
 * 별색 합본 PDF(위치보기용 + 인쇄[박제거] + 박파일[K100])를 성원 교정 규격(OMO-3581)으로
 * 생성한다. 모든 판은 동일 페이지 규격(가로×세로 mm)으로 풀블리드 배치한다(추론·여백 가정 없음).
 *
 * 페이지 순서: 위치보기용 → 인쇄(앞) → [인쇄(뒤)] → 박파일(앞) → [박파일(뒤)].
 * 반환: PDF 바이트. assertFinishingPlatePresent(같은 side) 가드를 통과한다.
 */
export async function buildCombinedFinishingPdf(
  opts: BuildCombinedFinishingPdfOptions,
): Promise<Uint8Array> {
  if (!(opts.pageWidthMm > 0) || !(opts.pageHeightMm > 0)) {
    throw new Error('buildCombinedFinishingPdf: pageWidthMm/pageHeightMm must be > 0')
  }
  // 성원 가이드 페이지 순서.
  const ordered: PlateImage[] = [opts.positionOverlay, opts.printPlate]
  if (opts.backPrintPlate) ordered.push(opts.backPrintPlate)
  ordered.push(opts.spotPlate)
  if (opts.backSpotPlate) ordered.push(opts.backSpotPlate)

  const doc = await PDFDocument.create()
  const wPt = mmToPt(opts.pageWidthMm)
  const hPt = mmToPt(opts.pageHeightMm)
  for (const plate of ordered) {
    const page = doc.addPage([wPt, hPt])
    const img = await embedPlate(doc, plate)
    page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt })
  }
  return doc.save()
}
