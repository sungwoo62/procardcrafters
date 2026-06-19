#!/usr/bin/env node
/**
 * OMO-3520: 명함 성원 입고규정에 맞춘 임의 인쇄파일(PDF) 자동생성.
 *
 * 규정 반영:
 *   - 재단(trim) 90×50mm + 도련(bleed) 1mm/면 → MediaBox = 92×52mm
 *   - TrimBox/BleedBox 명시 (성원 입고 RIP 가 재단선 인식)
 *   - DeviceCMYK 색공간 (RGB 금지)
 *   - 300dpi 가이드(벡터라 해상도 독립 — 메타에 명시. 래스터 요소 없음)
 *
 * 실행: node scripts/omo3520-gen-namecard-pdf.mjs [outPath]
 * 출력 기본값: scripts/test-artifacts/omo3520/namecard-test.pdf
 */
import * as fs from 'fs'
import * as path from 'path'

const MM = 2.834645669 // pt per mm
const TRIM = { w: 90, h: 50 }
const BLEED = 1
const PAGE = { w: TRIM.w + BLEED * 2, h: TRIM.h + BLEED * 2 } // 92 × 52 mm

const outPath = process.argv[2]
  ?? path.join(import.meta.dirname, 'test-artifacts', 'omo3520', 'namecard-test.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })

const pageW = (PAGE.w * MM).toFixed(2)
const pageH = (PAGE.h * MM).toFixed(2)
const trimX0 = (BLEED * MM).toFixed(2)
const trimY0 = (BLEED * MM).toFixed(2)
const trimX1 = ((BLEED + TRIM.w) * MM).toFixed(2)
const trimY1 = ((BLEED + TRIM.h) * MM).toFixed(2)

// content stream — DeviceCMYK. 전면 옅은 배경 + 재단영역 테두리 + 라벨 텍스트.
const content = `/DeviceCMYK cs
0 0 0 0.06 sc
0 0 ${pageW} ${pageH} re f
0 0 0 1 SC
0.5 w
${trimX0} ${trimY0} ${(TRIM.w * MM).toFixed(2)} ${(TRIM.h * MM).toFixed(2)} re S
BT
/F1 9 Tf
0 0 0 1 sc
${(BLEED * MM + 14).toFixed(2)} ${(BLEED * MM + 80).toFixed(2)} Td
(PROCARDCRAFTERS - SWADPIA E2E TEST) Tj
ET
BT
/F1 7 Tf
${(BLEED * MM + 14).toFixed(2)} ${(BLEED * MM + 62).toFixed(2)} Td
(Trim 90x50mm  Bleed 1mm  CMYK  300dpi) Tj
ET
BT
/F1 7 Tf
${(BLEED * MM + 14).toFixed(2)} ${(BLEED * MM + 46).toFixed(2)} Td
(OMO-3520 do-not-print test artifact) Tj
ET`

const objs = []
objs.push(`<< /Type /Catalog /Pages 2 0 R >>`)
objs.push(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`)
objs.push(
  `<< /Type /Page /Parent 2 0 R ` +
    `/MediaBox [0 0 ${pageW} ${pageH}] ` +
    `/TrimBox [${trimX0} ${trimY0} ${trimX1} ${trimY1}] ` +
    `/BleedBox [0 0 ${pageW} ${pageH}] ` +
    `/Resources << /Font << /F1 5 0 R >> >> ` +
    `/Contents 4 0 R >>`,
)
objs.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`)
objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)

let pdf = `%PDF-1.5\n%\xE2\xE3\xCF\xD3\n`
const offsets = []
objs.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, 'binary'))
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
})
const xrefStart = Buffer.byteLength(pdf, 'binary')
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
offsets.forEach((off) => {
  pdf += `${String(off).padStart(10, '0')} 00000 n \n`
})
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

fs.writeFileSync(outPath, Buffer.from(pdf, 'binary'))
const size = fs.statSync(outPath).size
process.stdout.write(
  `[omo3520] 규정 PDF 생성: ${outPath}\n` +
    `  MediaBox ${PAGE.w}×${PAGE.h}mm (trim ${TRIM.w}×${TRIM.h} + bleed ${BLEED}mm) · CMYK · ${size} bytes\n`,
)
