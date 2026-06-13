/**
 * OMO-3068 보강 — false-negative 배제. 토너 COD1000 에서 두 번째 수량드라이버
 * paper_qty_select 까지 sweep 하고, 모든 옵션변경에서 가격 재계산 AJAX 가 1건이라도
 * 발화하는지 가로채기. (qtyguard 가 order_count 만 봤기에, 매수 기반 드라이버 확인.)
 * 실행: node scripts/omo3068-toner-ajax.mjs
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
const ajaxLog = []
page.on('request', r => { const u = r.url(); if (/json_data|estimate|price|calcu|count|qty|amount/i.test(u) && r.method() === 'POST') ajaxLog.push({ url: u.replace(BASE, ''), post: (r.postData() || '').slice(0, 160) }) })

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

await page.goto(`${BASE}/goods/goods_view/COD1000`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

async function opts(name) {
  return page.evaluate(n => { const el = document.querySelector(`select[name="${n}"]`); return el ? Array.from(el.options).map(o => o.value).filter(Boolean) : [] }, name)
}
async function unit2() { return page.evaluate(() => { const p = window.product1 || {}; const n = parseInt(String(p.price_unit2).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null }) }

const pq = await opts('paper_qty_select')
const oc = await opts('order_count')
console.log(`paper_qty_select(${pq.length}) 샘플=[${pq.slice(0, 5).join(',')} … ${pq.slice(-3).join(',')}]`)
console.log(`order_count(${oc.length}) 샘플=[${oc.slice(0, 5).join(',')} … ${oc.slice(-3).join(',')}]`)

const rows = []
// paper_qty_select sweep (앞/중간/뒤 5개)
const idx = [0, Math.floor(pq.length / 4), Math.floor(pq.length / 2), Math.floor((3 * pq.length) / 4), pq.length - 1]
const pick = [...new Set(idx.map(i => pq[i]).filter(Boolean))]
for (const v of pick) {
  ajaxLog.length = 0
  await page.selectOption('select[name="paper_qty_select"]', v).catch(() => {})
  await page.evaluate(() => { const el = document.querySelector('select[name="paper_qty_select"]'); el && el.dispatchEvent(new Event('change', { bubbles: true })) })
  await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate && window.product1.calcuEstimate() } catch {} })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  const u = await unit2()
  rows.push({ driver: 'paper_qty_select', v, unit2: u, ajax: ajaxLog.length })
  console.log(`  paper_qty_select=${String(v).padEnd(8)} → unit2=${u} | priceAJAX=${ajaxLog.length} ${ajaxLog.map(a => a.url).join(',')}`)
}
const distinct = new Set(rows.map(r => r.unit2).filter(Boolean))
const totalAjax = rows.reduce((s, r) => s + r.ajax, 0)
console.log(`\npaper_qty_select 분기: ${distinct.size}개 distinct | 누적 가격AJAX: ${totalAjax}`)
console.log(distinct.size > 1 ? '✅ 매수→price 갈라짐 (이전 결론 정정 필요)' : '⛔ 매수 무관 단일값 — 인터랙티브 경로로 토너 qty 견적 불가 확정')

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo3068', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo3068/toner-ajax.json', JSON.stringify({ pq_count: pq.length, oc_count: oc.length, rows, distinct: distinct.size, totalAjax }, null, 2))
