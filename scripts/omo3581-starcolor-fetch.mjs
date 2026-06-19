// OMO-3581: 별색(별색판) 규격 — /goods/starColor_download + swguide_popup_random 본문 캡처 (READ-ONLY).
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const CODE = process.argv[2] || 'CNC1000'
const GOODS = 'G' + CODE.slice(1, -1) + '1'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ locale: 'ko-KR' })
const page = await ctx.newPage()
page.on('dialog', (d) => d.dismiss().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME); await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1200)
const meta = await page.evaluate(() => ({
  category_code: (typeof window.category_code !== 'undefined') ? window.category_code : (document.querySelector('[name="category_code"]')?.value || null),
  swpop: (typeof window.swguide_popup_random === 'function') ? window.swguide_popup_random.toString().slice(0, 1000) : null,
}))
async function grab(url) {
  const p = await ctx.newPage()
  try {
    await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await p.waitForTimeout(800)
    const data = await p.evaluate(() => ({
      title: document.title,
      text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2500),
      imgs: Array.from(document.images).map((i) => i.src).filter((s) => /guide|star|bak|spot|color|estimate|popup/i.test(s)).slice(0, 20),
    }))
    await p.close(); return data
  } catch (e) { await p.close(); return { error: String(e) } }
}
const star = await grab(`${BASE}/goods/starColor_download/${meta.category_code}`)
fs.mkdirSync('artifacts/omo3581', { recursive: true })
fs.writeFileSync(`artifacts/omo3581/starcolor-${CODE}.json`, JSON.stringify({ meta, star }, null, 2))
console.log('category_code:', meta.category_code)
console.log('--- swguide_popup_random ---\n', meta.swpop)
console.log('\n--- starColor_download page ---\ntitle:', star.title)
console.log('text:', (star.text || star.error || '').slice(0, 1800))
console.log('imgs:', JSON.stringify(star.imgs, null, 1))
await browser.close()
