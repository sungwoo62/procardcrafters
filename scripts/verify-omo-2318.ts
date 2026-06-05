/**
 * OMO-2318 검증 스크립트 — 성원애드피아 작업메모(=order_title) 수정 확인
 *
 * 1. Swadpia 로그인
 * 2. 마이페이지(BEFORE) 스크린샷 — 기존 잘못된 `print_file_<timestamp>.pdf` 주문명 확인
 * 3. 명함 상품 페이지 → 바로주문 모달 → order_title을 `PCCF-...` 형식으로 채움
 * 4. 모달(AFTER-INPUT) 스크린샷 — order_title 필드에 PCCF 번호 보이는 시점
 * 5. 결제 대기 페이지(AFTER-PLACED) 스크린샷
 * 6. 마이페이지(AFTER-LIST) 스크린샷 — 신규 주문이 PCCF로 보이는지 확인
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/verify-omo-2318.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Page, Frame, Response } from 'playwright'

const REPORT_DIR = path.join(import.meta.dirname ?? __dirname, '..', 'public', 'reports', 'omo-2318')
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots')

const SWADPIA_BASE = 'https://www.swadpia.co.kr'
const MOCK_ORDER_NUMBER = `PCCF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-OMO2318`
const MOCK_QUANTITY = 500
const ORDER_TITLE = `${MOCK_ORDER_NUMBER} ${MOCK_QUANTITY}매`

function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}\n`)
}

async function main() {
  if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
    log('SWADPIA_USERNAME / SWADPIA_PASSWORD 환경변수 없음')
    process.exit(1)
  }

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

  // 테스트 PDF
  const testPdf = path.join(SCREENSHOT_DIR, 'test-card.pdf')
  if (!fs.existsSync(testPdf)) {
    fs.writeFileSync(testPdf, `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 255 142]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
206
%%EOF`)
  }

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    viewport: { width: 1400, height: 900 },
  })
  const page = await context.newPage()
  page.on('dialog', async (d) => { await d.accept() })

  const meta: Record<string, unknown> = {
    orderTitle: ORDER_TITLE,
    mockOrderNumber: MOCK_ORDER_NUMBER,
    quantity: MOCK_QUANTITY,
    startedAt: new Date().toISOString(),
  }

  try {
    // ─── 1. 로그인 ────────────────────────────────────────────
    log('1. Swadpia 로그인')
    await page.goto(`${SWADPIA_BASE}/member/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('#icon_member_login'),
    ])
    await page.waitForTimeout(2000)

    // ─── 2. 마이페이지 BEFORE 스크린샷 ────────────────────────
    log('2. 마이페이지 BEFORE 캡처')
    await page.goto(`${SWADPIA_BASE}/mypage/payment_wait`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-mypage-before.png'), fullPage: false })

    // ─── 3. 명함 상품 페이지 → 옵션 선택 ─────────────────────
    log('3. 명함(CNC1000) 상품 페이지 옵션 선택')
    await page.goto(`${SWADPIA_BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const opts = {
      paper_code: 'SNW250W00',
      print_color_type: 'CTN40',
      size_type: 'SZT10',
      paper_size: 'N0100',
      order_count: '1',
    }
    for (const [key, value] of Object.entries(opts)) {
      const sel = await page.$(`select[name="${key}"]`)
      if (sel) {
        await sel.selectOption(value)
        await page.waitForTimeout(300)
      } else {
        const radio = await page.$(`input[name="${key}"][value="${value}"]`)
        if (radio) {
          await page.evaluate((p: { n: string; v: string }) => {
            const el = document.querySelector(`input[name="${p.n}"][value="${p.v}"]`) as HTMLInputElement
            if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })) }
          }, { n: key, v: value })
          await page.waitForTimeout(300)
        }
      }
    }
    const qtySel = await page.$('select[name="paper_qty"]')
    if (qtySel) await qtySel.selectOption(String(MOCK_QUANTITY))
    await page.waitForTimeout(1000)

    // ─── 4. 바로주문 모달 + order_title 채우기 ───────────────
    log('4. 바로주문 모달 → order_title에 PCCF 번호 주입')
    await page.evaluate(() => {
      (document.querySelector('#btn_order3') as HTMLElement)?.click()
    })
    await page.waitForTimeout(2500)

    await page.evaluate((title: string) => {
      const el = document.getElementById('order_title') as HTMLInputElement
      if (el) {
        el.value = title
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, ORDER_TITLE)
    await page.waitForTimeout(800)

    // 모달 영역 집중 캡처 (전체 페이지 X — 모달만)
    const modal = await page.$('#layer_pop_order, .pop_layer, .layerPop, .layer_pop')
    if (modal) {
      await modal.screenshot({ path: path.join(SCREENSHOT_DIR, '02-modal-after-input.png') })
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-modal-after-input.png'), clip: { x: 0, y: 0, width: 1400, height: 600 } })
    }

    // ─── 5. 파일 업로드 → 주문 제출 ──────────────────────────
    log('5. 파일 업로드 + 주문 제출')
    let chgFileName = ''
    const respHandler = async (res: Response) => {
      if (res.url().includes('upload.php')) {
        try {
          const body = await res.text()
          const parsed = JSON.parse(body)
          if (parsed.chgFileName) chgFileName = parsed.chgFileName
        } catch { /* ignore */ }
      }
    }
    page.on('response', respHandler)

    const innoFrame: Frame | null = page.frame({ name: 'iframe_InnoDS' })
    if (!innoFrame) throw new Error('iframe_InnoDS 없음')
    const fileInput = await innoFrame.$('input[type="file"]')
    if (!fileInput) throw new Error('iframe file input 없음')
    await fileInput.setInputFiles(testPdf)
    await page.waitForTimeout(1500)
    await innoFrame.evaluate(() => {
      // @ts-expect-error — plupload
      const u = jQuery('#uploader').pluploadQueue()
      if (u) u.start()
    })

    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000)
      if (chgFileName) break
    }
    page.off('response', respHandler)

    if (!chgFileName) throw new Error('파일 업로드 실패')
    meta.chgFileName = chgFileName

    const fileSize = fs.statSync(testPdf).size
    await page.evaluate((p: { chg: string; size: number; title: string }) => {
      const setField = (name: string, value: string) => {
        let el = document.getElementById(name) as HTMLInputElement
        if (!el) el = document.querySelector(`[name="${name}"]`) as HTMLInputElement
        if (!el) {
          el = document.createElement('input')
          el.type = 'hidden'; el.name = name; el.id = name
          document.getElementById('order_form')?.appendChild(el)
        }
        el.value = value
      }
      setField('order_file_name2', p.chg)
      setField('order_file', 'test-card.pdf')
      setField('order_file2', 'test-card.pdf')
      setField('order_file_name', 'test-card.pdf')
      setField('order_file_type', 'application/pdf')
      setField('order_file_ext', '.pdf')
      setField('order_file_size', String(p.size))
      setField('goods_mode', 'cart')
      setField('goods_action', 'regist')
      setField('InnoDS_Use', 'Y')
      setField('InnoDS_Use_Type', 'index.php')
      setField('upload_type', 'InnoDS1')
      setField('file_upload_chk', 'Y')
      setField('upload_mode', '1')
      setField('order_path', 'ODP10')
      setField('order_title', p.title)
    }, { chg: chgFileName, size: fileSize, title: ORDER_TITLE })

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
      page.evaluate(() => {
        // @ts-expect-error
        uploadSuccessOrderSubmit()
      }),
    ])
    await page.waitForTimeout(2500)

    // ─── 6. 주문서 페이지 캡처 ───────────────────────────────
    log('6. 주문서(direct_order) 페이지 캡처')
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-direct-order.png'), clip: { x: 0, y: 0, width: 1400, height: 900 } })
    meta.directOrderUrl = page.url()

    // 주문 확인 → 결제 대기 (S머니 PYM10)
    const confirmBtn = await page.$('input[src*="bt_order_confirm"]')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
      confirmBtn ? confirmBtn.click() : page.evaluate(() => (document.getElementById('order_form') as HTMLFormElement).submit()),
    ])
    await page.waitForTimeout(2500)

    await page.evaluate(() => {
      const radios = document.getElementsByName('pay_method')
      for (let i = 0; i < radios.length; i++) {
        if ((radios[i] as HTMLInputElement).value === 'PYM10') {
          (radios[i] as HTMLInputElement).checked = true
          break
        }
      }
    })

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
      page.evaluate(() => {
        // @ts-expect-error
        paySubmit()
      }),
    ])
    await page.waitForTimeout(2500)
    meta.placedUrl = page.url()

    // ─── 7. 마이페이지 AFTER 캡처 ────────────────────────────
    log('7. 마이페이지 AFTER 캡처 (신규 주문 PCCF 제목 확인)')
    await page.goto(`${SWADPIA_BASE}/mypage/payment_wait`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-mypage-after.png'), fullPage: false })

    meta.completedAt = new Date().toISOString()
    meta.success = true
    log(`완료. orderTitle=${ORDER_TITLE}`)

  } catch (err) {
    meta.success = false
    meta.error = err instanceof Error ? err.message : String(err)
    log(`실패: ${meta.error}`)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '99-error.png'), fullPage: false }).catch(() => {})
  } finally {
    fs.writeFileSync(path.join(REPORT_DIR, 'meta.json'), JSON.stringify(meta, null, 2))
    await browser.close()
  }
}

main()
