// OMO-3027 [OMO-3019-2]: 제품별 PDF 템플릿 동적 생성.
//
// OMO-3026 토대(`print_products.print_spec` → PrintSpec)를 읽어, 재단선·블리드·
// 세이프존·크롭마크가 마킹된 **빈** 인쇄 템플릿 PDF 를 즉석에서 만든다.
// 고객은 이 빈 템플릿을 받아 자기 디자인 툴(일러스트레이터 등)에서 작업한다.
//
// 정직성 가드(OMO-2975): 성원/타사 템플릿·치수·자산을 복제하지 않는다.
//   가이드 수치는 전부 `print_spec`(표준 규격 자체 산출, OMO-3026)에서만 온다.
//   브랜드 표기는 Procardcrafters 자체 표기만 사용한다(스왓피아 브랜딩 금지).
//
// 주: OMO-2709 `src/lib/spec-template.ts`(성원 규격 + M100 별색)와는 의도적으로 분리.
//     그 모듈은 성원 브랜드/후가공 별색 전용이고 사내 SSOT(printSpecs.ts)에 묶여 있다.
//     본 모듈은 DB 규격만으로 동작하는 고객 다운로드용 일반 템플릿이다.

import { PDFDocument, StandardFonts, cmyk, rgb } from 'pdf-lib'
import type { PrintSpec } from '@/lib/print-spec'

/** 1mm in PDF points (72dpi). */
const MM_TO_PT = 2.834645669

/**
 * PDF 표준폰트(Helvetica)는 WinAnsi 라 한글을 인코딩하지 못한다(throw).
 * 캔버스 텍스트는 ASCII 로 한정한다. 고객 노출 파일이라 메타데이터도 영문으로 통일
 * (한글 미포함) — 비영문 제품명이 들어와도 ?로 치환해 깨짐을 막는다.
 */
function asciiSafe(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x20-\x7E]/g, '?').replace(/\?+/g, '?').trim() || '-'
}

export interface TemplatePdfInput {
  /** 인쇄규격(트림/블리드/세이프/최소DPI/색공간). */
  spec: PrintSpec
  /** 캔버스 라벨·메타데이터용 제품명(영문 권장). */
  productLabel: string
}

/** 다운로드 파일명(안전 슬러그). */
export function templatePdfFileName(slug: string, spec: PrintSpec): string {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'product'
  return `pccf-template-${safeSlug}-${spec.width_mm}x${spec.height_mm}mm.pdf`
}

/**
 * PrintSpec 으로 빈 인쇄 템플릿 PDF 를 생성한다.
 *
 * 레이아웃(좌표계 원점 = 좌하단):
 *   · MediaBox/BleedBox = 블리드 포함 전체. TrimBox = 재단 영역.
 *   · 블리드 경계(빨강 점선) = 페이지 가장자리. 배경은 여기까지 채워야 한다.
 *   · 재단선(검정 실선) = 실제 잘리는 선. 블리드만큼 안쪽.
 *   · 세이프존(파랑 점선) = 중요한 내용은 이 안쪽. 재단선에서 세이프만큼 안쪽.
 *   · 크롭마크 = 4개 트림 코너 바깥의 L자 마크(블리드 영역 안).
 */
export async function buildPrintTemplatePdf(input: TemplatePdfInput): Promise<Uint8Array> {
  const { spec, productLabel } = input

  const trimWpt = spec.width_mm * MM_TO_PT
  const trimHpt = spec.height_mm * MM_TO_PT
  const bleedPt = spec.bleed_mm * MM_TO_PT
  const safePt = spec.safe_mm * MM_TO_PT
  const fullWpt = trimWpt + 2 * bleedPt
  const fullHpt = trimHpt + 2 * bleedPt

  const doc = await PDFDocument.create()
  const page = doc.addPage([fullWpt, fullHpt])

  // 박스 지정: Media/Bleed = 블리드 포함, Trim = 재단. (RIP/일러가 박스로 인식)
  page.setMediaBox(0, 0, fullWpt, fullHpt)
  page.setBleedBox(0, 0, fullWpt, fullHpt)
  page.setTrimBox(bleedPt, bleedPt, trimWpt, trimHpt)

  const font = await doc.embedFont(StandardFonts.Helvetica)

  // 비인쇄 가이드 색(고객이 출력 전 삭제 전제). 색공간은 인쇄 보존 위해 CMYK 사용.
  const bleedColor = cmyk(0, 1, 1, 0)    // 빨강 — 블리드 경계
  const trimColor = cmyk(0, 0, 0, 1)     // 검정 — 재단선
  const safeColor = cmyk(1, 0.6, 0, 0)   // 파랑 — 세이프존

  // 블리드 경계(빨강 점선) — 페이지 가장자리에서 살짝 안쪽으로 그려 가시화.
  page.drawRectangle({
    x: 0.3, y: 0.3, width: fullWpt - 0.6, height: fullHpt - 0.6,
    borderColor: bleedColor, borderWidth: 0.6, borderDashArray: [4, 2],
  })

  // 재단선(검정 실선).
  page.drawRectangle({
    x: bleedPt, y: bleedPt, width: trimWpt, height: trimHpt,
    borderColor: trimColor, borderWidth: 1,
  })

  // 세이프존(파랑 점선) — 세이프가 0이면 그리지 않는다.
  if (safePt > 0) {
    page.drawRectangle({
      x: bleedPt + safePt, y: bleedPt + safePt,
      width: trimWpt - 2 * safePt, height: trimHpt - 2 * safePt,
      borderColor: safeColor, borderWidth: 0.6, borderDashArray: [2, 2],
    })
  }

  // 크롭마크 — 4개 트림 코너 바깥의 L자 마크(블리드 영역 안에서만).
  // 마크 길이는 블리드 폭 이내, 트림 코너로부터 1pt 갭.
  const markLen = Math.max(2, Math.min(bleedPt - 1, 14))
  const gap = Math.min(1, bleedPt * 0.2)
  const corners = [
    { x: bleedPt, y: bleedPt, dx: -1, dy: -1 },                 // 좌하
    { x: bleedPt + trimWpt, y: bleedPt, dx: 1, dy: -1 },         // 우하
    { x: bleedPt, y: bleedPt + trimHpt, dx: -1, dy: 1 },         // 좌상
    { x: bleedPt + trimWpt, y: bleedPt + trimHpt, dx: 1, dy: 1 },// 우상
  ]
  if (bleedPt > gap + 1) {
    for (const c of corners) {
      // 트림 가장자리와 정렬된 두 직각 마크(가로·세로).
      page.drawLine({
        start: { x: c.x + c.dx * gap, y: c.y },
        end: { x: c.x + c.dx * (gap + markLen), y: c.y },
        thickness: 0.5, color: trimColor,
      })
      page.drawLine({
        start: { x: c.x, y: c.y + c.dy * gap },
        end: { x: c.x, y: c.y + c.dy * (gap + markLen) },
        thickness: 0.5, color: trimColor,
      })
    }
  }

  // 라벨(ASCII 한정). 한글 의미는 메타데이터에 보존.
  const labelY = fullHpt - bleedPt - 7
  if (labelY > bleedPt + 4) {
    page.drawText(asciiSafe(`${productLabel} print template`), {
      x: bleedPt + 3, y: labelY, size: 5, font, color: rgb(0.25, 0.25, 0.25),
    })
    page.drawText(
      `Trim ${spec.width_mm}x${spec.height_mm}mm  Bleed ${spec.bleed_mm}mm  Safe ${spec.safe_mm}mm  ${spec.color_mode} ${spec.min_dpi}dpi`,
      { x: bleedPt + 3, y: labelY - 6, size: 4, font, color: rgb(0.45, 0.45, 0.45) },
    )
  }

  // 범례(하단) — 가이드 색 의미. 공간이 충분할 때만.
  if (bleedPt + 12 < trimHpt) {
    page.drawText('Red=bleed  Black=trim  Blue=safe (delete guides before print)', {
      x: bleedPt + 3, y: bleedPt + 3, size: 3.6, font, color: rgb(0.55, 0.55, 0.55),
    })
  }

  // 메타데이터 — 고객(영문 사이트) 노출 파일이므로 한글 미포함, 전부 영문(OMO-3027 보드 지시).
  doc.setTitle(`${productLabel} print template — ${spec.width_mm}x${spec.height_mm}mm`)
  doc.setSubject(
    `Procardcrafters blank print-ready template. Trim ${spec.width_mm}x${spec.height_mm}mm / ` +
    `bleed ${spec.bleed_mm}mm / safe ${spec.safe_mm}mm / ${spec.color_mode} / min ${spec.min_dpi}dpi.`,
  )
  doc.setCreator('Procardcrafters')
  doc.setProducer('Procardcrafters print-template generator')
  doc.setKeywords(['procardcrafters', 'print template', 'bleed', 'trim', 'safe zone', productLabel])

  return doc.save()
}
