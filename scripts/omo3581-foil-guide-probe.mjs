// OMO-3581: 제품페이지 '박인쇄 작업방법' 작업가이드 링크/이미지 소싱 (READ-ONLY).
// 단일 업로드 슬롯 확정 후, 합본 PDF 페이지 순서의 출처(성원 가이드)를 캡처한다.
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
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ locale: 'ko-KR' })).newPage()
page.on('dialog', (d) => d.dismiss().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)
const r = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, img, [onclick]'))
    .map((e) => ({ t: (e.textContent || e.alt || '').replace(/\s+/g, ' ').trim(), href: e.href || e.getAttribute('src') || e.getAttribute('onclick') || '' }))
    .filter((x) => /박|작업방법|작업가이드|가이드|위치|별색|단면|양면|인쇄파일|template|guide/i.test(x.t + x.href))
    .filter((x) => x.href).slice(0, 50)
  // 본문 내 박 관련 안내 텍스트
  const body = Array.from(new Set(Array.from(document.querySelectorAll('*'))
    .filter((e) => e.children.length === 0 && /박인쇄|박파일|위치보기|단면.*양면|별색판|K100|M100|박모양|동판/.test(e.textContent || ''))
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.length > 3 && t.length < 400))).slice(0, 40)
  return { links: Array.from(new Map(links.map((l) => [l.href, l])).values()), body }
})
fs.mkdirSync('artifacts/omo3581', { recursive: true })
fs.writeFileSync(`artifacts/omo3581/foil-guide-${CODE}.json`, JSON.stringify(r, null, 2))
console.log('=== links ('+r.links.length+') ===')
for (const l of r.links) console.log((l.t||'(img)').slice(0,40), '=>', l.href.slice(0,110))
console.log('\n=== body guide ('+r.body.length+') ===\n', r.body.join('\n'))
await browser.close()
