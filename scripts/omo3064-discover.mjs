/**
 * OMO-3064 discover — 멀티사이즈 goods_view 의 실제 size 선택자 + 가격 경로 정밀 덤프.
 * size_type(규격/직접입력 토글) 뒤의 진짜 size 매트릭스 select 와 product1 가격필드를 찾는다.
 * 실행: node scripts/omo3064-discover.mjs [CODE]  (기본 CPR2000)
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const CODE = process.argv[2] || 'CPR2000'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1400 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

await page.goto(`${BASE}/goods/goods_view/${CODE}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

// 모든 select 덤프 + product1 가격필드 후보 + calcuEstimate 후 전역 가격객체 키
const dump = await page.evaluate(() => {
  const w = window
  const selects = Array.from(document.querySelectorAll('select')).map(s => ({
    name: s.name, id: s.id, optCount: s.options.length, vis: s.offsetParent !== null,
    onchange: (s.getAttribute('onchange') || '').slice(0, 50),
    opts: Array.from(s.options).slice(0, 8).map(o => `${o.value}=${(o.text || '').trim().slice(0, 14)}`),
  }))
  // product1 데이터 프로퍼티 (가격/사이즈/수량 보관)
  const p1data = {}
  try { for (const k of Object.keys(w.product1)) { const v = w.product1[k]; if (typeof v !== 'function') p1data[k] = (typeof v === 'object' && v) ? `{${Object.keys(v).slice(0, 10).join(',')}}` : v } } catch { /* */ }
  return { selects, p1keys: Object.keys(p1data).slice(0, 60), p1data }
})
fs.mkdirSync('scripts/test-artifacts/omo3064', { recursive: true })
fs.writeFileSync(`scripts/test-artifacts/omo3064/discover-${CODE}.json`, JSON.stringify(dump, null, 2))
console.log(`=== ${CODE} selects (vis only, optCount>1) ===`)
for (const s of dump.selects) if (s.vis && s.optCount > 1) console.log(`  ${s.name.padEnd(20)} (${s.optCount}) oc=${s.onchange}\n      ${s.opts.join(' | ')}`)
console.log(`\n=== product1 data keys ===\n  ${dump.p1keys.join(', ')}`)

// 이제 size 매트릭스 select 추정: print_size / size / norm 키. 첫 후보를 바꿔가며 가격취득 시도.
const sizeCands = dump.selects.filter(s => s.vis && s.optCount > 2 && /size|norm|gyu|print_size|paper_size/i.test(s.name))
console.log(`\n=== size 매트릭스 후보 (optCount>2): ${sizeCands.map(s => s.name + '(' + s.optCount + ')').join(', ') || '없음'} ===`)

if (sizeCands.length) {
  const sc = sizeCands[0]
  for (const opt of sc.opts.slice(0, 4)) {
    const val = opt.split('=')[0]
    const priced = await page.evaluate((p) => {
      const w = window
      const set = (n, v) => { const el = document.querySelector(`[name="${n}"]`); if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) } }
      set(p.name, p.val)
      try { w.product1.changePaperSize && w.product1.changePaperSize() } catch { /* */ }
      try { w.product1.changeOrderCount && w.product1.changeOrderCount() } catch { /* */ }
      try { w.product1.calcuEstimate && w.product1.calcuEstimate() } catch { /* */ }
      const p1 = w.product1 || {}
      const num = v => { const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) && n >= 100 ? n : null }
      const found = {}
      for (const k of Object.keys(p1)) { if (/price|amt|pay|unit|total/i.test(k)) { const n = num(p1[k]); if (n) found[k] = n } }
      return found
    }, { name: sc.name, val })
    await page.waitForTimeout(600)
    console.log(`  size ${val.padEnd(8)} → ${Object.keys(priced).length ? JSON.stringify(priced) : 'none'}`)
  }
}
await browser.close()
