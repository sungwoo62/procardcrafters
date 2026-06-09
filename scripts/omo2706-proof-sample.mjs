// OMO-2706 / OMO-2712 게이트 — 성원 실인쇄 프루프용 샘플 AI 1건 산출.
//
// 본 스크립트는 src/lib/spec-template.ts 의 buildTemplatePdf() 로직을
// 동일한 SSOT 값(src/config/printSpecs.ts)으로 재현한다. tsx 미설치 환경이라
// 프로덕션 모듈을 직접 import 하는 대신 pdf-lib 로 같은 바이트를 만든다.
// 결과물은 /api/template?format=ai&product=business_cards&finish=foil_stamp 와 1:1 동등.
//
// 산출: 단일 합본 .ai (= PDF 컨테이너, Illustrator 9+ 호환).
//   · 박스: MediaBox/BleedBox = 블리드 포함, TrimBox = 재단.
//   · M100 외형 = DeviceCMYK(0,1,0,0) — K100·process CMYK 금지(OMO-2704).
//   · 명명 별색 레이어(OCG) = 'M100_별색_박' (UTF-16), ASCII ID = M100_SPOT_FOIL.

import { PDFDocument, StandardFonts, cmyk, PDFName, PDFArray, PDFHexString } from 'pdf-lib'
import { writeFileSync, mkdirSync } from 'node:fs'

const MM_TO_PT = 2.834645669

// ── SSOT 미러 (src/config/printSpecs.ts) ──────────────────────────────────────
// business_cards: 85×55mm, bleed 3, safe 3
const DIMS = { widthMm: 85, heightMm: 55, bleedMm: 3, safeMm: 3 }
// foil_stamp 별색 규칙
const FOIL = {
  value: 'foil_stamp',
  label_ko: '박',
  spotLayerName: 'M100_별색_박',
  spotLayerId: 'M100_SPOT_FOIL',
  note: '박 적용 영역을 이 레이어에 M100(별색 1도)으로 작도하세요. K100·CMYK 금지.',
}
const LABEL = '프리미엄 명함(박)'

function asciiSafe(s) {
  return s.replace(/[^\x20-\x7E]/g, '?').replace(/\?+/g, '?').trim() || '-'
}

function addSpotLayers(doc, rules) {
  if (!rules.length) return
  const context = doc.context
  const ocgRefs = []
  for (const f of rules) {
    const ocg = context.obj({
      Type: PDFName.of('OCG'),
      Name: PDFHexString.fromText(f.spotLayerName), // UTF-16 → 한글 레이어명 보존
    })
    ocgRefs.push(context.register(ocg))
  }
  const orderArray = PDFArray.withContext(context)
  const onArray = PDFArray.withContext(context)
  for (const ref of ocgRefs) { orderArray.push(ref); onArray.push(ref) }
  const ocgListArray = PDFArray.withContext(context)
  for (const ref of ocgRefs) ocgListArray.push(ref)
  const dDict = context.obj({ Order: orderArray, ON: onArray })
  const ocProps = context.obj({ OCGs: ocgListArray, D: dDict })
  doc.catalog.set(PDFName.of('OCProperties'), ocProps)
}

async function buildProofPdf() {
  const trimW = DIMS.widthMm, trimH = DIMS.heightMm
  const fullW = trimW + 2 * DIMS.bleedMm, fullH = trimH + 2 * DIMS.bleedMm
  const fullWpt = fullW * MM_TO_PT, fullHpt = fullH * MM_TO_PT
  const bleedPt = DIMS.bleedMm * MM_TO_PT
  const safePt = (DIMS.bleedMm + DIMS.safeMm) * MM_TO_PT
  const trimWpt = trimW * MM_TO_PT, trimHpt = trimH * MM_TO_PT

  const doc = await PDFDocument.create()
  const page = doc.addPage([fullWpt, fullHpt])
  page.setMediaBox(0, 0, fullWpt, fullHpt)
  page.setBleedBox(0, 0, fullWpt, fullHpt)
  page.setTrimBox(bleedPt, bleedPt, trimWpt, trimHpt)

  const font = await doc.embedFont(StandardFonts.Helvetica)

  // 가이드: 블리드(빨강)/트림(검정)/세이프(파랑)
  page.drawRectangle({ x: 0, y: 0, width: fullWpt, height: fullHpt, borderColor: cmyk(0, 1, 1, 0), borderWidth: 0.7, borderDashArray: [4, 2] })
  page.drawRectangle({ x: bleedPt, y: bleedPt, width: trimWpt, height: trimHpt, borderColor: cmyk(0, 0, 0, 1), borderWidth: 1 })
  page.drawRectangle({ x: safePt, y: safePt, width: trimWpt - 2 * safePt + 2 * bleedPt, height: trimHpt - 2 * safePt + 2 * bleedPt, borderColor: cmyk(1, 0.6, 0, 0), borderWidth: 0.7, borderDashArray: [2, 2] })

  page.drawText('Swadpia print template (M100 spot finishing)', { x: bleedPt + 2, y: fullHpt - bleedPt - 8, size: 5, font, color: cmyk(0, 0, 0, 1) })
  page.drawText(`${asciiSafe(LABEL)}  ${trimW}x${trimH}mm  bleed ${DIMS.bleedMm}  safe ${DIMS.safeMm}`, { x: bleedPt + 2, y: fullHpt - bleedPt - 15, size: 4.5, font, color: cmyk(0, 0, 0, 0.7) })

  // 후가공 M100 별색 placeholder — DeviceCMYK(0,1,0,0)
  const pw = trimWpt / 2, ph = trimHpt / 2
  page.drawRectangle({ x: bleedPt + (trimWpt - pw) / 2, y: bleedPt + (trimHpt - ph) / 2, width: pw, height: ph, borderColor: cmyk(0, 1, 0, 0), borderWidth: 0.6, borderDashArray: [3, 3] })
  page.drawText(`${FOIL.spotLayerId} (M100 spot / ${asciiSafe(FOIL.label_ko)})`, { x: bleedPt + 2, y: bleedPt + 6, size: 4, font, color: cmyk(0, 1, 0, 0) })

  doc.setTitle(`Swadpia template — ${LABEL} ${trimW}x${trimH}mm`)
  doc.setSubject('성원 규격 인쇄 템플릿 (트림/블리드/세이프 + M100 별색 레이어). OMO-2709/2706')
  doc.setCreator('Procardcrafters — OMO-2706 proof sample')
  doc.setKeywords(['swadpia', 'template', 'M100', 'spot', 'foil_stamp'])

  addSpotLayers(doc, [FOIL])
  return doc.save()
}

const bytes = await buildProofPdf()
const outDir = 'scripts/test-artifacts/omo2706-proof'
mkdirSync(outDir, { recursive: true })
const aiPath = `${outDir}/swadpia-proof-business_cards-85x55-foil_stamp.ai`
writeFileSync(aiPath, bytes)
console.log(`[OK] proof AI written: ${aiPath} (${bytes.length} bytes)`)
console.log(`     M100=DeviceCMYK(0,1,0,0)  spotLayer='M100_별색_박'(OCG, UTF-16)  trim 85x55 / bleed 3 / safe 3`)
