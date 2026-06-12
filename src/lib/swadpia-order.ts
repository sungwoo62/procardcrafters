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
}

// ─── Types ────────────────────────────────────────────────────

export interface SwadpiaOrderInput {
  productSlugOrCategoryCode: string
  selectedOptions: Record<string, string>
  quantity: number
  fileUrl: string
  orderTitle?: string
  /**
   * OMO-2707 dry-run: 로그인 → 옵션/후가공 활성화 → 주문모달 → 파일 업로드(plupload)
   * → hidden 필드 세팅까지 실제 프로덕션 경로 그대로 수행하되, **최종 제출/결제 직전에
   * 멈추고** 폼 스냅샷(박 옵션값 + 업로드 파일명)을 반환한다. 실주문 미발생.
   * Done 기준("박 옵션 + 디자인/별색판이 정확히 들어가는지 dry-run 확인")용.
   */
  dryRun?: boolean
}

/**
 * OMO-2707: 후가공 발주의 파일/옵션 정합성 스냅샷.
 * dryRun 시엔 제출 직전 폼에서 읽은 실제 값, 실주문 시엔 업로드 직후 산출 값.
 */
export interface SwadpiaFinishingSnapshot {
  /** selectedOptions 에 후가공(bak_/ap_/...) 필드가 존재하는가 */
  present: boolean
  /** 업로드 파일이 PDF일 때 페이지 수 (그 외 null) */
  uploadedPageCount: number | null
  /**
   * 후가공 존재 + 합본 파일이 2페이지 이상(=OMO-2706 p2 M100 별색판 포함)이면 true.
   * 후가공인데 false 면 별색판 누락 위험(디자인판만 발주됨).
   */
  spotPlatePresent: boolean
  /** dryRun 에서 폼으로부터 읽어낸 박/후가공 활성 상태 + 핵심 옵션값 */
  formState?: Record<string, string | boolean>
  /** 업로드된 성원측 파일명(order_file_name2 = chgFileName) */
  uploadedFileName?: string
}

export interface SwadpiaOrderResult {
  success: boolean
  swadpiaOrderNumber?: string
  checkoutUrl?: string
  errorMessage?: string
  /** OMO-2707: 후가공 주문일 때 채워짐. dryRun 결과도 여기로 반환. */
  finishing?: SwadpiaFinishingSnapshot
  /** dryRun 모드로 실행됐는지(실주문 미발생) */
  dryRun?: boolean
  /** OMO-2830: 결제서(order_pay)에서 캡처한 성원 실 결제금액(KRW). 못 읽으면 undefined. */
  actualCostKrw?: number
  /** OMO-2830/2834: 실원가 캡처 출처(global / selector / label / none[진단]). 미스 시 진단 로깅용. */
  actualCostSource?: string
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
  // OMO-2830: 발주시점 실원가(성원 실 결제액). 마이그레이션 20260610000020 이후 존재.
  actual_cost_krw?: number | null
  actual_cost_usd?: number | null
  cost_recorded_at?: string | null
  cost_recorded_by?: string | null
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

    // ── OMO-2707: 후가공 파일 정합성 가드 ──────────────────────────
    // 후가공(박 등) 주문이면 업로드 파일은 OMO-2706 합본 PDF여야 한다:
    //   p1 = 디자인판(CMYK), p2 = M100 별색 후가공판(스팟 1도).
    // OMO-2704 결정에 따라 단일 파일·1슬롯이므로, 별색판은 같은 PDF의 2페이지로 들어간다.
    // 후가공인데 1페이지면 별색판 누락(디자인판만 발주) → 명확히 경고한다.
    const hasFinishing = Object.keys(input.selectedOptions).some(isFinishingKey)
    let uploadedPageCount: number | null = null
    if (fileExt === '.pdf') {
      uploadedPageCount = await countPdfPages(filePath)
    }
    const spotPlatePresent = hasFinishing && (uploadedPageCount ?? 0) >= 2
    if (hasFinishing) {
      if (spotPlatePresent) {
        console.log(`[swadpia-order] 후가공 주문 — 합본 ${uploadedPageCount}페이지 업로드 ` +
          `(p1 디자인 + p2 M100 별색판). OMO-2706/2704 준수.`)
      } else {
        console.warn(`[swadpia-order] ⚠️ 후가공 주문인데 업로드 파일이 ` +
          `${uploadedPageCount === null ? `비-PDF(${fileExt})` : uploadedPageCount + '페이지'} — ` +
          `M100 별색판 누락 가능성(디자인판만 발주됨). 에디터 합본 export 확인 필요.`)
      }
    }

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
    await selectOrderOptions(page, input.selectedOptions, input.quantity, fieldAlias)

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

    // 5-b. OMO-2707 dry-run: 제출 직전 멈추고 폼 스냅샷 반환(실주문 미발생).
    //      프로덕션 경로(옵션/후가공 활성화 + 업로드 + hidden 필드)를 그대로 거쳤으므로
    //      "박 옵션 + 디자인/별색판이 정확히 들어가는지" 를 고충실도로 확인할 수 있다.
    if (input.dryRun) {
      const formState = await page.evaluate(() => {
        const read = (sel: string): string | boolean | undefined => {
          const el = document.querySelector(sel) as HTMLInputElement | HTMLSelectElement | null
          if (!el) return undefined
          if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked
          return el.value
        }
        const out: Record<string, string | boolean> = {}
        // 박(bak) 활성/핵심 옵션 — 후가공의 대표 케이스
        for (const k of [
          'chk_is_bak', 'bak_section_1', 'bak_side_1', 'bak_type_1',
          'bak_compare_1', 'bak_x_size_1', 'bak_y_size_1',
          'order_file_name2', 'order_file', 'order_title',
        ]) {
          const v = read(`#${k}`) ?? read(`[name="${k}"]`)
          if (v !== undefined) out[k] = v
        }
        return out
      })
      return {
        success: true,
        dryRun: true,
        finishing: {
          present: hasFinishing,
          uploadedPageCount,
          spotPlatePresent,
          formState,
          uploadedFileName: chgFileName,
        },
      }
    }

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

    // OMO-2830: 결제서에서 실 결제금액(KRW) 캡처 → 발주 실원가 자동 저장(교차검증 마진).
    // 못 읽어도 발주는 진행(undefined → 호출측에서 추정 폴백/수동 입력).
    const payAmount = await readOrderPayAmount(page)
    const actualCostKrw = payAmount.krw ?? undefined
    const actualCostSource = payAmount.source

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
    const finishingSnapshot: SwadpiaFinishingSnapshot | undefined = hasFinishing
      ? { present: true, uploadedPageCount, spotPlatePresent, uploadedFileName: chgFileName }
      : undefined

    const orderMatch = finalUrl.match(/order_result\/SUCCESS\/([A-Z0-9]+)/)
    if (orderMatch) {
      return {
        success: true,
        swadpiaOrderNumber: orderMatch[1],
        checkoutUrl: finalUrl,
        finishing: finishingSnapshot,
        actualCostKrw,
        actualCostSource,
      }
    }

    if (finalUrl.includes('order_result')) {
      return { success: true, checkoutUrl: finalUrl, finishing: finishingSnapshot, actualCostKrw, actualCostSource }
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

// OMO-2830: 결제서(order_pay) 실 결제금액(KRW) 캡처용 셀렉터.
// 견적페이지(PRICE_SELECTORS)와 DOM 이 다를 수 있어 결제 합계 후보를 폭넓게 시도.
// 실제 성원 DOM 조사(OMO-2647 probe): .estimate_pay_price / [class*=pay_price] /
// 전역 order_price_detail 객체 존재 확인됨 → 셀렉터+전역+라벨텍스트 3중 시도.
const ORDER_PAY_PRICE_SELECTORS = [
  '#total_price',
  '#total_amount',
  '#pay_price',
  '#payPrice',
  '#order_total_price',
  '#order_price',
  '#last_price',
  '.estimate_pay_price',
  '.pay_price',
  '.total_price',
  '[id*="pay_price"]',
  '[id*="total_price"]',
  '[id*="total_amount"]',
  '[class*="pay_price"]',
] as const

// 결제금액 라벨 후보(라벨 옆/근처 숫자 추출용)
const PAY_LABEL_KEYWORDS = ['결제금액', '총 결제', '총결제', '최종 결제', '최종결제', '결제 금액', '입금금액', '입금 금액'] as const

// 전역 변수/객체 후보(성원은 order_price_detail 등 JS 전역에 가격 보관)
const PRICE_GLOBAL_KEYS = ['pay_price', 'total_price', 'order_total_price', 'last_price', 'order_price'] as const

export interface OrderPayAmount {
  krw: number | null
  source: string
}

function parseKrw(text: string | null | undefined): number | null {
  if (!text) return null
  const digits = String(text).replace(/[^0-9]/g, '')
  if (digits.length === 0) return null
  const n = parseInt(digits, 10)
  return Number.isFinite(n) && n >= 100 ? n : null
}

// OMO-2834: 라이브 발주 없이 결제서 캡처 로직을 검증하기 위해 export.
// (실 발주 1건은 실결제가 필요해 자동테스트로 대체 — scripts/omo2834-verify-order-pay-capture.ts)
export async function readOrderPayAmount(page: Page): Promise<OrderPayAmount> {
  // 1) JS 전역(order_price_detail.* / window.<key>) — 가장 신뢰도 높음
  const fromGlobal = await page.evaluate((keys: readonly string[]) => {
    const w = window as unknown as Record<string, unknown>
    const tryNum = (v: unknown): number | null => {
      if (typeof v === 'number' && isFinite(v) && v >= 100) return Math.round(v)
      if (typeof v === 'string') {
        const d = v.replace(/[^0-9]/g, '')
        if (d.length) { const n = parseInt(d, 10); if (n >= 100) return n }
      }
      return null
    }
    const opd = w['order_price_detail']
    if (opd && typeof opd === 'object') {
      for (const k of keys) {
        const hit = tryNum((opd as Record<string, unknown>)[k])
        if (hit != null) return { k: `order_price_detail.${k}`, v: hit }
      }
    }
    for (const k of keys) {
      const hit = tryNum(w[k])
      if (hit != null) return { k: `window.${k}`, v: hit }
    }
    return null
  }, PRICE_GLOBAL_KEYS).catch(() => null)
  if (fromGlobal && fromGlobal.v) return { krw: fromGlobal.v, source: `global:${fromGlobal.k}` }

  // 2) 셀렉터
  for (const sel of ORDER_PAY_PRICE_SELECTORS) {
    const text = await page.evaluate((s: string) => {
      const el = document.querySelector(s) as HTMLElement | null
      if (!el) return null
      return (el.innerText || el.textContent || '').trim()
    }, sel).catch(() => null)
    const n = parseKrw(text)
    if (n != null) return { krw: n, source: `selector:${sel}` }
  }

  // 3) 라벨 텍스트 근처 금액(결제금액/총 결제 등) — 라벨을 포함한 행에서 원 단위 추출
  const fromLabel = await page.evaluate((kws: readonly string[]) => {
    const els = Array.from(document.querySelectorAll('tr, li, div, p, td, span'))
    for (const el of els) {
      const t = (el as HTMLElement).innerText || el.textContent || ''
      if (t.length > 200) continue
      if (kws.some((kw) => t.includes(kw)) && /[0-9],?[0-9]/.test(t) && t.includes('원')) {
        // "원" 앞쪽 숫자 덩어리 추출
        const m = t.match(/([0-9][0-9,]{2,})\s*원/)
        if (m) return m[1]
      }
    }
    return null
  }, PAY_LABEL_KEYWORDS).catch(() => null)
  const nLabel = parseKrw(fromLabel)
  if (nLabel != null) return { krw: nLabel, source: 'label:결제금액' }

  // 4) 실패 — 진단용 후보 수집(첫 라이브 발주에서 정확한 셀렉터 파악)
  const diag = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('[id*="price" i],[class*="price" i],[id*="pay" i],[class*="pay" i],[id*="amount" i]'))
      .slice(0, 12)
      .map((e) => {
        const el = e as HTMLElement
        const id = el.id ? `#${el.id}` : ''
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/)[0]}` : ''
        const txt = ((el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 24)
        return `${id || cls}=${txt}`
      })
    return cands.join(' | ')
  }).catch(() => '')
  return { krw: null, source: `none[${diag}]` }
}

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
        try { w.$j && w.$j(`#pnl_${ppType}`).show() } catch { /* */ }
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

export async function selectOrderOptions(
  page: Page,
  options: Record<string, string>,
  quantity: number,
  fieldAlias: Record<string, string> = {},
): Promise<void> {
  for (const [optKey, value] of Object.entries(options)) {
    if (optKey === 'quantity' || optKey === 'paper_qty') continue
    // 후가공 필드는 인터랙티브 활성화(activateFinishings)에서 별도 처리.
    // 여기서 평면 selectOption 하면 숨김 select 라 단가가 안 잡힌다(OMO-2647).
    if (isFinishingKey(optKey)) continue
    // canonical option_type → 성원 실제 select name 변환 (OMO-2634)
    const key = fieldAlias[optKey] ?? optKey

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

  // 수량 — 카테고리별 실제 수량 select name (paper_qty / paper_qty_select / bundle_qty)
  //
  // 주의(OMO-2485): 일부 종이(예: 아르미230g ARM230W00)는 paper_code 변경 시
  // 성원 AJAX 로 paper_qty 사다리가 종이별로 리로드된다. 표준 명함은 200단위
  // (200,400,…)지만 ARM230W00 은 300단위(300,600,…)라 200 옵션이 없다.
  // 평면 selectOption('200') 은 "did not find some options" 로 실패한다.
  // → 현재 select 의 실제 옵션을 읽어 요청 수량이 없으면 가장 가까운 유효 수량
  //   (요청치 이상 중 최소, 없으면 최대)으로 스냅한다.
  if (quantity) {
    const qtyField = fieldAlias['paper_qty'] ?? 'paper_qty'
    const qtySelect = await page.$(`select[name="${qtyField}"]`)
    if (qtySelect) {
      const avail = await qtySelect.evaluate((el: Element) =>
        Array.from((el as HTMLSelectElement).options)
          .map((o) => o.value)
          .filter((v) => v !== '' && /^\d+$/.test(v))
          .map(Number),
      )
      let target = quantity
      if (avail.length > 0 && !avail.includes(quantity)) {
        const atLeast = avail.filter((q) => q >= quantity).sort((a, b) => a - b)
        target = atLeast.length > 0 ? atLeast[0] : Math.max(...avail)
        console.warn(
          `[swadpia-order] 요청수량 ${quantity} 가 이 종이의 수량옵션에 없음 → ${target} 으로 스냅 (옵션 ${avail.slice(0, 4).join(',')}…)`,
        )
      }
      await qtySelect.selectOption(String(target))
      await page.waitForTimeout(300)
    }
  }

  await page.waitForTimeout(1000)

  // 후가공 인터랙티브 활성화 (OMO-2647) — 단순옵션·수량 설정 후 실행해야
  // 사이즈/수량 의존 단가가 올바르게 잡힌다.
  const finishingOpts: Record<string, string> = {}
  for (const [k, v] of Object.entries(options)) {
    if (isFinishingKey(k)) finishingOpts[k] = v
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

// ─── PDF 페이지 수 (OMO-2707 후가공 정합성 가드) ──────────────────
//
// OMO-2706 합본 PDF 는 p1=디자인, p2=M100 별색판(박 있을 때만). 후가공 주문의
// 업로드 파일이 2페이지 이상인지로 별색판 포함 여부를 판정한다. pdf-lib 로 정확히
// 세고, 로드 실패 시 PDF 객체의 `/Type /Page`(Pages 아님) 출현 수로 폴백한다.
async function countPdfPages(filePath: string): Promise<number | null> {
  try {
    const bytes = fs.readFileSync(filePath)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })
      return doc.getPageCount()
    } catch {
      // 폴백: /Type /Page (뒤에 's' 없는) 토큰 카운트
      const text = bytes.toString('latin1')
      const matches = text.match(/\/Type\s*\/Page(?![\w])/g)
      return matches ? matches.length : null
    }
  } catch {
    return null
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
