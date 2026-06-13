/**
 * OMO-3064 — paper_size 변경 시 size별 가격이 갈라지는지, AJAX 정착 대기 포함 최종 확정.
 * 네이티브 select 를 selectOption 으로 바꾸고(onchange=chgPaperSize 자연발화),
 * networkidle + 충분 대기 후 product1.price_unit2 재독. 두 극단 size(A1 vs B4) 대조.
 * 실행: node scripts/omo3064-sizewait.mjs
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1400 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))
// json_data 류 AJAX 가 size 파라미터를 싣는지 가로채기
const ajaxLog = []
page.on('request', r => { const u = r.url(); if (/json_data|estimate|price|size/i.test(u) && r.method() === 'POST') ajaxLog.push({ url: u.replace(BASE, ''), post: (r.postData() || '').slice(0, 200) }) })

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

await page.goto(`${BASE}/goods/goods_view/CPR2000`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

async function readUnit() {
  return page.evaluate(() => {
    const p = window.product1 || {}
    const num = v => { const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null }
    return { unit1: num(p.price_unit1), unit2: num(p.price_unit2), plate2: num(p.PLATE_UNIT2_PRICE), save_size: p.save_paper_size }
  })
}

const results = []
for (const sz of ['A0100', 'B0400', 'A0300', 'A0100']) {
  ajaxLog.length = 0
  // 네이티브 변경 → 자연 onchange 발화 (chgPaperSize)
  await page.selectOption('select[name="paper_size"]', sz).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // 명시적 재계산도 한번
  await page.evaluate(() => { try { window.product1.calcuEstimate && window.product1.calcuEstimate() } catch {} })
  await page.waitForTimeout(800)
  const u = await readUnit()
  results.push({ size: sz, unit: u, ajax: [...ajaxLog] })
  console.log(`size=${sz} → unit2=${u.unit2} unit1=${u.unit1} save_size=${u.save_size} | AJAX(${ajaxLog.length}): ${ajaxLog.map(a => a.url).join(',') || 'none'}`)
  if (ajaxLog.length) console.log(`    post[0]: ${ajaxLog[0].post}`)
}
const distinct = new Set(results.map(r => r.unit.unit2))
console.log(`\n서로 다른 unit2: ${distinct.size} → ${distinct.size > 1 ? '✅ size별 가격분기 가능(인터랙티브)' : '⛔ size 무관 단일가격(자동화로는 size-키 라우팅 불가)'}`)
await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo3064', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo3064/sizewait.json', JSON.stringify(results, null, 2))
