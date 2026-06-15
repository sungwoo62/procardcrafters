/**
 * OMO-3239 게이트 1 (구조적 확정) —
 *  (A) total_price 가 order_form 내부의 직렬화되는 named input 인지 (구조적 동치).
 *  (B) 실제 장바구니 버튼 클릭 시 발생하는 모든 POST 를 수동 로깅, regist 시그니처 POST 는 abort.
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

// (A) 구조적: total_price 가 order_form 의 직렬화 대상 named input 인가
const structural = await page.evaluate(() => {
  const form = document.getElementById('order_form') || document.querySelector('form[name="order_form"]')
  const tp = document.querySelector('#total_price, input[name="total_price"]')
  return {
    formExists: !!form, formAction: form?.action,
    totalPriceExists: !!tp, totalPriceName: tp?.getAttribute('name'), totalPriceValue: tp?.value,
    totalPriceDisabled: tp?.disabled, totalPriceType: tp?.type,
    totalPriceInsideForm: !!(form && tp && form.contains(tp)),
    serializedHasTotal: (() => { try { return form ? new URLSearchParams(new FormData(form)).has('total_price') : false } catch (e) { return 'FormData_err:' + e.message } })(),
    serializedTotalValue: (() => { try { return form ? new URLSearchParams(new FormData(form)).get('total_price') : null } catch (e) { return null } })(),
  }
})

// (B) 실 장바구니 클릭 — 모든 POST 수동 로깅, regist 시그니처는 abort
const posts = []
page.on('request', req => { if (req.method() === 'POST') posts.push({ url: req.url(), hasTotal: /total_price=/.test(req.postData() || ''), totalVal: ((req.postData() || '').match(/(?:^|&)total_price=([0-9]+)/) || [])[1] || null, hasRegist: /goods_action=regist/.test(req.postData() || '') }) })
await page.route('**/*', route => {
  const req = route.request()
  if (req.method() === 'POST' && /goods_action=regist/.test(req.postData() || '')) return route.abort()
  return route.continue()
})
const clicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('a,button,input[type=button],input[type=submit],span,div,img'))
    .find(e => /장바구니|담기/.test((e.textContent || '') + (e.alt || '') + (e.value || '')) && (e.onclick || e.getAttribute('onclick') || e.href || ['A','BUTTON','INPUT','IMG'].includes(e.tagName)))
  if (btn) { btn.click(); return (btn.textContent || btn.alt || btn.value || btn.id).trim().slice(0, 30) }
  return 'NONE'
})
await page.waitForTimeout(4000)

const out = { hiddenTotal, structural, clicked, posts: posts.slice(0, 25),
  registPost: posts.find(p => p.hasRegist) || null }
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/gate1.json`, JSON.stringify(out, null, 2))
console.log('hiddenTotal=', hiddenTotal)
console.log('STRUCTURAL:', JSON.stringify(structural, null, 1))
console.log('clicked=', clicked)
console.log('registPost=', JSON.stringify(out.registPost))
console.log('allPOSTs=', JSON.stringify(posts.map(p => ({ u: p.url.replace(BASE, ''), t: p.totalVal, r: p.hasRegist })), null, 1))
await browser.close()
