#!/usr/bin/env node
// OMO-3414 (board ③): printcity 로그인 → 테스트 주문/파일업로드 capability 검증.
// ⚠️ 결제 금지. 결제 직전(파일업로드/장바구니)까지만 dry-run. 실주문/결제 절대 없음.
// 자격: .env.local 의 PRINTCITY_USERNAME/PRINTCITY_PASSWORD (보드 발급).
//
// 산출: scripts/test-artifacts/omo3414/order-capability.json (+ 스크린샷)
//   { login, productPage, fileUpload, cart } 각 단계 가능여부 + 증거.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const ART = resolve(__dir, 'test-artifacts/omo3414')
mkdirSync(ART, { recursive: true })

// .env.local 직접 파싱(런타임 의존성 없이)
function env(key) {
  try {
    const raw = readFileSync(resolve(__dir, '../.env.local'), 'utf8')
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m ? m[1].trim() : null
  } catch { return null }
}
const USER = env('PRINTCITY_USERNAME')
const PASS = env('PRINTCITY_PASSWORD')
const report = { startedAt: new Date().toISOString(), steps: {} }

async function shot(page, name) {
  const p = resolve(ART, `cap-${name}.png`)
  try { await page.screenshot({ path: p, fullPage: false }) } catch {}
  return p
}

async function main() {
  if (!USER || !PASS) { console.error('자격 부재(.env.local PRINTCITY_USERNAME/PASSWORD)'); process.exit(2) }
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()
  const consoleErrs = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)) })

  // /auth/login 응답 가로채기(토큰/응답 구조 확인 — VAT/부가세 단서 포함)
  const authResponses = []
  page.on('response', async (r) => {
    if (/auth\/login/.test(r.url())) {
      try { authResponses.push({ status: r.status(), body: (await r.text()).slice(0, 400) }) } catch {}
    }
  })

  try {
    // 1) 홈 → 로그인 폼 오픈 (.highlight 로그인 클릭 → id/pwd 필드 노출)
    await page.goto('https://www.printcity.co.kr/', { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(2000)
    await shot(page, '1-home')

    const trigger = page.locator('div.highlight:has-text("로그인")').first()
    let loginOpened = false
    try { await trigger.click({ timeout: 8000, force: true }); loginOpened = true } catch {}
    await page.waitForTimeout(2000)
    await shot(page, '2-login-form')

    const idField = page.locator('input[name="id"]').first()
    const pwField = page.locator('input[name="pwd"]').first()
    const idFound = await idField.count()
    const pwFound = await pwField.count()
    report.steps.loginFormFound = { trigger: loginOpened, idField: !!idFound, pwField: !!pwFound, url: page.url() }

    let loggedIn = false
    if (idFound && pwFound) {
      await idField.fill(USER)
      await pwField.fill(PASS)
      await shot(page, '3-filled')
      const submit = page.locator('button:has-text("로그인"), button[type="submit"], a:has-text("로그인하기")').last()
      try { await submit.click({ timeout: 8000, force: true }) } catch { await pwField.press('Enter') }
      await page.waitForTimeout(4000)
      await shot(page, '4-after-login')
      const content = await page.content()
      loggedIn = /로그아웃|logout|마이페이지|주문내역|정보수정/.test(content) && !/아이디를 입력하세요/.test(content)
      // auth 응답 또는 storage 토큰으로 보강 판정
      const hasToken = await page.evaluate(() => {
        const all = { ...localStorage, ...sessionStorage }
        return Object.keys(all).some((k) => /token|auth|access/i.test(k))
      }).catch(() => false)
      loggedIn = loggedIn || hasToken || authResponses.some((r) => r.status === 200 || r.status === 201)
      report.steps.login = { success: loggedIn, urlAfter: page.url(), hasToken, authResponses }
    } else {
      report.steps.login = { success: false, reason: '로그인 입력란 미발견', url: page.url() }
    }

    // 2) 제품 주문 페이지 도달 → 파일업로드 capability (명함=NameCard 라우트)
    if (loggedIn) {
      for (const slug of ['NameCard', 'NameCardUnited']) {
        try {
          await page.goto(`https://www.printcity.co.kr/product/${slug}`, { waitUntil: 'networkidle', timeout: 30000 })
          await page.waitForTimeout(3000)
        } catch {}
        const hasFileInput = await page.locator('input[type="file"]').count()
        const uploadBtn = await page.locator('text=/업로드|파일첨부|파일등록|웹하드/').count()
        const orderBtn = await page.locator('text=/주문하기|장바구니|바로주문|결제/').count()
        if (hasFileInput || uploadBtn || orderBtn) {
          await shot(page, `5-product-${slug}`)
          report.steps.productPage = { slug, reached: true, fileInputs: hasFileInput, uploadButtons: uploadBtn, orderButtons: orderBtn, url: page.url() }
          break
        }
        report.steps.productPage = { slug, reached: true, fileInputs: hasFileInput, uploadButtons: uploadBtn, orderButtons: orderBtn, url: page.url() }
      }

      // 3) 장바구니 페이지 도달 가능여부 (결제 직전까지만, 결제 클릭 금지)
      try {
        await page.goto('https://www.printcity.co.kr/order/cart', { waitUntil: 'networkidle', timeout: 25000 })
        await page.waitForTimeout(2500)
        await shot(page, '6-cart')
        const cartText = await page.locator('body').innerText().catch(() => '')
        report.steps.cart = {
          reached: true,
          url: page.url(),
          mentionsVat: /부가세|VAT|공급가|세액/.test(cartText),
          mentionsOrder: /주문|결제|장바구니/.test(cartText),
        }
      } catch (e) { report.steps.cart = { reached: false, err: String(e).slice(0, 120) } }
    }

    report.consoleErrors = consoleErrs.slice(0, 8)
  } catch (e) {
    report.fatal = String(e).slice(0, 300)
  } finally {
    report.finishedAt = new Date().toISOString()
    writeFileSync(resolve(ART, 'order-capability.json'), JSON.stringify(report, null, 2))
    await browser.close()
    console.log(JSON.stringify(report, null, 2))
  }
}
main()
