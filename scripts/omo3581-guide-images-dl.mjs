// OMO-3581: 박 작업방법 + 별색 가이드 이미지 다운로드(증거 아티팩트). READ-ONLY.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
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
// 박 작업방법 가이드 페이지의 이미지 수집
await page.goto(`${BASE}/sw_guide/main/1/CA01/CB01/CC01/`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)
const bakImgs = await page.evaluate(() => Array.from(document.images).map((i) => i.src).filter((s) => /\.(jpg|jpeg|png|gif)/i.test(s) && !/btn|close|top_|tab/i.test(s)))
const dir = 'artifacts/omo3581/guides'
fs.mkdirSync(dir, { recursive: true })
const targets = [...new Set([...bakImgs,
  'https://www.swadpia.co.kr/images/popup/starColor/new/ibm_str_guide.jpg',
  'https://www.swadpia.co.kr/images/popup/starColor/new/re_ibm_img01_new.gif'])]
const saved = []
for (const url of targets.slice(0, 25)) {
  try {
    const resp = await ctx.request.get(url, { timeout: 20000 })
    if (!resp.ok()) continue
    const buf = await resp.body()
    if (buf.length < 1500) continue // skip tiny btns
    const name = url.split('/').slice(-2).join('_').replace(/[^\w.\-]/g, '_')
    fs.writeFileSync(path.join(dir, name), buf)
    saved.push({ url, name, bytes: buf.length })
  } catch (e) {}
}
fs.writeFileSync('artifacts/omo3581/guide-images.json', JSON.stringify({ bakImgs, saved }, null, 2))
console.log('bak guide page images:', JSON.stringify(bakImgs, null, 1))
console.log('saved:', JSON.stringify(saved, null, 1))
await browser.close()
