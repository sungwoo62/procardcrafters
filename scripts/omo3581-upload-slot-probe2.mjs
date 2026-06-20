// OMO-3581 v2: 숨김 2차 업로드 패널(pnl_file_upload2 / ilark) + 박 가이드 텍스트 정밀 캡처.
// READ-ONLY. 제출/업로드 없음.
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
if (!USER || !PW) { console.error('NO CREDS'); process.exit(2) }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1400, height: 1600 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.dismiss().catch(() => {}))

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
if (page.url().includes('/member/login')) { console.error('LOGIN FAILED'); await browser.close(); process.exit(3) }

await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)
await page.evaluate(() => document.querySelector('#btn_order3')?.click())
await page.waitForTimeout(1500)

const dump = await page.evaluate(() => {
  const ids = ['pnl_file_upload', 'pnl_file_upload2', 'tr_fileUpload_ifr', 'tr_fileUpload_ilark',
    'td_fileUpload_ilark_txt1', 'td_fileUpload_ilark_txt2', 'img_go_upload1', 'img_go_upload2']
  const els = {}
  for (const id of ids) { const e = document.getElementById(id); els[id] = e ? e.outerHTML.replace(/\s+/g, ' ').slice(0, 900) : null }
  // upload 행 전체(라벨 포함) 캡처: pnl_file_upload 의 조상 TR/TABLE
  let uploadTable = null
  const p = document.getElementById('pnl_file_upload')
  if (p) { let t = p.closest('table'); uploadTable = t ? t.outerHTML.replace(/\s+/g, ' ').slice(0, 4000) : null }
  // 전 페이지 박/위치/단면/작업방법 가이드(숨김 포함)
  const guide = Array.from(new Set(Array.from(document.querySelectorAll('*'))
    .filter((e) => e.children.length === 0 && /박인쇄|박파일|위치보기|단면|양면|작업방법|별색판|K100|M100|동판|목형|에폭시|형압/.test(e.textContent || ''))
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.length > 2 && t.length < 400))).slice(0, 60)
  // 업로드 관련 onclick 함수명
  const onclicks = Array.from(document.querySelectorAll('[onclick]'))
    .map((e) => ({ id: e.id, oc: e.getAttribute('onclick').slice(0, 120) }))
    .filter((x) => /upload|file|ilark|ifr/i.test(x.oc + x.id)).slice(0, 25)
  return { els, uploadTable, guide, onclicks }
})

fs.mkdirSync('artifacts/omo3581', { recursive: true })
fs.writeFileSync(`artifacts/omo3581/upload-slot2-${CODE}.json`, JSON.stringify(dump, null, 2))
console.log('=== els ==='); for (const [k, v] of Object.entries(dump.els)) console.log(k, '=>', v ? v.slice(0, 260) : 'null')
console.log('\n=== uploadTable (1200) ===\n', (dump.uploadTable || 'null').slice(0, 1200))
console.log('\n=== guide(' + dump.guide.length + ') ===\n', dump.guide.join('\n'))
console.log('\n=== onclicks ===\n', JSON.stringify(dump.onclicks))
await browser.close()
