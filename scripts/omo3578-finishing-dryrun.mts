/**
 * OMO-3578: 후가공 전옵션 자동발주 **dry-run 회귀** — 박/형압/도무송/에폭시 + 합본PDF 가드.
 *
 * 부모 OMO-3568 #3. 별색 합본 PDF(OMO-3581 교정 규격: 위치보기용 M100 + 인쇄 박제거 +
 * 박파일 K100 — 단면 3p / 양면 4~5p) 가드와 후가공 자동발주 정합을 결제 없이 회귀한다.
 *
 * ⚠️ 안전 계약 (절대 위반 금지):
 *   - placeSwadpiaOrder({ dryRun: true }) 만 호출한다 → 로그인·옵션·후가공·파일업로드
 *     까지만 수행하고 주문서 생성/주문확인/결제(paySubmit) 는 **호출하지 않는다**.
 *   - 성원 실발주(결제) 금지. 라이브 가격 라우팅 변경 없음. READ-ONLY(결제 직전까지).
 *   - 자동발주는 VPS/로컬 러너 전용 — Vercel serverless 불가.
 *
 * 실행 환경: place-factory-orders.ts 와 동일한 VPS/로컬 러너(자동발주 환경)에서 실행한다
 *   (swadpia-order.ts 는 `@/` alias·확장자없는 import 로 그 러너 셋업에서만 로딩된다).
 * 실행 (자격증명 필요: SWADPIA_USERNAME / SWADPIA_PASSWORD):
 *   node --experimental-strip-types --env-file=.env.local scripts/omo3578-finishing-dryrun.mts
 *
 * 출력: 각 별색 후가공별 { 가드 통과여부, total_price 직독, 적용된 폼 필드값, 활성 패널 }.
 *       별색판 누락(1페이지) negative 케이스는 자격증명·네트워크 없이도 차단을 확인한다.
 *
 * 참고: 가드 단락(negative) + 확장필드 검출 로직의 오프라인 회귀는 vitest 로 상시 검증된다
 *   (src/lib/__tests__/swadpia-order-dryrun.test.ts, finishing-combined-pdf.test.ts).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { placeSwadpiaOrder } from '../src/lib/swadpia-order.ts'
import { buildCombinedFinishingPdf, type PlateImage } from '../src/lib/finishing-combined-pdf.ts'
import { expandFinishingToSwadpiaFields } from '../src/config/swadpia-finishing-fields.ts'

const CATEGORY = process.env.OMO3578_CATEGORY ?? 'CNC1000' // 명함(검증된 매핑 기준)
const QTY = Number(process.env.OMO3578_QTY ?? '200')

// 1×1 PNG(decode 가능한 최소). 합본 PDF 는 페이지수(단면 3)만 가드 대상이라 콘텐츠는 무의미.
const PNG_1x1 = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)
const PLATE: PlateImage = { bytes: PNG_1x1, mime: 'image/png' }

// dry-run 회귀 대상: 별색판을 요구하는 자동발주 지원(mapped) 후가공 4종.
//   (spot_color 는 needs_audit 로 자동발주 미지원 → 본 회귀 범위 밖.)
const SPOT_FINISHINGS = ['foil_stamp', 'deboss_emboss', 'die_cut', 'epoxy'] as const

// 유효한 단면 합본 PDF(위치보기용 + 인쇄[박제거] + 박파일[K100] = 3페이지) 픽스처.
async function writeValidCombined(filePath: string, widthMm = 94, heightMm = 54) {
  const bytes = await buildCombinedFinishingPdf({
    positionOverlay: PLATE,
    printPlate: PLATE,
    spotPlate: PLATE,
    pageWidthMm: widthMm,
    pageHeightMm: heightMm,
  })
  fs.writeFileSync(filePath, bytes)
}

// 1페이지(판 누락) negative 픽스처.
async function writeOnePage(filePath: string, widthMm = 94, heightMm = 54) {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.addPage([widthMm * (72 / 25.4), heightMm * (72 / 25.4)])
  fs.writeFileSync(filePath, await doc.save())
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo3578-'))
  const hasCreds = !!(process.env.SWADPIA_USERNAME && process.env.SWADPIA_PASSWORD)
  console.log(`[OMO-3578] dry-run 회귀 시작 — category=${CATEGORY} qty=${QTY} creds=${hasCreds ? 'OK' : '없음'}`)
  console.log('  ⚠️ dryRun=true (결제 미진행, 파일 업로드까지만)\n')

  // ── 1. negative: 별색판 누락(1페이지) → 가드 차단 (자격증명·네트워크 불요) ──
  const onePage = path.join(tmpDir, 'design_only_1p.pdf')
  await writeOnePage(onePage)
  const neg = await placeSwadpiaOrder({
    productSlugOrCategoryCode: CATEGORY,
    selectedOptions: expandFinishingToSwadpiaFields({ finishing: 'foil_stamp' }),
    quantity: QTY,
    fileUrl: onePage,
    dryRun: true,
  })
  const negOk = neg.success === false && /합본PDF 가드/.test(neg.errorMessage ?? '')
  console.log(`[negative] 박 + 1페이지(별색판 누락) → ${negOk ? '✅ 차단됨' : '❌ 차단 실패'}  (${neg.errorMessage ?? ''})\n`)

  if (!hasCreds) {
    console.log('자격증명 없음 → positive(라이브) 회귀 스킵. negative 가드만 검증 완료.')
    console.log('VPS/로컬 러너에서 SWADPIA_USERNAME/PASSWORD 설정 후 재실행하면 positive 회귀가 수행됩니다.')
    fs.rmSync(tmpDir, { recursive: true, force: true })
    process.exit(negOk ? 0 : 1)
  }

  // ── 2. positive: 별색 후가공별 합본 PDF(단면 3페이지) dry-run → 가드 통과 + 필드 적용 + total_price ──
  const combined = path.join(tmpDir, 'combined_3p.pdf')
  await writeValidCombined(combined)

  const rows: string[] = []
  for (const fin of SPOT_FINISHINGS) {
    const selectedOptions = expandFinishingToSwadpiaFields({ finishing: fin })
    try {
      const r = await placeSwadpiaOrder({
        productSlugOrCategoryCode: CATEGORY,
        selectedOptions,
        quantity: QTY,
        fileUrl: combined,
        orderTitle: `OMO-3578 dryrun ${fin}`,
        dryRun: true,
      })
      if (r.success && r.dryRun) {
        const d = r.dryRun
        console.log(`[${fin}] ✅ dry-run 통과`)
        console.log(`   total_price(직독): ${d.totalPriceRaw ?? '(없음)'}`)
        console.log(`   별색판 검출: [${d.spotPlateFinishings.join(',')}]  페이지수: ${d.uploadedPageCount}`)
        console.log(`   활성 패널: [${d.activatedPanels.join(',')}]`)
        console.log(`   적용 필드: ${JSON.stringify(d.appliedFinishingFields)}`)
        console.log(`   업로드 파일명: ${d.chgFileName}  (URL: ${d.pageUrl})\n`)
        rows.push(`${fin}\t통과\ttotal=${d.totalPriceRaw ?? '-'}\t패널=[${d.activatedPanels.join(',')}]`)
      } else {
        console.log(`[${fin}] ❌ 실패: ${r.errorMessage}\n`)
        rows.push(`${fin}\t실패\t${r.errorMessage ?? ''}`)
      }
    } catch (e) {
      console.log(`[${fin}] ❌ 예외: ${e instanceof Error ? e.message : String(e)}\n`)
      rows.push(`${fin}\t예외\t${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('─── 요약 ───')
  console.log(`negative(별색판 누락 차단): ${negOk ? '✅' : '❌'}`)
  for (const row of rows) console.log('  ' + row)

  fs.rmSync(tmpDir, { recursive: true, force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
