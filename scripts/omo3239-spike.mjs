/**
 * OMO-3239 스파이크 — 브라우저-구동 결정론 가격 오라클 게이트 검증.
 *
 * 게이트 1: total_price(hidden) == 실제 장바구니 제출가 동치 (cart POST payload 가로채기).
 * 게이트 2: 제품군별 올바른 수량 필드 식별 (어떤 select 가 total_price 를 움직이나).
 * 게이트 3: 디지털(CDP)·토너(COD)에 hidden total_price 경로가 존재/분기하는가.
 *
 * 실주문/장바구니 오염 금지: cart 등록 POST 는 route.abort 로 차단하고 payload 만 독취.
 */
import { chromium } from 'playwright'
import fs from 'fs'; import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3239'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1800 } })
const page = await ctx.newPage(); page.on('dialog', d => d.accept().catch(() => {}))

// --- 로그인 ---
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

const v = name => page.evaluate(n => { const e = document.querySelector(`input[name="${n}"],#${n}`); return e ? e.value : null }, name)
const snap = async () => ({ total: await v('total_price'), paper: await v('paper_price'), plate: await v('plate_price'), print: await v('print_price') })
const settle = async () => { await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500) }

// 페이지의 모든 select 와 옵션 열거
const enumSelects = () => page.evaluate(() => Array.from(document.querySelectorAll('select')).map(s => ({
  name: s.name, id: s.id,
  options: Array.from(s.options).slice(0, 12).map(o => ({ v: o.value, t: (o.textContent || '').trim().slice(0, 30) })),
  optCount: s.options.length, selected: s.value,
})).filter(s => s.name || s.id))

const result = { gate2: {}, gate3: {}, gate1: {} }

// ── 게이트 2: 포스터 CPR2000 — 어느 select 가 total_price 를 움직이나 ──
await page.goto(`${BASE}/goods/goods_view/CPR2000`, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2000)
const posterSelects = await enumSelects()
const base0 = await snap()
const qtyProbe = []
// order_count / paper_qty 후보 각각 2~3 값 변경하며 total 변화 관측
for (const cand of ['order_count', 'paper_qty', 'order_qty', 'goods_qty']) {
  const sel = posterSelects.find(s => s.name === cand)
  if (!sel || sel.optCount < 2) { qtyProbe.push({ field: cand, present: !!sel, note: sel ? 'single-option' : 'absent' }); continue }
  const vals = sel.options.filter(o => o.v).slice(0, 4).map(o => o.v)
  const rows = []
  for (const val of vals) {
    await page.selectOption(`select[name="${cand}"]`, val).catch(() => {})
    await settle(); const s = await snap(); rows.push({ val, total: s.total })
  }
  const distinct = new Set(rows.map(r => r.total)).size
  qtyProbe.push({ field: cand, present: true, options: vals, rows, distinctTotals: distinct, movesTotal: distinct > 1 })
}
result.gate2 = { product: 'CPR2000', baseSnap: base0, selects: posterSelects.map(s => ({ name: s.name, optCount: s.optCount })), qtyProbe }

// ── 게이트 3: 디지털 CDP3000 + 토너 COD1100 — hidden total_price 존재/분기 ──
for (const code of ['CDP3000', 'COD1100']) {
  try {
    await page.goto(`${BASE}/goods/goods_view/${code}`, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2000)
    const hasTotal = await page.evaluate(() => !!document.querySelector('input[name="total_price"],#total_price'))
    const sels = await enumSelects()
    const baseSnap = await snap()
    // size 후보가 있으면 분기 관측
    const sizeSel = sels.find(s => /size/i.test(s.name) && s.optCount > 1)
    const sizeRows = []
    if (sizeSel) {
      for (const o of sizeSel.options.filter(o => o.v).slice(0, 4)) {
        await page.selectOption(`select[name="${sizeSel.name}"]`, o.v).catch(() => {})
        await settle(); const s = await snap(); sizeRows.push({ v: o.v, total: s.total })
      }
    }
    result.gate3[code] = { hasTotalInput: hasTotal, baseSnap, selects: sels.map(s => ({ name: s.name, optCount: s.optCount })), sizeField: sizeSel?.name || null, sizeRows, sizeDistinct: new Set(sizeRows.map(r => r.total)).size }
  } catch (e) { result.gate3[code] = { error: String(e).slice(0, 200) } }
}

// ── 게이트 1: 포스터 add-to-cart payload == hidden total_price ──
// cart 등록 POST 를 가로채 payload 만 독취하고 abort (장바구니 오염 방지)
try {
  await page.goto(`${BASE}/goods/goods_view/CPR2000`, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2000)
  // 명확한 size 선택해 distinctive total 확보
  await page.selectOption('select[name="paper_size"]', 'A0100').catch(() => {})
  await settle()
  const hiddenBefore = await snap()
  let captured = null
  await page.route('**/*', route => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'POST' && /cart|order|regist|goods_action|estimate_goods/i.test(url) && !/json_data/.test(url)) {
      captured = { url, postData: (req.postData() || '').slice(0, 4000) }
      return route.abort()  // 장바구니 등록 차단
    }
    return route.continue()
  })
  // 장바구니 담기 버튼 후보 클릭
  const cartClicked = await page.evaluate(() => {
    const cand = Array.from(document.querySelectorAll('a,button,input[type=button],input[type=submit]'))
      .find(e => /장바구니|담기|cart/i.test((e.textContent || '') + (e.value || '') + (e.id || '') + (e.getAttribute('onclick') || '')))
    if (cand) { cand.click(); return (cand.textContent || cand.value || cand.id).trim().slice(0, 40) }
    // onclick 함수 직접 호출 시도
    if (typeof window.goods_cart === 'function') { try { window.goods_cart() } catch (e) {} return 'goods_cart()' }
    if (typeof window.cart === 'function') { try { window.cart() } catch (e) {} return 'cart()' }
    return null
  })
  await page.waitForTimeout(3000)
  result.gate1 = { hiddenBefore, cartTrigger: cartClicked, capturedPost: captured,
    totalPriceInPayload: captured ? (captured.postData.match(/total_price=([0-9]+)/) || [])[1] || null : null }
} catch (e) { result.gate1 = { error: String(e).slice(0, 300) } }

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(`${OUT}/spike.json`, JSON.stringify(result, null, 2))
console.log('=== GATE 2 (qty field) ===')
for (const q of result.gate2.qtyProbe) console.log(`  ${q.field}: present=${q.present} movesTotal=${q.movesTotal ?? '-'} distinct=${q.distinctTotals ?? '-'}`)
console.log('=== GATE 3 (digital/toner hidden) ===')
for (const [c, g] of Object.entries(result.gate3)) console.log(`  ${c}: hasTotalInput=${g.hasTotalInput} sizeField=${g.sizeField} sizeDistinct=${g.sizeDistinct}`)
console.log('=== GATE 1 (cart equivalence) ===')
console.log(`  hiddenTotal=${result.gate1.hiddenBefore?.total} trigger=${result.gate1.cartTrigger} payloadTotal=${result.gate1.totalPriceInPayload}`)
console.log(`  capturedURL=${result.gate1.capturedPost?.url || 'NONE'}`)
await browser.close()
