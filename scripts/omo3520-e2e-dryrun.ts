/**
 * OMO-3520: 프로카드→성원 E2E 테스트 실발주 — 라이브 dry-run 오케스트레이터.
 *
 * 흐름:
 *   1) 명함 규정 PDF 자동생성 (omo3520-gen-namecard-pdf.mjs)
 *   2) E2E_TEST_CASE(명함 + 박) 로 placeSwadpiaOrder({ dryRun: true }) 실행
 *      → 로그인 → 옵션·후가공 적용 → 파일 plupload → 결제서(order_pay)까지.
 *      ★ dryRun=true → 최종 paySubmit() 미호출(공급사 실비·생산 차단).
 *   3) diagnostics(옵션 read-back·본가/후가공 amt·업로드 chgFileName) 를 아티팩트 JSON 으로 적재.
 *
 * 실행(보드 승인 후):
 *   node --experimental-strip-types --env-file=.env.local scripts/omo3520-e2e-dryrun.ts
 *   (환경변수: SWADPIA_USERNAME / SWADPIA_PASSWORD — Vercel development env)
 *
 * ⚠️ 게이트: 최종 real submit(dryRun=false)은 보드 명시 확인 후에만. 기본 dry-run.
 */
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { placeSwadpiaOrder } from '../src/lib/swadpia-order'
import { E2E_TEST_CASE, type E2eArtifact } from '../src/lib/swadpia-e2e'

const ART_DIR = path.join(import.meta.dirname ?? __dirname, 'test-artifacts', 'omo3520')
const PDF_PATH = path.join(ART_DIR, 'namecard-test.pdf')
const RESULT_PATH = path.join(ART_DIR, 'e2e-result.json')

const REAL_SUBMIT = process.argv.includes('--real-submit') // 보드 게이트: 명시해야 실제 제출

function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}\n`)
}

async function main() {
  if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
    log('❌ SWADPIA_USERNAME / SWADPIA_PASSWORD 환경변수 없음 (Vercel development env 에서 pull).')
    process.exit(1)
  }
  fs.mkdirSync(ART_DIR, { recursive: true })

  // 1) 규정 PDF 생성
  log('명함 규정 PDF 생성…')
  execFileSync('node', [path.join(import.meta.dirname ?? __dirname, 'omo3520-gen-namecard-pdf.mjs'), PDF_PATH], {
    stdio: 'inherit',
  })

  // 2) dry-run 발주 (최종 제출 차단)
  const dryRun = !REAL_SUBMIT
  log(`자동발주 실행 — ${dryRun ? 'DRY-RUN(결제 직전 정지, 미제출)' : '★ REAL SUBMIT(실비 발생) ★'}`)
  const result = await placeSwadpiaOrder({
    productSlugOrCategoryCode: E2E_TEST_CASE.productSlug,
    selectedOptions: E2E_TEST_CASE.selectedOptions,
    quantity: E2E_TEST_CASE.quantity,
    fileUrl: PDF_PATH,
    orderTitle: 'OMO-3520 E2E 테스트(명함+박)',
    dryRun,
  })

  const artifact: E2eArtifact = {
    ranAt: new Date().toISOString(),
    mode: dryRun ? 'dry_run' : 'real_submit',
    reachedStage: result.diagnostics?.reachedStage ?? (result.success ? 'unknown' : 'failed'),
    fileUpload: result.diagnostics?.fileUpload ?? null,
    appliedOptions: result.diagnostics?.appliedOptions ?? null,
    swadpiaPayAmtKrw: result.diagnostics?.swadpiaPayAmtKrw ?? null,
    finishingAmts: result.diagnostics?.finishingAmts ?? null,
    screenshots: [],
    error: result.success ? null : result.errorMessage ?? 'unknown',
  }
  fs.writeFileSync(RESULT_PATH, JSON.stringify(artifact, null, 2))

  log(`결과: success=${result.success} stage=${artifact.reachedStage}`)
  log(`  파일업로드 chgFileName=${artifact.fileUpload?.chgFileName ?? '-'}`)
  log(`  성원 pay_amt(KRW)=${artifact.swadpiaPayAmtKrw ?? '-'}  후가공amt=${JSON.stringify(artifact.finishingAmts)}`)
  log(`아티팩트 적재: ${RESULT_PATH}`)
  if (!result.success) process.exit(2)
}

main().catch((err) => {
  log(`예외: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
