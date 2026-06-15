/**
 * OMO-3239 게이트 1 (확정) — 장바구니 등록은 order_form 의 일반 POST submit
 * (goods_action=regist) 으로 goods_view/CPR2000 에 전송된다. 그 POST body 의
 * total_price 가 hidden input total_price 와 동치인지 검증. POST 는 abort(미등록).
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

let captured = null
await page.route('**/*', route => {
  const req = route.request(); const body = req.postData() || ''
  if (req.method() === 'POST' && /:\/\/(www\.)?swadpia\.co\.kr\//.test(req.url()) && /goods_action=regist|total_price=/.test(body)) {
    captured = { url: req.url(), body: body.slice(0, 8000) }; return route.abort()
  }
  return route.continue()
})

// 우리 발주 코드와 동일하게 regist 필드 세팅 후 폼 제출 (POST 는 abort 됨 → 미등록)
const trigger = await page.evaluate(() => {
  const form = document.getElementById('order_form') || document.querySelector('form[name="order_form"]') || document.forms[0]
  if (!form) return 'NO_FORM'
  const set = (n, val) => { let e = form.querySelector(`[name="${n}"]`); if (!e) { e = document.createElement('input'); e.type = 'hidden'; e.name = n; form.appendChild(e) } e.value = val }
  set('goods_mode', 'cart'); set('goods_action', 'regist'); set('InnoDS_Use', 'Y'); set('order_path', 'ODP10')
  form.submit()
  return 'submitted'
})
await page.waitForTimeout(3500)

const payloadTotal = captured ? (captured.body.match(/(?:^|&)total_price=([0-9]+)/) || [])[1] || null : null
const fields = {}
if (captured) for (const kv of captured.body.split('&')) { const [k, val] = kv.split('='); if (/price|count|qty|size|action|mode/i.test(k)) fields[k] = decodeURIComponent(val || '') }
const out = { hiddenTotal, trigger, capturedURL: captured?.url || null, payloadTotal, equivalent: payloadTotal != null && payloadTotal === hiddenTotal, relevantFields: fields, bodySample: captured?.body.slice(0, 1000) || null }
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/gate1.json`, JSON.stringify(out, null, 2))
console.log('hiddenTotal=', hiddenTotal, ' payloadTotal=', payloadTotal, ' EQUIVALENT=', out.equivalent)
console.log('capturedURL=', captured?.url)
console.log('relevantFields=', JSON.stringify(fields, null, 1))
await browser.close()
