/**
 * 성원애드피아 Playwright 자동 발주
 *
 * Vercel serverless에서 실행 불가 — 로컬/VPS 스크립트에서만 사용.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/place-factory-orders.ts
 *
 * 환경변수 필요: SWADPIA_USERNAME, SWADPIA_PASSWORD
 *
 * 발주 흐름:
 *   로그인 → 상품 페이지 옵션 선택 → 바로주문 모달 → plupload iframe 파일 업로드
 *   → chgFileName 캡처 → order_file_name2 설정 → uploadSuccessOrderSubmit()
 *   → 결제 대기 페이지 (/order/order_info/direct_order)
 */

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import type { Page, Frame, Response, BrowserType } from 'playwright'

async function getChromium(): Promise<BrowserType> {
  const pw = await import('playwright')
  return pw.chromium
}

const SWADPIA_BASE = 'https://www.swadpia.co.kr'

// ─── Category → Swadpia goods_code mapping ────────────────────
const SWADPIA_GOODS_MAP: Record<string, { categoryCode: string; goodsCode: string }> = {
  'business-cards':              { categoryCode: 'CNC1000', goodsCode: '1' },
  'premium-business-cards':     { categoryCode: 'CNC2000', goodsCode: '1' },
  'premium-foil-cards':         { categoryCode: 'CNC3000', goodsCode: '1' },
  'metallic-business-cards':    { categoryCode: 'CNC3000', goodsCode: '1' },
  'letterpress-business-cards': { categoryCode: 'CNC4000', goodsCode: '1' },
  'transparent-business-cards': { categoryCode: 'CNC5000', goodsCode: '1' },
  'uv-business-cards':          { categoryCode: 'CNC6000', goodsCode: '1' },
  'pearl-business-cards':       { categoryCode: 'CNC8000', goodsCode: '1' },
  'stickers':               { categoryCode: 'CST1000', goodsCode: '1' },
  'die-cut-stickers':       { categoryCode: 'CST2000', goodsCode: '1' },
  'flyers':                 { categoryCode: 'CLF1000', goodsCode: '1' },
  'brochures':              { categoryCode: 'CLF2000', goodsCode: '1' },
  'postcards':              { categoryCode: 'CDP3000', goodsCode: '1' },
  'posters':                { categoryCode: 'CPR2000', goodsCode: '1' },
  'banners':                { categoryCode: 'CPR5000', goodsCode: '1' },
}

// ─── Types ────────────────────────────────────────────────────

export interface SwadpiaOrderInput {
  productSlugOrCategoryCode: string
  selectedOptions: Record<string, string>
  quantity: number
  fileUrl: string
  orderTitle?: string
}

export interface SwadpiaOrderResult {
  success: boolean
  swadpiaOrderNumber?: string
  checkoutUrl?: string
  errorMessage?: string
}

export interface FactoryOrderRecord {
  id: string
  print_order_id: string
  print_order_item_id: string | null
  status: 'pending' | 'placing' | 'placed' | 'failed' | 'cancelled'
  swadpia_order_number: string | null
  category_code: string
  options_snapshot: Record<string, string>
  quantity: number
  file_url: string | null
  attempt_count: number
  last_error: string | null
  queued_at: string
  placed_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
}

// ─── Core Playwright automation ───────────────────────────────

export async function placeSwadpiaOrder(
  input: SwadpiaOrderInput,
): Promise<SwadpiaOrderResult> {
  const username = process.env.SWADPIA_USERNAME
  const password = process.env.SWADPIA_PASSWORD

  if (!username || !password) {
    return { success: false, errorMessage: 'SWADPIA_USERNAME / SWADPIA_PASSWORD 환경변수 없음' }
  }

  const mapEntry = SWADPIA_GOODS_MAP[input.productSlugOrCategoryCode]
  const categoryCode = mapEntry?.categoryCode ?? input.productSlugOrCategoryCode
  const goodsCode = mapEntry?.goodsCode ?? '1'
  const goodsPageUrl = `${SWADPIA_BASE}/goods/goods_view/${categoryCode}/${goodsCode}`

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swadpia-'))
  let browser: Awaited<ReturnType<BrowserType['launch']>> | null = null

  try {
    const filePath = await downloadFile(input.fileUrl, tmpDir)
    const fileName = path.basename(filePath)
    const fileExt = path.extname(filePath)
    const fileSize = fs.statSync(filePath).size

    const chromium = await getChromium()
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'ko-KR',
      viewport: { width: 1280, height: 900 },
    })
    const page = await context.newPage()

    page.on('dialog', async (dialog) => { await dialog.accept() })

    // 1. 로그인
    await swadpiaLogin(page, username, password)

    // 2. 상품 페이지 + 옵션 선택
    await page.goto(goodsPageUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    await selectOrderOptions(page, input.selectedOptions, input.quantity)

    // 2-b. 당일판(same-day) 옵션 자동 평가
    //     - 일반판 가격 대비 +10% 이내면 ON, 초과면 OFF.
    //     - Swadpia UI 가 당일판을 제공하지 않으면 no-op (decision = "not_available").
    const sameDayDecision = await tryEnableSameDay(page, 0.10)
    console.log(`[swadpia-order] 당일판 결정: ${sameDayDecision.decision} ` +
      `(base=${sameDayDecision.basePrice ?? '-'} today=${sameDayDecision.todayPrice ?? '-'} ` +
      `delta=${sameDayDecision.deltaPct ? (sameDayDecision.deltaPct * 100).toFixed(1) + '%' : '-'})`)

    // 3. 바로주문 모달 열기
    await page.evaluate(() => {
      (document.querySelector('#btn_order3') as HTMLElement)?.click()
    })
    await page.waitForTimeout(2000)

    // 주문명 설정
    const orderTitle = input.orderTitle ?? fileName
    await page.evaluate((title: string) => {
      const el = document.getElementById('order_title') as HTMLInputElement
      if (el) el.value = title
    }, orderTitle)

    // 4. plupload iframe 파일 업로드
    const chgFileName = await uploadViaPlupload(page, filePath)
    if (!chgFileName) {
      return { success: false, errorMessage: 'plupload 업로드 실패 — chgFileName 없음' }
    }

    // 5. hidden 필드 설정 + 폼 제출
    await page.evaluate((params: { chgFileName: string; fileName: string; fileExt: string; fileSize: number; orderTitle: string }) => {
      const setField = (name: string, value: string) => {
        let el = document.getElementById(name) as HTMLInputElement
        if (!el) el = document.querySelector(`[name="${name}"]`) as HTMLInputElement
        if (!el) {
          el = document.createElement('input')
          el.type = 'hidden'
          el.name = name
          el.id = name
          document.getElementById('order_form')?.appendChild(el)
        }
        el.value = value
      }

      const mimeFromExt =
        params.fileExt === '.pdf' ? 'application/pdf' :
        params.fileExt === '.ai' ? 'application/illustrator' :
        params.fileExt === '.png' ? 'image/png' :
        params.fileExt === '.jpg' || params.fileExt === '.jpeg' ? 'image/jpeg' :
        'application/octet-stream'
      setField('order_file_name2', params.chgFileName)
      setField('order_file', params.fileName)
      setField('order_file2', params.fileName)
      setField('order_file_name', params.fileName)
      setField('order_file_type', mimeFromExt)
      setField('order_file_ext', params.fileExt)
      setField('order_file_size', String(params.fileSize))
      setField('goods_mode', 'cart')
      setField('goods_action', 'regist')
      setField('InnoDS_Use', 'Y')
      setField('InnoDS_Use_Type', 'index.php')
      setField('upload_type', 'InnoDS1')
      setField('file_upload_chk', 'Y')
      setField('upload_mode', '1')
      setField('order_path', 'ODP10')
      setField('order_title', params.orderTitle)
    }, { chgFileName, fileName, fileExt, fileSize, orderTitle })

    // 6. uploadSuccessOrderSubmit() → /order/order_info/direct_order (주문서)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
      page.evaluate(() => {
        // @ts-expect-error — Swadpia 전역 함수
        uploadSuccessOrderSubmit()
      }),
    ])
    await page.waitForTimeout(2000)

    if (!page.url().includes('/order/order_info')) {
      return { success: false, errorMessage: `주문서 페이지 도달 실패 — URL: ${page.url()}` }
    }

    // 7. "주문 확인" 클릭 → /order/order_pay (결제서)
    const confirmBtn = await page.$('input[src*="bt_order_confirm"]')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
      confirmBtn
        ? confirmBtn.click()
        : page.evaluate(() => (document.getElementById('order_form') as HTMLFormElement).submit()),
    ])
    await page.waitForTimeout(2000)

    if (!page.url().includes('/order/order_pay')) {
      return { success: false, errorMessage: `결제서 페이지 도달 실패 — URL: ${page.url()}` }
    }

    // 8. S머니(가상계좌, PYM10) 기본 선택 확인 + paySubmit()
    await page.evaluate(() => {
      const radios = document.getElementsByName('pay_method')
      let smoneyFound = false
      for (let i = 0; i < radios.length; i++) {
        if ((radios[i] as HTMLInputElement).value === 'PYM10') {
          (radios[i] as HTMLInputElement).checked = true
          smoneyFound = true
          break
        }
      }
      if (!smoneyFound && radios.length > 2) {
        (radios[2] as HTMLInputElement).checked = true
      }
    })

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
      page.evaluate(() => {
        // @ts-expect-error — Swadpia 전역 함수
        paySubmit()
      }),
    ])
    await page.waitForTimeout(2000)

    const finalUrl = page.url()

    // /order/order_result/SUCCESS/OSA260513344332
    const orderMatch = finalUrl.match(/order_result\/SUCCESS\/([A-Z0-9]+)/)
    if (orderMatch) {
      return {
        success: true,
        swadpiaOrderNumber: orderMatch[1],
        checkoutUrl: finalUrl,
      }
    }

    if (finalUrl.includes('order_result')) {
      return { success: true, checkoutUrl: finalUrl }
    }

    return {
      success: false,
      errorMessage: `주문 완료 확인 실패 — URL: ${finalUrl}`,
    }

  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  } finally {
    if (browser) await browser.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

// ─── Step functions ───────────────────────────────────────────

async function swadpiaLogin(page: Page, username: string, password: string): Promise<void> {
  await page.goto(`${SWADPIA_BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })

  await page.fill('input[name="member_id"]', username)
  await page.fill('input[name="member_pw"]', password)

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('#icon_member_login'),
  ])
  await page.waitForTimeout(2000)

  if (page.url().includes('/member/login')) {
    throw new Error('Swadpia 로그인 실패')
  }
}

// ─── Same-day (당일판) auto-toggle ──────────────────────────────
//
// Swadpia 의 견적 페이지에는 일부 카테고리에서 "당일판" 옵션이 노출됨.
// 일반판 대비 추가 비용이 maxDeltaPct (예: 0.10 = 10%) 이내면 ON, 초과면 OFF
// 로 자동 결정. 보드 OMO-2314 정책.
//
// Swadpia 가 당일판을 노출하지 않는 카테고리에서는 no-op + decision='not_available'.
// 가격 비교 실패 시 안전하게 OFF 로 둠 (decision='read_fail').

type SameDayDecision = 'enabled' | 'rejected_too_expensive' | 'not_available' | 'read_fail'

interface SameDayResult {
  decision: SameDayDecision
  basePrice: number | null
  todayPrice: number | null
  deltaPct: number | null
}

const SAME_DAY_SELECTORS = [
  'input[name="paper_today_yn"]',
  'input[name="paper_today"]',
  'input[name="today_yn"]',
  'input[name="chk_today"]',
  'input[id*="today"]',
  'select[name="paper_today_yn"]',
] as const

const PRICE_SELECTORS = [
  '#total_price',
  '#total_amount',
  '#price_total',
  '#order_total_price',
  '.total_price',
  '[id*="total_price"]',
] as const

async function readDisplayedPrice(page: Page): Promise<number | null> {
  for (const sel of PRICE_SELECTORS) {
    const text = await page.evaluate((s: string) => {
      const el = document.querySelector(s) as HTMLElement | null
      if (!el) return null
      return (el.innerText || el.textContent || '').trim()
    }, sel)
    if (!text) continue
    // "12,345원" / "₩12,345" / "12345" 다 처리
    const digits = text.replace(/[^0-9]/g, '')
    if (digits.length > 0) {
      const n = parseInt(digits, 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}

async function tryEnableSameDay(page: Page, maxDeltaPct: number): Promise<SameDayResult> {
  // Step 1: locate same-day control
  let selector: string | null = null
  let kind: 'checkbox' | 'select' | null = null
  for (const sel of SAME_DAY_SELECTORS) {
    const exists = await page.evaluate((s: string) => {
      const el = document.querySelector(s) as HTMLElement | null
      if (!el) return false
      // hidden 또는 display:none 인 경우 페이지 노출 옵션 아님
      const cs = window.getComputedStyle(el)
      return cs.display !== 'none' || el.tagName.toLowerCase() === 'input'
    }, sel)
    if (exists) {
      selector = sel
      kind = sel.startsWith('select') ? 'select' : 'checkbox'
      break
    }
  }
  if (!selector || !kind) {
    return { decision: 'not_available', basePrice: null, todayPrice: null, deltaPct: null }
  }

  const basePrice = await readDisplayedPrice(page)
  if (basePrice === null) {
    return { decision: 'read_fail', basePrice: null, todayPrice: null, deltaPct: null }
  }

  // Step 2: toggle ON
  try {
    if (kind === 'select') {
      await page.$eval(selector, (el: Element) => {
        const sel = el as HTMLSelectElement
        for (const opt of Array.from(sel.options)) {
          if (/Y|당일|same/i.test(opt.value) || /Y|당일|same/i.test(opt.text)) {
            sel.value = opt.value
            sel.dispatchEvent(new Event('change', { bubbles: true }))
            return
          }
        }
      })
    } else {
      await page.$eval(selector, (el: Element) => {
        const inp = el as HTMLInputElement
        inp.checked = true
        inp.dispatchEvent(new Event('change', { bubbles: true }))
        inp.dispatchEvent(new Event('click', { bubbles: true }))
      })
    }
    await page.waitForTimeout(800)
  } catch {
    return { decision: 'read_fail', basePrice, todayPrice: null, deltaPct: null }
  }

  const todayPrice = await readDisplayedPrice(page)
  if (todayPrice === null) {
    return { decision: 'read_fail', basePrice, todayPrice: null, deltaPct: null }
  }

  const deltaPct = (todayPrice - basePrice) / basePrice

  // Step 3: decide
  if (deltaPct <= maxDeltaPct) {
    return { decision: 'enabled', basePrice, todayPrice, deltaPct }
  }

  // Revert
  try {
    if (kind === 'select') {
      await page.$eval(selector, (el: Element) => {
        const sel = el as HTMLSelectElement
        for (const opt of Array.from(sel.options)) {
          if (/N|일반|normal/i.test(opt.value) || /N|일반|normal/i.test(opt.text) || opt.value === '') {
            sel.value = opt.value
            sel.dispatchEvent(new Event('change', { bubbles: true }))
            return
          }
        }
      })
    } else {
      await page.$eval(selector, (el: Element) => {
        const inp = el as HTMLInputElement
        inp.checked = false
        inp.dispatchEvent(new Event('change', { bubbles: true }))
        inp.dispatchEvent(new Event('click', { bubbles: true }))
      })
    }
    await page.waitForTimeout(800)
  } catch {
    // best-effort revert
  }
  return { decision: 'rejected_too_expensive', basePrice, todayPrice, deltaPct }
}

async function selectOrderOptions(
  page: Page,
  options: Record<string, string>,
  quantity: number,
): Promise<void> {
  for (const [key, value] of Object.entries(options)) {
    if (key === 'quantity') continue

    // select 요소 직접 선택 (Swadpia는 대부분 select 기반)
    const selectEl = await page.$(`select[name="${key}"]`)
    if (selectEl) {
      await selectEl.selectOption(value)
      await page.waitForTimeout(300)
      continue
    }

    // hidden radio 버튼 (paper_gloss 등)
    const radio = await page.$(`input[name="${key}"][value="${value}"]`)
    if (radio) {
      await page.evaluate(
        (params: { name: string; val: string }) => {
          const el = document.querySelector(`input[name="${params.name}"][value="${params.val}"]`) as HTMLInputElement
          if (el) {
            el.checked = true
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
        },
        { name: key, val: value },
      )
      await page.waitForTimeout(300)
      continue
    }
  }

  // 수량 (paper_qty select)
  if (quantity) {
    const qtySelect = await page.$('select[name="paper_qty"]')
    if (qtySelect) {
      await qtySelect.selectOption(String(quantity))
      await page.waitForTimeout(300)
    }
  }

  await page.waitForTimeout(1000)
}

async function uploadViaPlupload(page: Page, filePath: string): Promise<string | null> {
  // upload.php 응답 캡처
  let chgFileName = ''
  const responseHandler = async (res: Response) => {
    if (res.url().includes('upload.php')) {
      try {
        const body = await res.text()
        const parsed = JSON.parse(body)
        if (parsed.chgFileName) chgFileName = parsed.chgFileName
      } catch { /* ignore */ }
    }
  }
  page.on('response', responseHandler)

  try {
    // iframe_InnoDS 접근
    const innoDSFrame: Frame | null = page.frame({ name: 'iframe_InnoDS' })
    if (!innoDSFrame) {
      throw new Error('iframe_InnoDS 프레임 없음')
    }

    const fileInput = await innoDSFrame.$('input[type="file"]')
    if (!fileInput) {
      throw new Error('iframe 내 file input 없음')
    }

    await fileInput.setInputFiles(filePath)
    await page.waitForTimeout(2000)

    // plupload 업로드 시작
    await innoDSFrame.evaluate(() => {
      // @ts-expect-error — plupload jQuery plugin
      const uploader = jQuery('#uploader').pluploadQueue()
      if (uploader) uploader.start()
    })

    // 업로드 완료 대기 (최대 30초)
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000)
      if (chgFileName) break

      const status = await innoDSFrame.evaluate(() => {
        // @ts-expect-error
        const uploader = jQuery('#uploader').pluploadQueue()
        return uploader?.total?.percent ?? 0
      })
      if (status >= 100 && chgFileName) break
    }

    return chgFileName || null

  } finally {
    page.off('response', responseHandler)
  }
}

// ─── File download helper ─────────────────────────────────────

async function downloadFile(url: string, destDir: string): Promise<string> {
  // 로컬 파일 (file:// 또는 절대 경로)
  if (url.startsWith('file://') || url.startsWith('/')) {
    const localPath = url.startsWith('file://') ? url.slice(7) : url
    const ext = path.extname(localPath) || '.pdf'
    const destPath = path.join(destDir, `print_file_${Date.now()}${ext}`)
    fs.copyFileSync(localPath, destPath)
    return destPath
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`파일 다운로드 실패 ${res.status}: ${url}`)

  const contentType = res.headers.get('content-type') ?? ''
  const ext =
    contentType.includes('pdf') ? '.pdf' :
    contentType.includes('postscript') || contentType.includes('ai') ? '.ai' :
    contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' :
    contentType.includes('png') ? '.png' :
    '.jpg'

  const filePath = path.join(destDir, `print_file_${Date.now()}${ext}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(filePath, buffer)
  return filePath
}

// ─── Category code resolver (script-side only) ───────────────

export function resolveCategoryCode(productSlugOrCode: string): string {
  return SWADPIA_GOODS_MAP[productSlugOrCode]?.categoryCode ?? productSlugOrCode
}
