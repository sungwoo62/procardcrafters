// OMO-3520: 성원 CNC1000(명함) goods_view 라이브 select 옵션 덤프 (READ-ONLY, 발주 없음).
import { chromium } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
const U = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!U || !PW) { console.error('no creds'); process.exit(1) }
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ locale: 'ko-KR', viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept())
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
await page.fill('input[name="member_id"]', U)
await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(()=>{}), page.click('#icon_member_login')])
await page.waitForTimeout(1500)
await page.goto(`${BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2500)
const dump = await page.evaluate(() => {
  const want = ['paper_code','print_color_type','paper_size','paper_qty']
  const out = {}
  for (const name of want) {
    const el = document.querySelector(`select[name="${name}"]`)
    if (!el) { out[name] = null; continue }
    out[name] = {
      selected: el.value,
      options: Array.from(el.options).slice(0, 30).map(o => ({ v: o.value, t: (o.text||'').trim().slice(0,24) })),
    }
  }
  return out
})
console.log(JSON.stringify(dump, null, 1))
await b.close()
