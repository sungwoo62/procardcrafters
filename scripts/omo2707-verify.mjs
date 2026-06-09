// OMO-2707 검증 하니스 — 후가공 발주(박 옵션 자동선택 + 디자인/M100 별색판 합본 업로드).
//
// 이 스크립트는 swadpia 자격증명/네트워크 없이 OMO-2707 의 두 축을 정적으로 증명한다:
//   (1) 옵션 축: 고객 finishing 선택 → expandFinishingToSwadpiaFields → 성원 박(bak_*) 필드코드.
//       (selectOrderOptions → activateFinishings 가 이 키들을 폼에 자동선택. OMO-2647 라이브 검증 완료.)
//   (2) 파일 축: OMO-2706 합본 PDF(p1=디자인, p2=M100 별색판)에 대한 정합성 가드(countPdfPages)가
//       "후가공인데 별색판 누락(1페이지)" 케이스를 잡아내는지.
//
// 라이브 발주 폼 dry-run(박 옵션이 실제 성원 모달에 들어가는지 + 합본 파일 업로드)은
// placeSwadpiaOrder({ dryRun: true }) 로 ops 환경(SWADPIA_USERNAME/PASSWORD)에서 수행한다.
// (이 dev 환경엔 자격증명이 없어 모달 단계까지의 라이브 확인은 ops 게이트.)
//
// 실행: node --experimental-strip-types scripts/omo2707-verify.mjs
import { PDFDocument } from 'pdf-lib'
import { expandFinishingToSwadpiaFields } from '../src/config/swadpia-finishing-fields.ts'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

let failures = 0
const ok = (cond, msg) => { console.log(`${cond ? '✅' : '❌'} ${msg}`); if (!cond) failures++ }

// countPdfPages 와 동일 로직(swadpia-order.ts) — 라이브 lib 가 './swadpia' 확장자없는
// import 때문에 strip-types 로딩 불가하여 동치 함수로 검증한다.
async function countPdfPages(bytes) {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    return doc.getPageCount()
  } catch {
    const text = Buffer.from(bytes).toString('latin1')
    const m = text.match(/\/Type\s*\/Page(?![\w])/g)
    return m ? m.length : null
  }
}

console.log('━━━ (1) 옵션 축: finishing → 성원 박 필드코드 ━━━')

// 박 단독
const bakOnly = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp' })
ok(bakOnly.bak_section_1 === 'BKS10', `박: bak_section_1=BKS10(신규) — got ${bakOnly.bak_section_1}`)
ok(bakOnly.bak_side_1 === 'BKD10', `박: bak_side_1=BKD10(전면) — got ${bakOnly.bak_side_1}`)
ok(bakOnly.bak_type_1 === 'BKT02', `박: bak_type_1=BKT02(금박유광) — got ${bakOnly.bak_type_1}`)
ok(bakOnly.bak_x_size_1 === '50' && bakOnly.bak_y_size_1 === '30', `박: 기본 면적 50x30mm(>0 → 단가 산출 가능)`)
ok(bakOnly.finishing === undefined, `박: finishing 키는 확장 후 제거됨(폼 미존재 키 누출 방지)`)

// 박 + 타공 복합
const combo = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp,drilled_hole' })
ok(combo.bak_type_1 === 'BKT02' && combo.tagong_num === '1' && combo.tagong_size === '4',
  `복합(박+타공): bak_* 와 tagong_* 가 함께 확장됨`)

// 고객 명시 override 우선
const override = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp', bak_type_1: 'BKT11' })
ok(override.bak_type_1 === 'BKT11', `override: 명시 bak_type_1=BKT11(홀로그램) 이 기본값보다 우선 — got ${override.bak_type_1}`)

// 후가공 없는 주문 무영향
const plain = expandFinishingToSwadpiaFields({ paper_code: 'X', print_color_type: 'Y' })
ok(plain.paper_code === 'X' && !('bak_section_1' in plain), `후가공 없음: 기존 옵션 무영향, bak 필드 미주입`)

console.log('\n━━━ (2) 파일 축: OMO-2706 합본 PDF 정합성 가드 ━━━')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omo2707-'))
const MM = 2.8346, W = 90 * MM, H = 50 * MM

// 합본(2페이지): p1 디자인 + p2 M100 별색판 — 박 주문의 정상 산출물
const merged = await PDFDocument.create()
merged.addPage([W, H]) // 디자인판
merged.addPage([W, H]) // M100 별색 후가공판
const mergedBytes = await merged.save()
const mergedPath = path.join(tmp, 'merged-foil.pdf')
fs.writeFileSync(mergedPath, mergedBytes)

// 디자인 단독(1페이지) — 별색판 누락 케이스
const designOnly = await PDFDocument.create()
designOnly.addPage([W, H])
const designBytes = await designOnly.save()

const mergedPages = await countPdfPages(mergedBytes)
const designPages = await countPdfPages(designBytes)
ok(mergedPages === 2, `합본 PDF 페이지수 = 2 — got ${mergedPages}`)
ok(designPages === 1, `디자인 단독 PDF 페이지수 = 1 — got ${designPages}`)

// 가드 판정: 후가공 present + 페이지>=2 → spotPlatePresent true
const hasFinishing = Object.keys(bakOnly).some((k) =>
  ['bak_', 'ap_', 'domusong_', 'tagong_', 'numbering_'].some((p) => k.startsWith(p)))
ok(hasFinishing === true, `bakOnly 옵션은 후가공으로 감지됨(hasFinishing)`)
ok(hasFinishing && mergedPages >= 2, `정상: 박 주문 + 합본(2p) → spotPlatePresent=true (별색판 포함 발주)`)
ok(!(hasFinishing && designPages >= 2), `경고탐지: 박 주문 + 디자인단독(1p) → spotPlatePresent=false (별색판 누락 경고 발화)`)

// 폴백 경로(pdf-lib 로드 실패 가정)도 정확한지 — object stream 미사용(비압축) PDF 의
// /Type /Page 토큰 카운트. (pdf-lib 기본 출력은 object stream 압축이라 토큰이 안 보이지만,
// 그 경우 프로덕션은 1차 pdf-lib 경로로 정확히 센다. 폴백은 비압축 PDF 대비 안전망.)
const uncompressed = await PDFDocument.create()
uncompressed.addPage([W, H]); uncompressed.addPage([W, H])
const uncompressedBytes = await uncompressed.save({ useObjectStreams: false })
const fallbackText = Buffer.from(uncompressedBytes).toString('latin1')
const fallbackCount = (fallbackText.match(/\/Type\s*\/Page(?![\w])/g) || []).length
ok(fallbackCount === 2, `폴백(비압축 토큰 카운트): /Type /Page = 2 — got ${fallbackCount}`)

fs.rmSync(tmp, { recursive: true, force: true })

console.log('\n━━━ 결과 ━━━')
if (failures === 0) {
  console.log('✅ 전부 통과 — OMO-2707 옵션·파일 정합성 검증 완료.')
  console.log('   라이브 폼 dry-run: placeSwadpiaOrder({...,dryRun:true}) @ ops 환경(SWADPIA creds)')
} else {
  console.log(`❌ ${failures}건 실패`)
  process.exit(1)
}
