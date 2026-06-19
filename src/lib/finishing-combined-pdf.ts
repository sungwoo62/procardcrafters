// OMO-3568: 후가공(박/형압/도무송/에폭시/별색) 자동발주용 **별색 합본 PDF** 파이프라인.
//
// 성원애드피아의 별색 후가공 발주는 업로드 파일이 합본 PDF여야 한다:
//   p1 = 디자인판(CMYK 인쇄면)
//   p2 = 별색 후가공판(스팟 1도, M100 마젠타) — 박/형압/도무송칼선/에폭시/별색이
//        들어갈 "영역"만 단색으로 출력한 판.
// p2가 누락되면 후가공이 빠진 채 인쇄되어 손해가 발생한다(박 동판/도무송 목형은
// 이 별색판을 기준으로 제작). swadpia-order.ts 는 지금까지 단일 파일만 업로드했고
// 별색판 누락을 막는 가드가 없었다 → 본 모듈이 그 결정론 가드와 합본 빌더를 제공한다.
//
// 소스 단일성: "어떤 후가공이 별색판을 요구하는가"는 이 모듈의 FINISHING_REQUIRES_SPOT_PLATE
// 하나가 진실원천이다(swadpia-finishing-fields.ts 의 finishingValue 키와 동일).
//
// 결정론: 페이지수 가드는 pdf-lib 의 실제 파싱 페이지수만 본다(OCR/추론 금지).
//   합본 빌더는 캔버스에서 래스터된 두 판 이미지를 mm→pt 환산으로 그대로 합본한다.

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

/** 선택된 후가공 중 별색판(p2)을 요구하는 value 목록(중복 제거, 입력 순서 유지). */
export function listSpotPlateFinishings(
  selectedOptions: Record<string, string> | undefined | null,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of parseFinishingValues(selectedOptions)) {
    if (FINISHING_REQUIRES_SPOT_PLATE.has(v) && !seen.has(v)) {
      seen.add(v)
      out.push(v)
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
  /** 실패 시 사유(한국어). ok=true 면 undefined. */
  errorMessage?: string
}

/**
 * 별색판 누락 결정론 가드. 별색 후가공이 선택됐는데 합본 PDF(정확히 2페이지)가
 * 아니면 차단한다. 별색 후가공이 없으면 페이지수와 무관하게 통과(기존 주문 무영향).
 *
 * - pageCount === null  → PDF 가 아닌 업로드(.ai 등). 별색 후가공이면 차단(합본 PDF 필요),
 *   아니면 통과.
 * - pageCount !== 2     → 별색 후가공인데 p2 별색판 누락(1p) 혹은 페이지 과다 → 차단.
 */
export function assertFinishingPlatePresent(args: {
  selectedOptions: Record<string, string> | undefined | null
  /** 업로드 파일 페이지수. PDF 가 아니어서 셀 수 없으면 null. */
  pageCount: number | null
  /** 업로드 파일 확장자(로그용, '.pdf' 등). */
  fileExt?: string
}): FinishingPdfGuardResult {
  const spotPlateFinishings = listSpotPlateFinishings(args.selectedOptions)
  if (spotPlateFinishings.length === 0) {
    return { ok: true, spotPlateFinishings }
  }

  const labels = spotPlateFinishings.join(', ')
  if (args.pageCount === null) {
    return {
      ok: false,
      spotPlateFinishings,
      errorMessage:
        `별색 후가공(${labels})은 합본 PDF(p1 디자인판 + p2 별색판) 업로드가 필요합니다. ` +
        `현재 업로드(${args.fileExt ?? '비PDF'})는 페이지 검증이 불가합니다.`,
    }
  }
  if (args.pageCount !== 2) {
    return {
      ok: false,
      spotPlateFinishings,
      errorMessage:
        `별색 후가공(${labels})은 합본 PDF 2페이지(p1 디자인판 + p2 별색판)가 필요합니다. ` +
        `현재 업로드 페이지수=${args.pageCount}. p2 별색판 누락 또는 페이지 과다.`,
    }
  }
  return { ok: true, spotPlateFinishings }
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

export interface BuildCombinedFinishingPdfOptions {
  /** p1 디자인판(CMYK 인쇄면) 래스터 이미지. */
  designPlate: PlateImage
  /** p2 별색 후가공판(스팟 1도 M100, 흰 배경) 래스터 이미지. */
  spotPlate: PlateImage
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
 * 별색 합본 PDF(p1 디자인판 + p2 별색판)를 생성한다.
 * 두 판 모두 동일 페이지 규격(가로×세로 mm)으로 풀블리드 배치한다 → 성원 후가공
 * 발주가 요구하는 2페이지 합본을 결정론적으로 합성(추론·여백 가정 없음).
 *
 * 반환: PDF 바이트(Uint8Array). assertFinishingPlatePresent 가드를 통과한다(2페이지).
 */
export async function buildCombinedFinishingPdf(
  opts: BuildCombinedFinishingPdfOptions,
): Promise<Uint8Array> {
  if (!(opts.pageWidthMm > 0) || !(opts.pageHeightMm > 0)) {
    throw new Error('buildCombinedFinishingPdf: pageWidthMm/pageHeightMm must be > 0')
  }
  const doc = await PDFDocument.create()
  const wPt = mmToPt(opts.pageWidthMm)
  const hPt = mmToPt(opts.pageHeightMm)

  const p1 = doc.addPage([wPt, hPt])
  const img1 = await embedPlate(doc, opts.designPlate)
  p1.drawImage(img1, { x: 0, y: 0, width: wPt, height: hPt })

  const p2 = doc.addPage([wPt, hPt])
  const img2 = await embedPlate(doc, opts.spotPlate)
  p2.drawImage(img2, { x: 0, y: 0, width: wPt, height: hPt })

  return doc.save()
}
