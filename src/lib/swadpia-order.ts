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
import { CATEGORY_MAP } from './swadpia'
import {
  MAX_FOIL_LAYERS,
  parseFoilLayersFromOptions,
  validateFoilLayers,
} from '@/config/swadpia-finishing-fields'

async function getChromium(): Promise<BrowserType> {
  const pw = await import('playwright')
  return pw.chromium
}

const SWADPIA_BASE = 'https://www.swadpia.co.kr'

// ─── Category → Swadpia goods_code mapping ────────────────────
//
// 자동발주 라우팅 맵. 가격조회(swadpia.ts CATEGORY_MAP)와 단일 소스로 유지하기
// 위해 CATEGORY_MAP 에서 파생한다. 이전엔 별도 15종 맵이라 나머지 23종이 누락돼
// 자동발주 대상에서 빠졌다(OMO-2634). 이제 가격조회에 등록된 모든 제품이 동일하게
// 자동발주 goods_view URL 로 라우팅된다.
//
// goodsCode 는 카테고리별 기본 상품(보통 '1'). '1' 이 아닌 예외만 아래에 등록.
const SWADPIA_GOODS_CODE_OVERRIDES: Record<string, string> = {}

const SWADPIA_GOODS_MAP: Record<string, { categoryCode: string; goodsCode: string }> =
  Object.fromEntries(
    Object.entries(CATEGORY_MAP).map(([slug, categoryCode]) => [
      slug,
      { categoryCode, goodsCode: SWADPIA_GOODS_CODE_OVERRIDES[slug] ?? '1' },
    ]),
  )

// ─── 카테고리별 폼 필드명 차이 (OMO-2634 라이브 조사) ──────────────
//
// print_product_options 는 CHECK 제약상 canonical option_type 4종
// (paper_code/print_color_type/paper_size/paper_qty)만 저장 가능하다.
// 그러나 성원 goods_view 의 실제 select name 은 카드형(명함/스티커) 외
// 제품군마다 다르다. 자동발주 시 canonical option_type 을 아래 맵으로
// 실제 select name 으로 변환해야 옵션이 폼에 적용된다.
// 키는 categoryCode (동일 카테고리 제품군이 폼을 공유하므로).
// 매핑이 없는 카테고리(명함·스티커 CST5000/CST7000 등)는 1:1 → 변환 없음.
const SWADPIA_FIELD_ALIAS: Record<string, Record<string, string>> = {
  CEV1000: { paper_size: 'bongto_type', print_color_type: 'fside_color_amount' },        // 봉투
  CLP1000: { print_color_type: 'fside_color_amount1', paper_size: 'small_size_type', paper_qty: 'paper_qty_select' }, // 라벨
  CPR4000: { paper_code: 'cover_paper_code', print_color_type: 'binding_type', paper_qty: 'bundle_qty' }, // 책자
  CCD1000: { print_color_type: 'print_method', paper_qty: 'paper_qty_select' },           // 벽걸이 캘린더
  CCD2000: { print_color_type: 'print_method', paper_qty: 'paper_qty_select' },           // 탁상/미니 캘린더
  CNR2000: { print_color_type: 'fside_color_amount', paper_size: 'code_size_type' },       // 서식/양식
  CPR3000: { print_color_type: 'print_method' },                                          // 리플렛
  CLF2000: { print_color_type: 'print_method' },                                          // 메뉴/브로슈어
  // OMO-2961 전 카테고리 감사(2026-06-12): 전단/포스터는 print_color_type 필드가 없고
  // 앞/뒷면 색상도수(fside_color_amount)로 분리됨 → 봉투(CEV1000)·양식(CNR2000)과 동일 매핑.
  // (값코드 CTN↔도수 매핑은 후속 OMO-2904 에서 카테고리별 정합화)
  CLF1000: { print_color_type: 'fside_color_amount' },                                     // 전단
  CPR2000: { print_color_type: 'fside_color_amount' },                                     // 포스터
}

// ─── 종속(재populate) select 필드 (OMO-3033 / OMO-3030 / OMO-3037) ──
//
// 성원 폼의 일부 select 는 다른 옵션을 선택하는 순간 AJAX 로 옵션 목록이
// 갈아끼워진다(재populate). 대표 케이스가 책자 `binding_type` —
// 정적 HTML 엔 [BDT2,BDT6,BDT4] 가 다 있으나, 표지 용지(cover_paper_*)나
// 내지 페이지수(in_page_qty) 를 고르는 순간 binding_type 이 재populate 되며
// BDT6(PUR무선제본)의 진짜 노출 게이트는 **내지 페이지수 in_page_qty ≥ 32**
// (PUR무선 최소 내지 32p). 이 조건이 충족되면 표지는 고급지 PKD20(현행 시드
// ARE160W00 포함)·특수지 PKD30 등에서 BDT6 가 살아남는다 — PKD30 전용이 아니다.
// 반대로 일반지 PKD10·펄지 PKD40 은 표지 용지 자체가 BDT6 원천 미노출.
// (OMO-3037 정정: 종전 "PKD30 표지 전용" 단정은 오류 — OMO-3034 라이브 probe 로 반증.)
// 라이브 확정: scripts/test-artifacts/omo3034/phase{1,5,6,7}-*.json
//             (구 omo3030/{bdt6,probe2}.json 은 부분 관측이라 오해 소지).
//
// 따라서 이런 종속 필드는 (1) 선행 옵션을 모두 적용한 "뒤에" 설정하고,
// (2) 설정 직전 live select 에 값이 실제 존재하는지 검증해야 한다. 검증 없이
// selectEl.selectOption('BDT6') 하면 모호한 Playwright 예외가 나서 어떤 조합이
// 비호환인지 알 수 없고, 용지/페이지 조합에 따라 간헐 발주 실패한다.
const DEPENDENT_SELECT_FIELDS = new Set(['binding_type'])

/**
 * OMO-3033: 옵션 적용 순서를 둘로 가른다.
 * - immediate: 표지/내지 용지·사이즈 등 먼저 적용할 필드(canonical optKey)
 * - deferred: 다른 옵션에 따라 재populate 되는 종속 필드 — 반드시 마지막에 설정
 * 반환 키는 alias 변환 전 canonical optKey 다. 수량·후가공 키는 별도 경로라 제외.
 */
export function partitionOptionKeys(
  options: Record<string, string>,
  fieldAlias: Record<string, string> = {},
): { immediate: string[]; deferred: string[] } {
  const immediate: string[] = []
  const deferred: string[] = []
  for (const optKey of Object.keys(options)) {
    if (optKey === 'quantity' || optKey === 'paper_qty') continue
    if (isFinishingKey(optKey)) continue
    const target = fieldAlias[optKey] ?? optKey
    if (DEPENDENT_SELECT_FIELDS.has(target)) deferred.push(optKey)
    else immediate.push(optKey)
  }
  return { immediate, deferred }
}

// ─── 책자(CPR4000) 내지 페이지수 기본값 (OMO-3041) ──────────────────
//
// BDT6(PUR무선제본)의 실노출 게이트는 내지 페이지수 in_page_qty ≥ 32 (PUR무선
// 최소 내지 32p — OMO-3035/3037 라이브 확정). print_product_options 는 canonical
// 4종(paper_code/print_color_type/paper_size/paper_qty)만 저장 가능해(CHECK 제약)
// in_page_qty 를 DB 시드로 둘 수 없다. 따라서 책자 카테고리(CPR4000) 자동발주에
// 한해 내지 페이지수 기본값을 코드에서 주입한다.
//
// - 발주 입력에 in_page_qty 가 없으면 → 권장 기본값 64p 주입.
// - 입력에 in_page_qty 가 있으면 그 값을 존중한다(고객/상위 의도 우선). 단 32 미만이면
//   PUR무선 자체가 불가(BDT6 미노출)라 발주가 실패하는데, 그 진단/중단은 이미
//   selectOrderOptions 의 deferred 검증(OMO-3037)이 명확한 에러로 처리한다 — 여기서
//   조용히 끌어올려 고객 의도와 다른 페이지수로 오발주하지 않는다.
const BOOKLET_CATEGORY_CODES = new Set(['CPR4000'])
const BOOKLET_DEFAULT_IN_PAGE_QTY = 64

/**
 * OMO-3041: 책자(CPR4000) 자동발주 옵션에 내지 페이지수 기본값(≥32, 권장 64p)을
 * 주입한다. in_page_qty 가 이미 있으면 원본 그대로 반환(입력 의도 존중).
 * 비-책자 카테고리는 변경 없이 통과.
 */
export function withBookletInPageQtyDefault(
  categoryCode: string,
  options: Record<string, string>,
): Record<string, string> {
  if (!BOOKLET_CATEGORY_CODES.has(categoryCode)) return options
  if (options['in_page_qty']) return options
  return { ...options, in_page_qty: String(BOOKLET_DEFAULT_IN_PAGE_QTY) }
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
    return { success: false, errorMessage: 'SWADPIA_USERNAME / SWADPIA_PASSWORD environment variables are missing' }
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
    const fieldAlias = SWADPIA_FIELD_ALIAS[categoryCode] ?? {}
    // OMO-3041: 책자(CPR4000)는 내지 페이지수 기본값(≥32, 권장 64p)을 주입해야
    // BDT6(PUR무선) 노출 게이트(in_page_qty≥32)를 통과한다. in_page_qty 는 canonical
    // 옵션이 아니라 시드에 없으므로 발주 직전 코드에서 채운다.
    const effectiveOptions = withBookletInPageQtyDefault(categoryCode, input.selectedOptions)
    await selectOrderOptions(page, effectiveOptions, input.quantity, fieldAlias)

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
      return { success: false, errorMessage: 'plupload upload failed — chgFileName missing' }
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
      return { success: false, errorMessage: `Failed to reach the order page — URL: ${page.url()}` }
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
      return { success: false, errorMessage: `Failed to reach the payment page — URL: ${page.url()}` }
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
      errorMessage: `Failed to confirm order completion — URL: ${finalUrl}`,
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
    throw new Error('Swadpia login failed')
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

// ─── 후가공 인터랙티브 활성화 (OMO-2647) ───────────────────────────
//
// 단순 select 옵션과 달리, 후가공(박/형압/도무송/타공/넘버링)은 성원 goods_view
// 에서 숨김 select 다. 값+change 만으로는 가격이 안 잡힌다(라이브 검증). 실제 단가는
// 다음 시퀀스로만 잡힌다(omo2647-* RE 스크립트로 확정):
//   1) chk_is_{type} 체크 + pnl_{type} 노출(활성화)
//   2) section/type 등 select 설정 → 런타임 옵션 populate 유발
//   3) 넘버링: chgNumberingType() 로 numbering_kind 동적 채움 후 선택
//   4) setIsPostpress(type) → product1.pp{Type}('1' for bak/ap) → {type}_amt 산출
//   5) product1.calcuEstimate() → pay_amt 합산
// 박/형압은 면적(bak_x_size_1/bak_y_size_1)이 >0 이어야 단가가 잡힌다
// (DEFAULT_FINISHING_FIELD_VALUES 에서 기본 면적 주입).
const FINISHING_GROUPS: { ppType: string; prefix: string }[] = [
  { ppType: 'bak', prefix: 'bak_' },
  { ppType: 'ap', prefix: 'ap_' },
  { ppType: 'domusong', prefix: 'domusong_' },
  { ppType: 'tagong', prefix: 'tagong_' },
  { ppType: 'numbering', prefix: 'numbering_' },
  // OMO-2961: 런타임 추출 4종(라이브 검증 완료). chk 클릭으로 옵션 populate 후 적용.
  { ppType: 'guidori', prefix: 'guidori_' },
  { ppType: 'epoxy', prefix: 'epoxy_' },
  { ppType: 'osi', prefix: 'osi_' },
  { ppType: 'missing', prefix: 'missing_' },
]

function isFinishingKey(key: string): boolean {
  return FINISHING_GROUPS.some((g) => key.startsWith(g.prefix))
}

async function activateFinishings(
  page: Page,
  finishingOpts: Record<string, string>,
): Promise<void> {
  const keys = Object.keys(finishingOpts)
  for (const g of FINISHING_GROUPS) {
    const groupKeys = keys.filter((k) => k.startsWith(g.prefix))
    if (groupKeys.length === 0) continue
    const fieldMap: Record<string, string> = {}
    for (const k of groupKeys) fieldMap[k] = finishingOpts[k]

    await page.evaluate(
      (params: { ppType: string; fieldMap: Record<string, string> }) => {
        const { ppType, fieldMap } = params
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        const setField = (name: string, value: string) => {
          const el = document.querySelector(`[name="${name}"]`) as
            | HTMLSelectElement
            | HTMLInputElement
            | null
          if (!el) return
          if (el.tagName === 'SELECT') {
            const sel = el as HTMLSelectElement
            if (!Array.from(sel.options).some((o) => o.value === value)) return
          }
          el.value = value
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
        // 1. 활성화 (체크박스 + 패널 노출)
        const chk = document.getElementById(`chk_is_${ppType}`) as HTMLInputElement | null
        if (chk) chk.checked = true
        const chk2 = document.getElementById(`chk_is_${ppType}2`) as HTMLInputElement | null
        if (chk2) chk2.checked = true
        // OMO-2961: 런타임 4종은 chk 클릭 이벤트가 있어야 사이즈별 옵션이 JS populate 된다
        // (라이브 검증). 기존 5종(bak/ap/...)은 setIsPostpress 로 동작하므로 영향 없음.
        const RUNTIME_PP = ['guidori', 'epoxy', 'osi', 'missing']
        if (chk && RUNTIME_PP.indexOf(ppType) !== -1) {
          chk.dispatchEvent(new Event('click', { bubbles: true }))
          chk.dispatchEvent(new Event('change', { bubbles: true }))
        }
        try { w.$j && w.$j(`#pnl_${ppType}`).show() } catch { /* */ }
        // 1-b. OMO-3257 박 멀티레이어: bak_x_size_N(N≥2) 가 fieldMap 에 있으면
        //   settingExistBakDongpan(i) 로 레이어 행을 먼저 생성해야 bak_*_2/_3 필드가
        //   폼에 존재한다(성원 JS 근거, OMO-3238 확정). 레이어 2..N 순서로 호출하고,
        //   가격은 setIsPostpress→calcuEstimate 가 setPPBakAmtSum 으로 bak_amt 합산(결정론).
        if (ppType === 'bak') {
          let maxLayer = 1
          for (const fname of Object.keys(fieldMap)) {
            const m = fname.match(/^bak_x_size_(\d+)$/)
            if (m) maxLayer = Math.max(maxLayer, Number(m[1]))
          }
          for (let i = 2; i <= maxLayer; i++) {
            try { w.settingExistBakDongpan && w.settingExistBakDongpan(i) } catch { /* */ }
          }
        }
        // 2. section/type/size 설정 (kind 는 populate 후 별도)
        for (const [n, v] of Object.entries(fieldMap)) {
          if (n.endsWith('_kind')) continue
          setField(n, v)
        }
        // 3. 넘버링: type 변경 후 kind 동적 populate → 지정값(없으면 첫 옵션) 선택
        if (ppType === 'numbering') {
          try { w.chgNumberingType && w.chgNumberingType() } catch { /* */ }
          const ke = document.querySelector('select[name="numbering_kind"]') as HTMLSelectElement | null
          if (ke) {
            const opts = Array.from(ke.options).map((o) => o.value).filter(Boolean)
            const want = fieldMap['numbering_kind']
            const chosen = want && opts.includes(want) ? want : opts[0] || ''
            if (chosen) {
              ke.value = chosen
              ke.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }
        }
        // 3-b. OMO-2961 귀도리: 위치 체크박스. 기본 네귀도리(GDR40)=4모서리 전체 체크.
        if (ppType === 'guidori') {
          for (const i of [1, 2, 3, 4]) {
            const p = document.querySelector(`[name="guidori_position${i}"]`) as HTMLInputElement | null
            if (p && !p.checked) {
              p.checked = true
              p.dispatchEvent(new Event('click', { bubbles: true }))
              p.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }
        }
        // 3-c. OMO-2961 에폭시: epoxy_kind 는 type 선택 후 JS 동적 채움 →
        //      지정값(없으면 첫 유효옵션) 선택. (넘버링 kind 패턴과 동일)
        if (ppType === 'epoxy') {
          const ke = document.querySelector('select[name="epoxy_kind"]') as HTMLSelectElement | null
          if (ke) {
            const opts = Array.from(ke.options).map((o) => o.value).filter(Boolean)
            const want = fieldMap['epoxy_kind']
            const chosen = want && opts.indexOf(want) !== -1 ? want : opts[0] || ''
            if (chosen) {
              ke.value = chosen
              ke.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }
        }
        // 4. canonical 재계산 (올바른 seq 로 pp 메서드 호출 → {type}_amt)
        try { w.setIsPostpress && w.setIsPostpress(ppType) } catch { /* */ }
        try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
      },
      { ppType: g.ppType, fieldMap },
    )
    await page.waitForTimeout(900)
    // 런타임/AJAX populate 반영 후 합산 한 번 더 보장
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
    })
    await page.waitForTimeout(200)
  }
}

/**
 * 단일 옵션 필드를 폼에 적용한다 — select(대부분) 또는 hidden radio(paper_gloss 등).
 * 후가공 필드는 인터랙티브 활성화(activateFinishings)에서 별도 처리하므로 여기 호출 금지.
 * 여기서 평면 selectOption 하면 숨김 select 라 단가가 안 잡힌다(OMO-2647)는 점에 주의.
 */
async function applyOptionField(page: Page, key: string, value: string): Promise<void> {
  // select 요소 직접 선택 (Swadpia는 대부분 select 기반)
  const selectEl = await page.$(`select[name="${key}"]`)
  if (selectEl) {
    await selectEl.selectOption(value)
    await page.waitForTimeout(300)
    return
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
  }
}

export async function selectOrderOptions(
  page: Page,
  options: Record<string, string>,
  quantity: number,
  fieldAlias: Record<string, string> = {},
): Promise<void> {
  // OMO-3033: 종속(재populate) 필드(책자 binding_type 등)는 선행 옵션 적용 후
  // 마지막에 설정해야 한다 → immediate / deferred 로 분리.
  const { immediate, deferred } = partitionOptionKeys(options, fieldAlias)

  // 1) 즉시 적용 필드 (표지/내지 용지, 사이즈 등)
  for (const optKey of immediate) {
    // canonical option_type → 성원 실제 select name 변환 (OMO-2634)
    await applyOptionField(page, fieldAlias[optKey] ?? optKey, options[optKey])
  }

  // 2) 수량 — 카테고리별 실제 수량 select name (paper_qty / paper_qty_select / bundle_qty)
  if (quantity) {
    const qtyField = fieldAlias['paper_qty'] ?? 'paper_qty'
    const qtySelect = await page.$(`select[name="${qtyField}"]`)
    if (qtySelect) {
      await qtySelect.selectOption(String(quantity))
      await page.waitForTimeout(300)
    }
  }

  // 3) 종속(재populate) 필드 — 표지/내지 용지·페이지수·수량 적용이 끝나 옵션
  //    목록이 확정된 "뒤에" 설정한다. 설정 직전 live select 에 값 존재를 검증해
  //    (OMO-3033) 없으면 명확한 에러로 중단 — 조용한 스킵/오발주 금지.
  for (const optKey of deferred) {
    const key = fieldAlias[optKey] ?? optKey
    const value = options[optKey]
    const selectEl = await page.$(`select[name="${key}"]`)
    if (!selectEl) {
      throw new Error(
        `[swadpia-order] 종속 옵션 select[name="${key}"] 가 폼에 없음 — ` +
          `상품 폼 구조 변경 의심. 발주 중단(${optKey}=${value}).`,
      )
    }
    const liveValues: string[] = await selectEl.evaluate((el: Element) =>
      Array.from((el as HTMLSelectElement).options).map((o) => o.value),
    )
    // OMO-3037: BDT6 부재의 1순위 원인이 내지 페이지수 부족이라, 검증 throw 전에
    // in_page_qty<32 면 진단을 좁혀 주는 안내 로그를 남긴다(흐름은 그대로).
    if (value === 'BDT6' && !liveValues.includes(value)) {
      const inPageQty = Number(options['in_page_qty'])
      if (Number.isFinite(inPageQty) && inPageQty < 32) {
        console.warn(
          `[swadpia-order] ⚠️ BDT6 미노출 — in_page_qty=${inPageQty} < 32(PUR무선 최소 내지). ` +
            `표지 용지가 아닌 페이지수가 게이트일 가능성 높음(OMO-3037).`,
        )
      }
    }
    if (!liveValues.includes(value)) {
      throw new Error(
        `[swadpia-order] ${key}=${value} 가 현재 옵션 조합에서 선택 불가 ` +
          `(live 옵션: [${liveValues.filter(Boolean).join(',')}]). ` +
          (value === 'BDT6'
            ? `BDT6(PUR무선제본) 노출 게이트는 내지 페이지수 in_page_qty≥32 이며 ` +
              `표지는 고급지(PKD20)·특수지(PKD30) 등에서 살아남는다 — 일반지(PKD10)·펄지(PKD40) 표지는 원천 미노출. ` +
              `부재 원인은 보통 (1) in_page_qty<32(현재 ${options['in_page_qty'] ?? '미상'}) 또는 ` +
              `(2) 표지 용지(${options['paper_code'] ?? '미상'})가 PKD10/PKD40 계열. ` +
              `해당 조합을 32p 이상·BDT6 호환 표지로 교정 필요(OMO-3037). `
            : '') +
          `오발주 방지를 위해 발주 중단.`,
      )
    }
    await applyOptionField(page, key, value)
  }

  await page.waitForTimeout(1000)

  // 후가공 인터랙티브 활성화 (OMO-2647) — 단순옵션·수량 설정 후 실행해야
  // 사이즈/수량 의존 단가가 올바르게 잡힌다.
  const finishingOpts: Record<string, string> = {}
  for (const [k, v] of Object.entries(options)) {
    if (isFinishingKey(k)) finishingOpts[k] = v
  }
  // OMO-3264 박 사이즈 가드: 박 레이어(최대 3)의 가로/세로를 발주 전에 검증한다.
  //   성원 chk_size_high 의 per-axis(용지 cut 규격 대비) 상한은 라이브 RE(OMO-3262)로 확정됨
  //   (0<x≤cutX && 0<y≤cutY). 용지 cut 치수는 성원 자체 권위 소스인 ppBak.getCutXSize/
  //   getCutYSize(현재 폼에 적용된 용지/사이즈 기준)에서 읽어 paperCut 으로 주입한다.
  //   읽기 실패(globals 미준비 등) 시 양수 검사만 수행 — 최종 권위는 activateFinishings →
  //   calcuEstimate 가 트리거하는 성원 자체 chk_size_low/high 다(거짓거부 방지).
  const foilLayers = parseFoilLayersFromOptions(finishingOpts)
  if (foilLayers.length > 0) {
    const paperCut = await page
      .evaluate(() => {
        const pb = (window as unknown as { ppBak?: { getCutXSize?: () => unknown; getCutYSize?: () => unknown } }).ppBak
        if (!pb || typeof pb.getCutXSize !== 'function' || typeof pb.getCutYSize !== 'function') return null
        const cutX = Number(pb.getCutXSize())
        const cutY = Number(pb.getCutYSize())
        if (!Number.isFinite(cutX) || cutX <= 0 || !Number.isFinite(cutY) || cutY <= 0) return null
        return { cutX, cutY }
      })
      .catch(() => null)
    const v = validateFoilLayers(foilLayers, paperCut ?? undefined)
    if (!v.ok) {
      throw new Error(
        `[swadpia-order] 박 레이어 검증 실패(가로/세로 양수, 최대 ${MAX_FOIL_LAYERS}레이어` +
          `${paperCut ? `, 용지 cut ${paperCut.cutX}×${paperCut.cutY}mm 이내` : ''}) — ` +
          `발주 중단: ${v.errors.join(' / ')}`,
      )
    }
  }
  if (Object.keys(finishingOpts).length > 0) {
    await activateFinishings(page, finishingOpts)
  }
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
      throw new Error('iframe_InnoDS frame not found')
    }

    const fileInput = await innoDSFrame.$('input[type="file"]')
    if (!fileInput) {
      throw new Error('file input not found inside iframe')
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
  if (!res.ok) throw new Error(`File download failed ${res.status}: ${url}`)

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
