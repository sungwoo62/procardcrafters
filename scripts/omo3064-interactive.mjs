/**
 * OMO-3064 — 인터랙티브 size-키 가격취득 확정 + 토너(COD) 견적경로.
 * paper_size 를 바꿔가며(onchange=chgPaperSize 트리거) 고정수량에서 product1.price_unit2
 * (per-unit 인쇄단가)를 읽어 size별로 실제 갈라지는지 확인. COD 토너도 동일 시도.
 * 실행: node scripts/omo3064-interactive.mjs
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
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

// 한 select 의 onchange 핸들러를 실제로 트리거하며 값 설정
async function setSelect(name, value) {
  return page.evaluate(({ name, value }) => {
    const el = document.querySelector(`select[name="${name}"]`)
    if (!el) return false
    if (!Array.from(el.options).some(o => o.value === value)) return false
    el.value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, { name, value })
}
async function readUnit() {
  return page.evaluate(() => {
    const p = window.product1 || {}
    const num = v => { const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) && n >= 1 ? n : null }
    return { price_unit1: num(p.price_unit1), price_unit2: num(p.price_unit2), PLATE2: num(p.PLATE_UNIT2_PRICE) }
  })
}

async function run(code, sizes, qty) {
  await page.goto(`${BASE}/goods/goods_view/${code}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  // 수량 고정 (order_count + paper_qty 둘 다 시도)
  await setSelect('order_count', String(qty))
  await page.evaluate(() => { try { window.product1.changeOrderCount && window.product1.changeOrderCount() } catch {} })
  const rows = []
  for (const sz of sizes) {
    const ok = await setSelect('paper_size', sz)
    await page.evaluate(() => { try { window.product1.calcuEstimate && window.product1.calcuEstimate() } catch {} })
    await page.waitForTimeout(700)
    const u = ok ? await readUnit() : null
    rows.push({ size: sz, set: ok, unit: u })
    console.log(`  ${code} size=${sz.padEnd(7)} qty=${qty} → ${u ? `unit2=${u.price_unit2} unit1=${u.price_unit1} plate2=${u.PLATE2}` : (ok ? 'no-price' : 'size-absent')}`)
  }
  const distinct = new Set(rows.map(r => r.unit?.price_unit2).filter(Boolean))
  console.log(`  → 서로 다른 unit2 값 수: ${distinct.size} ${distinct.size > 1 ? '✅ size별 가격분기 확인' : '⚠️ 단일값'}`)
  return rows
}

const report = {}
console.log('=== posters 옵셋 CPR2000 (A1~B4) ===')
report.CPR2000 = await run('CPR2000', ['A0100', 'A0200', 'A0300', 'B0200', 'B0300', 'B0400'], 1000)

console.log('\n=== posters 디지털 CDP4000 ===')
// 디지털 size 값은 다를 수 있으니 먼저 발견
const cdpSizes = await (async () => {
  await page.goto(`${BASE}/goods/goods_view/CDP4000`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)
  return page.evaluate(() => {
    const el = document.querySelector('select[name="paper_size"]')
    return el ? Array.from(el.options).map(o => o.value).filter(Boolean).slice(0, 8) : []
  })
})()
console.log(`  CDP4000 paper_size 값: ${cdpSizes.join(',') || '(paper_size 없음)'}`)
report.CDP4000 = cdpSizes.length ? await run('CDP4000', cdpSizes, 100) : { note: 'paper_size 없음' }

console.log('\n=== 토너 COD1000 / COD1100 인터랙티브 견적 ===')
for (const code of ['COD1000', 'COD1100']) {
  await page.goto(`${BASE}/goods/goods_view/${code}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('select')).filter(s => s.offsetParent !== null && s.options.length > 1).map(s => `${s.name}(${s.options.length})`)
    const hasP1 = !!(window.product1 && typeof window.product1 === 'object')
    return { sels, hasP1 }
  })
  console.log(`  ${code}: product1=${info.hasP1} selects=[${info.sels.join(', ')}]`)
  // order_count 설정 후 calcuEstimate → price_unit2
  await setSelect('order_count', '1000').catch(() => {})
  await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate && window.product1.calcuEstimate() } catch {} })
  await page.waitForTimeout(800)
  const u = await readUnit().catch(() => null)
  console.log(`  ${code} → ${u ? `unit2=${u.price_unit2} unit1=${u.price_unit1} plate2=${u.PLATE2}` : 'no-price'} ${u && u.price_unit2 ? '✅ 인터랙티브 가격 취득' : '⛔'}`)
  report[code] = { ...info, unit: u }
}

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo3064', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo3064/interactive.json', JSON.stringify(report, null, 2))
console.log('\n저장: scripts/test-artifacts/omo3064/interactive.json')
