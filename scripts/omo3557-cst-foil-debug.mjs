// OMO-3557 진단: CST1000 스티커 박(bak) 이 왜 amt=0 인지 폼 구조·글로벌 함수 덤프.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
const code = process.argv[2] || 'CST1000'
const goods = 'G' + code.slice(1, -1) + '1'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ locale: 'ko-KR', viewport: { width: 1400, height: 1200 } })).newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
await page.goto(`${BASE}/goods/goods_view/${code}/${goods}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

const dump = await page.evaluate(() => {
  const w = window
  const out = {}
  // 1) bak 관련 글로벌 함수
  out.globals = Object.keys(w).filter((k) => /bak|postpress|calcu|ppBak|dongpan|setPP/i.test(k) && typeof w[k] === 'function').slice(0, 60)
  // 2) bak_* 필드 전부(name → value/options)
  out.bakFields = {}
  for (const el of document.querySelectorAll('[name^="bak_"], [name^="chk_is_bak"], [id^="bak_"]')) {
    const n = el.name || el.id
    out.bakFields[n] = { tag: el.tagName, value: el.value, opts: el.tagName === 'SELECT' ? Array.from(el.options).map((o) => o.value) : undefined }
  }
  // 3) chk_is_bak + panel 존재
  out.chk = !!document.getElementById('chk_is_bak')
  out.pnl = !!document.getElementById('pnl_bak')
  // 4) ppBak 객체 메서드
  if (w.ppBak) out.ppBakMethods = Object.keys(w.ppBak).filter((k) => typeof w.ppBak[k] === 'function')
  // 5) paper_qty selects(복수?)
  out.paperQtySelects = Array.from(document.querySelectorAll('select[name="paper_qty"], select[name="bundle_qty"]')).map((s) => ({ name: s.name, visible: s.offsetParent !== null, opts: Array.from(s.options).map((o) => o.value) }))
  // 6) 모든 size/사이즈 관련 select
  out.sizeSelects = Array.from(document.querySelectorAll('select')).filter((s) => /size|kind|paper|material|coat|cut/i.test(s.name)).map((s) => ({ name: s.name, value: s.value, opts: Array.from(s.options).map((o) => o.value).slice(0, 10) }))
  return out
})
console.log(JSON.stringify(dump, null, 2))

// 활성화 시도 + setIsPostpress 후 bak_amt / pay 변화 추적
const trace = await page.evaluate(() => {
  const w = window, log = []
  const pay0 = parseInt(($('pay_amt')?.value) || '0', 10)
  const chk = document.getElementById('chk_is_bak'); if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
  try { w.$j && w.$j('#pnl_bak').show() } catch { /* */ }
  // 모든 bak select 첫유효
  for (const sel of document.querySelectorAll('select[name^="bak_"]')) { const f = Array.from(sel.options).map((o) => o.value).find((o) => o && o !== '0'); if (f && (!sel.value || sel.value === '0')) { sel.value = f; sel.dispatchEvent(new Event('change', { bubbles: true })); log.push(`${sel.name}=${f}`) } }
  // x/y size inputs
  for (const inp of document.querySelectorAll('input[name^="bak_x_size"], input[name^="bak_y_size"]')) { inp.value = inp.name.includes('x_') ? '50' : '30'; inp.dispatchEvent(new Event('change', { bubbles: true })); log.push(`${inp.name}=set`) }
  try { w.setIsPostpress && w.setIsPostpress('bak'); log.push('setIsPostpress ok') } catch (e) { log.push('setIsPostpress ERR ' + e.message) }
  if (w.ppBak) { for (const m of ['setBakAmt', 'calcuBakPrice', 'setPPBakAmtSum', 'getBakAmt']) { try { if (typeof w.ppBak[m] === 'function') { const r = w.ppBak[m]('1'); log.push(`ppBak.${m}→${r}`) } } catch (e) { log.push(`ppBak.${m} ERR ${e.message}`) } } }
  try { w.product1 && w.product1.calcuEstimate(); log.push('calcuEstimate ok') } catch (e) { log.push('calcuEstimate ERR ' + e.message) }
  const bak_amt = parseInt(($('bak_amt')?.value) || '0', 10)
  const pay1 = parseInt(($('pay_amt')?.value) || '0', 10)
  const pp = parseInt(($('postpress_amt')?.value) || '0', 10)
  return { log, bak_amt, pay0, pay1, pp, payDelta: pay1 - pay0 }
})
console.log('\n=== TRACE ===')
console.log(JSON.stringify(trace, null, 2))
await browser.close()
