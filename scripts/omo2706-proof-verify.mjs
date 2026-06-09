// OMO-2706 프루프 샘플 구조 검증 — 박스/OCG 레이어명/메타.
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync } from 'node:fs'

const f = 'scripts/test-artifacts/omo2706-proof/swadpia-proof-business_cards-85x55-foil_stamp.ai'
const doc = await PDFDocument.load(readFileSync(f))
const node = doc.getPage(0).node
console.log('MediaBox:', node.get(PDFName.of('MediaBox'))?.toString())
console.log('TrimBox :', node.get(PDFName.of('TrimBox'))?.toString())
console.log('BleedBox:', node.get(PDFName.of('BleedBox'))?.toString())

const oc = doc.catalog.get(PDFName.of('OCProperties'))
console.log('OCProperties present:', !!oc)
const ctx = doc.context
const ocgs = oc.get(PDFName.of('OCGs'))
const ocg = ctx.lookup(ocgs.get(0))
const name = ocg.get(PDFName.of('Name'))
console.log('OCG[0] Name (decoded):', name.decodeText())
console.log('Title  :', doc.getTitle())
console.log('Subject:', doc.getSubject())

// 기대: 블리드 91x61mm = 257.95x172.91pt, 트림 85x55mm @ offset 3mm = 8.5pt
const MM = 2.834645669
console.log('expected full 91x61mm =', (91*MM).toFixed(2), 'x', (61*MM).toFixed(2), 'pt')
console.log('expected trim 85x55mm @8.5pt offset')
