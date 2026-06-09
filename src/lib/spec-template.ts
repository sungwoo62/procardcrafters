// OMO-2709 [Part C] 성원 규격 템플릿 생성 — PDF / SVG / AI.
//
// 고객이 고른 스펙(제품·사이즈·후가공)으로 트림/블리드/세이프 가이드 +
// M100 별색(스팟) 레이어 placeholder 가 들어간 템플릿을 만든다.
// 고객은 이걸 받아 자기 일러로 작업 후 단일 합본으로 재업로드한다([OMO-2704] 결정).
//
// 포맷별 전략:
//   · PDF : pdf-lib 로 MediaBox=블리드, BleedBox=블리드, TrimBox=재단 으로 박스를 지정.
//           가이드/별색 placeholder 는 DeviceCMYK 로 그려 인쇄 색공간을 보존.
//   · SVG : mm 단위 viewBox + 레이어(<g inkscape:label>) 구조. 일러/잉크스케이프 호환.
//   · AI  : Illustrator 9 이후 .ai 는 PDF 컨테이너이므로 PDF 바이트를 그대로 .ai 로 제공.
//           (일러스트레이터가 PDF-호환 .ai 로 그대로 연다.)

import { PDFDocument, StandardFonts, cmyk, PDFName, PDFArray } from 'pdf-lib'
import {
  resolveSpecDims,
  resolveFinishingRules,
  M100_RGB_HEX,
  type PrintSpecDims,
  type FinishingSpotRule,
} from '@/config/printSpecs'

const MM_TO_PT = 2.834645669 // 1mm in PDF points (72dpi)

export interface TemplateSpec {
  productSlug: string
  productLabel?: string
  /** 사이즈 오버라이드(없으면 제품 기본값). */
  widthMm?: number
  heightMm?: number
  /** 선택한 후가공 value 배열(foil_stamp 등). */
  finishing: string[]
}

export interface ResolvedTemplate {
  dims: PrintSpecDims
  finishRules: FinishingSpotRule[]
  /** 재단(트림) 사이즈. */
  trimW: number
  trimH: number
  /** 블리드 포함 전체 사이즈. */
  fullW: number
  fullH: number
}

export function resolveTemplate(spec: TemplateSpec): ResolvedTemplate {
  const base = resolveSpecDims(spec.productSlug)
  const dims: PrintSpecDims = {
    ...base,
    widthMm: spec.widthMm ?? base.widthMm,
    heightMm: spec.heightMm ?? base.heightMm,
  }
  const trimW = dims.widthMm
  const trimH = dims.heightMm
  return {
    dims,
    finishRules: resolveFinishingRules(spec.finishing),
    trimW,
    trimH,
    fullW: trimW + 2 * dims.bleedMm,
    fullH: trimH + 2 * dims.bleedMm,
  }
}

// 파일명 안전 슬러그.
export function templateFileName(spec: TemplateSpec, ext: string): string {
  const r = resolveTemplate(spec)
  const fin = spec.finishing.length ? '-' + spec.finishing.join('-') : ''
  return `swadpia-template-${spec.productSlug}-${r.trimW}x${r.trimH}${fin}.${ext}`
}

// ─── SVG ──────────────────────────────────────────────────────────────────────
// mm 단위. 레이어: 가이드(트림/블리드/세이프) + 후가공별 M100 별색 placeholder.
export function buildTemplateSvg(spec: TemplateSpec): string {
  const r = resolveTemplate(spec)
  const { bleedMm, safeMm } = r.dims
  const W = r.fullW
  const H = r.fullH
  const tx = bleedMm
  const ty = bleedMm
  const tw = r.trimW
  const th = r.trimH
  const sx = bleedMm + safeMm
  const sy = bleedMm + safeMm
  const sw = tw - 2 * safeMm
  const sh = th - 2 * safeMm

  const label = spec.productLabel ?? spec.productSlug
  const finNote = r.finishRules.length
    ? r.finishRules.map((f) => `${f.label_ko}(${f.spotLayerName})`).join(', ')
    : '없음'

  const spotLayers = r.finishRules
    .map(
      (f) => `  <g inkscape:groupmode="layer" inkscape:label="${f.spotLayerName}" data-spot="M100" data-finish="${f.value}">
    <title>${f.spotLayerName} — ${f.note}</title>
    <!-- ${f.note} 외형 M100(${M100_RGB_HEX}) / 채널=별색 1도. -->
    <rect x="${sx + sw / 4}" y="${sy + sh / 4}" width="${sw / 2}" height="${sh / 2}"
      fill="none" stroke="${M100_RGB_HEX}" stroke-width="0.3" stroke-dasharray="1 1" opacity="0.7"/>
    <text x="${tx + tw / 2}" y="${ty + th / 2}" font-family="sans-serif" font-size="2.4"
      fill="${M100_RGB_HEX}" text-anchor="middle">${f.label_ko} 별색영역 (M100)</text>
  </g>`,
    )
    .join('\n')

  // 가이드: 블리드(빨강 점선) / 트림(검정 실선) / 세이프(파랑 점선).
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <title>성원 규격 템플릿 — ${label} ${tw}×${th}mm</title>
  <desc>트림 ${tw}×${th}mm / 블리드 ${bleedMm}mm / 세이프 ${safeMm}mm / 후가공 별색: ${finNote}. 외형 M100=별색 1도, K100·CMYK 금지(OMO-2704).</desc>
  <g inkscape:groupmode="layer" inkscape:label="가이드_비인쇄" data-guide="true">
    <title>가이드(비인쇄) — 출력 전 삭제</title>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#ff0000" stroke-width="0.25" stroke-dasharray="2 1"/>
    <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none" stroke="#000000" stroke-width="0.35"/>
    <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="none" stroke="#0066ff" stroke-width="0.25" stroke-dasharray="1 1"/>
    <text x="${tx}" y="${Math.max(ty - 1, 2)}" font-family="sans-serif" font-size="2">트림 ${tw}×${th}mm · 블리드 ${bleedMm}mm · 세이프 ${safeMm}mm</text>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="디자인_CMYK" data-design="true">
    <title>디자인(CMYK) — 여기에 작업</title>
  </g>
${spotLayers}
</svg>
`
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
export async function buildTemplatePdf(spec: TemplateSpec): Promise<Uint8Array> {
  const r = resolveTemplate(spec)
  const { bleedMm, safeMm } = r.dims
  const fullWpt = r.fullW * MM_TO_PT
  const fullHpt = r.fullH * MM_TO_PT
  const bleedPt = bleedMm * MM_TO_PT
  const safePt = (bleedMm + safeMm) * MM_TO_PT
  const trimWpt = r.trimW * MM_TO_PT
  const trimHpt = r.trimH * MM_TO_PT

  const doc = await PDFDocument.create()
  const page = doc.addPage([fullWpt, fullHpt])

  // 박스 지정: Media/Bleed = 블리드 포함, Trim = 재단.
  page.setMediaBox(0, 0, fullWpt, fullHpt)
  page.setBleedBox(0, 0, fullWpt, fullHpt)
  page.setTrimBox(bleedPt, bleedPt, trimWpt, trimHpt)

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const label = spec.productLabel ?? spec.productSlug

  // 가이드 — 비인쇄 의도지만 가시화를 위해 그린다(고객이 출력 전 삭제).
  // 블리드(빨강).
  page.drawRectangle({
    x: 0, y: 0, width: fullWpt, height: fullHpt,
    borderColor: cmyk(0, 1, 1, 0), borderWidth: 0.7, borderDashArray: [4, 2],
  })
  // 트림(검정).
  page.drawRectangle({
    x: bleedPt, y: bleedPt, width: trimWpt, height: trimHpt,
    borderColor: cmyk(0, 0, 0, 1), borderWidth: 1,
  })
  // 세이프(파랑).
  page.drawRectangle({
    x: safePt, y: safePt, width: trimWpt - 2 * safePt + 2 * bleedPt, height: trimHpt - 2 * safePt + 2 * bleedPt,
    borderColor: cmyk(1, 0.6, 0, 0), borderWidth: 0.7, borderDashArray: [2, 2],
  })

  page.drawText(`성원 규격 템플릿 / Swadpia template`, {
    x: bleedPt + 2, y: fullHpt - bleedPt - 8, size: 5, font, color: cmyk(0, 0, 0, 1),
  })
  page.drawText(`${label}  ${r.trimW}x${r.trimH}mm  bleed ${bleedMm}  safe ${safeMm}`, {
    x: bleedPt + 2, y: fullHpt - bleedPt - 15, size: 4.5, font, color: cmyk(0, 0, 0, 0.7),
  })

  // 후가공별 M100 별색 placeholder — 외형 M100(0,1,0,0).
  let noteY = bleedPt + 6
  for (const f of r.finishRules) {
    // 중앙 placeholder 박스.
    const pw = (trimWpt) / 2
    const ph = (trimHpt) / 2
    page.drawRectangle({
      x: bleedPt + (trimWpt - pw) / 2, y: bleedPt + (trimHpt - ph) / 2,
      width: pw, height: ph,
      borderColor: cmyk(0, 1, 0, 0), borderWidth: 0.6, borderDashArray: [3, 3],
    })
    page.drawText(`${f.spotLayerName} (M100 spot)`, {
      x: bleedPt + 2, y: noteY, size: 4, font, color: cmyk(0, 1, 0, 0),
    })
    noteY += 6
  }

  doc.setTitle(`Swadpia template — ${label} ${r.trimW}x${r.trimH}mm`)
  doc.setSubject('성원 규격 인쇄 템플릿 (트림/블리드/세이프 + M100 별색 레이어). OMO-2709')
  doc.setCreator('Procardcrafters — OMO-2709')
  doc.setKeywords(['swadpia', 'template', 'M100', 'spot', ...spec.finishing])

  // 별색 레이어 명을 OCProperties(레이어)로 등록 → 일러/아크로뱃에서 레이어로 인식.
  try {
    addSpotLayers(doc, r.finishRules)
  } catch {
    // 레이어 메타 실패는 템플릿 본질을 깨지 않으므로 무시.
  }

  return doc.save()
}

// PDF Optional Content(레이어) 메타데이터에 별색 레이어명을 노출.
// pdf-lib 저수준 API로 OCG/OCProperties 를 구성한다(이름만 등록 — 일러에서 레이어로 보임).
function addSpotLayers(doc: PDFDocument, rules: FinishingSpotRule[]): void {
  if (!rules.length) return
  const context = doc.context
  const ocgRefs: ReturnType<typeof context.register>[] = []
  for (const f of rules) {
    const ocg = context.obj({
      Type: PDFName.of('OCG'),
      Name: f.spotLayerName,
    })
    ocgRefs.push(context.register(ocg))
  }
  const orderArray = PDFArray.withContext(context)
  const onArray = PDFArray.withContext(context)
  for (const ref of ocgRefs) { orderArray.push(ref); onArray.push(ref) }

  const ocgListArray = PDFArray.withContext(context)
  for (const ref of ocgRefs) ocgListArray.push(ref)

  const dDict = context.obj({
    Order: orderArray,
    ON: onArray,
  })
  const ocProps = context.obj({
    OCGs: ocgListArray,
    D: dDict,
  })
  doc.catalog.set(PDFName.of('OCProperties'), ocProps)
}

// ─── AI ──────────────────────────────────────────────────────────────────────
// Illustrator 9+ .ai = PDF 컨테이너. PDF 바이트를 그대로 .ai 로 제공한다.
export async function buildTemplateAi(spec: TemplateSpec): Promise<Uint8Array> {
  return buildTemplatePdf(spec)
}
