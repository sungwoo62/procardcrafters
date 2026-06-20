import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { PDFDocument } from 'pdf-lib'
import { placeSwadpiaOrder } from '../swadpia-order'
import { expandFinishingToSwadpiaFields } from '@/config/swadpia-finishing-fields'

// OMO-3578: 후가공 자동발주 dry-run 회귀 — 별색 합본 PDF 가드의 **주문경로 결선**을 검증.
//
// 핵심: placeSwadpiaOrder 는 별색 후가공이 검출되면 브라우저 기동 **이전에** 합본 PDF
// 가드를 돌려 판 누락·구성 불일치(단면 3p / 양면 4~5p 규격 위반)·비PDF 업로드를 차단한다.
// OMO-3581 교정 규격: 위치보기용(M100) + 인쇄(박제거) + 박파일(K100). 이 단락(short-circuit)은
// 네트워크/Playwright 없이 결정론적으로 검증 가능하다(결제 직전 negative 검증, 손해 방지).
//
// 안전: 가드 실패 케이스는 getChromium() 호출 전에 return 하므로 브라우저를 띄우지 않고,
// 성원 사이트에 접속하지 않는다(실발주·결제 없음).

let tmpDir: string
let onePagePdf: string
let twoPagePdf: string
let aiFile: string

async function writePdf(filePath: string, pages: number) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([266, 153]) // 94×54mm 근사
  fs.writeFileSync(filePath, await doc.save())
}

beforeAll(async () => {
  // placeSwadpiaOrder 는 자격증명 미설정 시 가드 이전에 early-return 하므로 더미 주입.
  process.env.SWADPIA_USERNAME ||= 'dryrun-dummy'
  process.env.SWADPIA_PASSWORD ||= 'dryrun-dummy'
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo3578-'))
  onePagePdf = path.join(tmpDir, 'design_only_1p.pdf')
  twoPagePdf = path.join(tmpDir, 'combined_2p.pdf')
  aiFile = path.join(tmpDir, 'artwork.ai')
  await writePdf(onePagePdf, 1)
  await writePdf(twoPagePdf, 2)
  fs.writeFileSync(aiFile, 'not-a-pdf')
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// 자동발주 실주문 형태(options_snapshot)는 expandFinishingToSwadpiaFields 산출물 —
// `finishing` 키가 제거되고 bak_*/ap_*/domusong_*/epoxy_* 만 남는다.
const foilSnapshot = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp' })

describe('OMO-3578 dry-run negative — 별색판 누락/비PDF 차단(브라우저 미기동)', () => {
  it('expandFinishingToSwadpiaFields 산출물에 finishing 키 없음(전제 확인)', () => {
    expect(foilSnapshot.finishing).toBeUndefined()
    expect(Object.keys(foilSnapshot).some((k) => k.startsWith('bak_'))).toBe(true)
  })

  it('박 단면(확장필드, BKD10) + 1페이지 PDF → 합본PDF 가드 차단(단면 3페이지 규격)', async () => {
    const r = await placeSwadpiaOrder({
      productSlugOrCategoryCode: 'CNC1000',
      selectedOptions: foilSnapshot,
      quantity: 200,
      fileUrl: onePagePdf,
      dryRun: true,
    })
    expect(r.success).toBe(false)
    expect(r.errorMessage).toContain('합본PDF 가드')
    expect(r.errorMessage).toContain('3페이지')
    expect(r.errorMessage).toContain('박파일(K100)')
    expect(r.dryRun).toBeUndefined()
  })

  it('박 단면 + 2페이지 PDF(옛 p1+p2 모델) → 차단(단면은 3페이지여야 함)', async () => {
    // 회귀 가드: OMO-3581 이전의 2페이지 합본은 더 이상 유효하지 않다(위치보기용 누락).
    const r = await placeSwadpiaOrder({
      productSlugOrCategoryCode: 'CNC1000',
      selectedOptions: foilSnapshot,
      quantity: 200,
      fileUrl: twoPagePdf,
      dryRun: true,
    })
    expect(r.success).toBe(false)
    expect(r.errorMessage).toContain('3페이지')
    expect(r.dryRun).toBeUndefined()
  })

  it('박 양면(BKD30 동일박) + 2페이지 PDF → 차단, 4페이지 규격 메시지', async () => {
    const duplexFoil = { ...foilSnapshot, bak_side_1: 'BKD30' }
    const r = await placeSwadpiaOrder({
      productSlugOrCategoryCode: 'CNC1000',
      selectedOptions: duplexFoil,
      quantity: 200,
      fileUrl: twoPagePdf,
      dryRun: true,
    })
    expect(r.success).toBe(false)
    // 양면 동일박 = 위치보기용 + 인쇄(앞·뒤) + 박파일 1개 = 4페이지.
    expect(r.errorMessage).toContain('4페이지')
    expect(r.dryRun).toBeUndefined()
  })

  it('박(확장필드) + 비PDF(.ai) → 합본PDF 가드 차단', async () => {
    const r = await placeSwadpiaOrder({
      productSlugOrCategoryCode: 'CNC1000',
      selectedOptions: foilSnapshot,
      quantity: 200,
      fileUrl: aiFile,
      dryRun: true,
    })
    expect(r.success).toBe(false)
    expect(r.errorMessage).toContain('합본 PDF')
  })

  it('도무송(확장필드) + 1페이지 → 차단 (finishing 키 없는 실주문 경로)', async () => {
    const snap = expandFinishingToSwadpiaFields({ finishing: 'die_cut' })
    const r = await placeSwadpiaOrder({
      productSlugOrCategoryCode: 'CNC1000',
      selectedOptions: snap,
      quantity: 200,
      fileUrl: onePagePdf,
      dryRun: true,
    })
    expect(r.success).toBe(false)
    expect(r.errorMessage).toContain('합본PDF 가드')
  })

  it('별색 후가공 없음 + 1페이지 → 가드 통과(차단 안 함). [통과 시 브라우저 기동 → 본 테스트 범위 밖]', async () => {
    // 별색 후가공이 없으면 requiresSpotPlate=false → 가드를 건너뛴다.
    // 이 경로는 가드가 통과하므로 placeSwadpiaOrder 가 브라우저를 띄우려 한다 →
    // 가드 단계만 검증하기 위해 별색 후가공만 단언(가드 미발동)으로 한정한다.
    const { requiresSpotPlate } = await import('../finishing-combined-pdf')
    expect(requiresSpotPlate({ tagong_num: '1' })).toBe(false)
    expect(requiresSpotPlate(foilSnapshot)).toBe(true)
  })
})
