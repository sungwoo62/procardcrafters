// OMO-3581: swguide_postpress(bak/ap/domusong/epoxy) 작업방법 팝업 이미지 URL 캡처 (READ-ONLY).
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
const page = await (await browser.newContext({ locale: 'ko-KR' })).newPage()
page.on('dialog', (d) => d.dismiss().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME); await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1500)
// swguide_postpress 본문 + starColor_download 본문 덤프
const fnsrc = await page.evaluate(() => {
  const out = {}
  for (const n of ['swguide_postpress', 'starColor_download']) { try { if (typeof window[n] === 'function') out[n] = window[n].toString().slice(0, 1200) } catch (e) {} }
  return out
})
const results = {}
for (const key of ['bak', 'ap', 'domusong', 'epoxy']) {
  const before = await page.evaluate(() => Array.from(document.images).map((i) => i.src))
  await page.evaluate((k) => { try { window.swguide_postpress(k) } catch (e) {} }, key)
  await page.waitForTimeout(1200)
  const shown = await page.evaluate(() => {
    // 보이는 팝업 레이어 내 이미지
    const imgs = Array.from(document.images).filter((i) => i.offsetParent !== null && /guide|postpress|bak|popup|layer|estimate/i.test(i.src))
    const pop = Array.from(document.querySelectorAll('[id*="guide" i],[id*="postpress" i],[class*="layer" i],[id*="pop" i]'))
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ id: e.id, imgs: Array.from(e.querySelectorAll('img')).map((i) => i.src) }))
      .filter((x) => x.imgs.length)
    return { imgs: imgs.map((i) => i.src).slice(0, 10), pop: pop.slice(0, 6) }
  })
  results[key] = shown
  // 닫기
  await page.evaluate(() => { document.querySelectorAll('[onclick*="close" i],[id*="close" i]').forEach((e) => { try { e.click() } catch (x) {} }) })
  await page.waitForTimeout(400)
}
fs.mkdirSync('artifacts/omo3581', { recursive: true })
fs.writeFileSync(`artifacts/omo3581/swguide-${CODE}.json`, JSON.stringify({ fnsrc, results }, null, 2))
console.log('=== fn src ==='); console.log(JSON.stringify(fnsrc, null, 1).slice(0, 1400))
console.log('=== guide popup images ==='); console.log(JSON.stringify(results, null, 1))
await browser.close()
