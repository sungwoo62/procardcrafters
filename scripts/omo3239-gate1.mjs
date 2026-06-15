/**
 * OMO-3239 게이트 1 (정밀) — 포스터 add-to-cart payload 의 total_price == hidden total_price 동치.
 * swadpia.co.kr 호스트 + cart/regist 경로만 가로채고 abort (장바구니 오염 방지). GA collect 등 제외.
 */
import { chromium } from 'playwright'
import fs from 'fs'; import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3239'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1800 } })
const page = await ctx.newPage(); page.on('dialog', d => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

await page.goto(`${BASE}/goods/goods_view/CPR2000`, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2000)
await page.selectOption('select[name="paper_size"]', 'A0100').catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500)

const v = name => page.evaluate(n => { const e = document.querySelector(`input[name="${n}"],#${n}`); return e ? e.value : null }, name)
const hiddenTotal = await v('total_price')

// 폼/버튼/함수 구조 진단
const diag = await page.evaluate(() => {
  const form = document.querySelector('form#order_form') || document.querySelector('form[name="order_form"]') || document.forms[0]
  const cartEls = Array.from(document.querySelectorAll('a,button,input[type=button],input[type=submit],span,div'))
    .filter(e => /장바구니|담기|cart|주문/i.test((e.textContent || '') + '|' + (e.value || '') + '|' + (e.id || '') + '|' + (e.className || '') + '|' + (e.getAttribute('onclick') || '')))
    .slice(0, 12)
    .map(e => ({ tag: e.tagName, id: e.id, cls: (e.className || '').slice(0, 40), text: (e.textContent || e.value || '').trim().slice(0, 30), onclick: (e.getAttribute('onclick') || '').slice(0, 80) }))
  const fns = ['goods_cart', 'cart', 'order_cart', 'goCart', 'fn_cart', 'add_cart', 'goods_order', 'order', 'fn_order', 'estimate_cart']
    .filter(n => typeof window[n] === 'function')
  return { formId: form?.id, formName: form?.getAttribute('name'), formAction: form?.action, cartEls, fns }
})

let captured = []
await page.route('**/*', route => {
  const req = route.request(); const url = req.url()
  const isSwadpia = /:\/\/(www\.)?swadpia\.co\.kr\//.test(url)
  const isCartPath = /\/(cart|order|estimate)/i.test(new URL(url).pathname)
  if (req.method() === 'POST' && isSwadpia && isCartPath && !/json_data/.test(url)) {
    captured.push({ url, postData: (req.postData() || '').slice(0, 6000) }); return route.abort()
  }
  return route.continue()
})

// cart 함수 직접 호출 우선, 없으면 버튼 클릭
const trigger = await page.evaluate((diag) => {
  for (const n of diag.fns) { try { window[n](); return `fn:${n}` } catch (e) {} }
  const btn = document.querySelector('#goods_cart, #btn_cart, .btn_cart, a[onclick*="cart"], button[onclick*="cart"]')
  if (btn) { btn.click(); return `click:${btn.id || btn.className}` }
  const cand = Array.from(document.querySelectorAll('a,button,input[type=button],input[type=submit]'))
    .find(e => /장바구니|담기/.test((e.textContent || '') + (e.value || '')))
  if (cand) { cand.click(); return `clickText:${(cand.textContent || cand.value).trim().slice(0,20)}` }
  return 'NONE'
}, diag)
await page.waitForTimeout(3500)

const payloadTotal = captured.map(c => (c.postData.match(/(?:^|&)total_price=([0-9]+)/) || [])[1]).find(Boolean) || null
const out = { hiddenTotal, trigger, diag, captured: captured.map(c => ({ url: c.url, total_price: (c.postData.match(/(?:^|&)total_price=([0-9]+)/) || [])[1] || null, hasTotalKey: /total_price=/.test(c.postData), payloadSample: c.postData.slice(0, 800) })), payloadTotal, equivalent: payloadTotal != null && payloadTotal === hiddenTotal }
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/gate1.json`, JSON.stringify(out, null, 2))
console.log('hiddenTotal=', hiddenTotal, ' payloadTotal=', payloadTotal, ' equivalent=', out.equivalent)
console.log('trigger=', trigger)
console.log('formAction=', diag.formAction, ' fns=', JSON.stringify(diag.fns))
console.log('cartEls=', JSON.stringify(diag.cartEls, null, 1).slice(0, 1200))
console.log('capturedURLs=', captured.map(c => c.url))
await browser.close()
