// OMO-3557 진단 2: CST 박 addBak 시퀀스(chgBakSection→Side→Type→Size→ExistDongpan→addBak) 검증.
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

const step = (fn, arg) => page.evaluate(({ fn, arg }) => {
  const w = window
  try { if (typeof w[fn] === 'function') { w[fn](arg); return 'ok' } return 'absent' } catch (e) { return 'ERR ' + e.message }
}, { fn, arg })
const snap = () => page.evaluate(() => ({
  bak_amt: parseInt(($('bak_amt')?.value) || '0', 10),
  bak_amt_1: parseInt(($('bak_amt_1')?.value) || '0', 10),
  pay: parseInt(($('pay_amt')?.value) || '0', 10),
  pp: parseInt(($('postpress_amt')?.value) || '0', 10),
  exist_opts: Array.from(document.querySelector('select[name="bak_exist_dongpan_1"]')?.options || []).map((o) => o.value),
  side: ($('bak_side_1')?.value),
  xs: ($('bak_x_size_1')?.value), ys: ($('bak_y_size_1')?.value),
}))

const log = []
// 활성화
await page.evaluate(() => { const c = document.getElementById('chk_is_bak'); if (c) { c.checked = true; c.dispatchEvent(new Event('click', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })) } try { window.$j && window.$j('#pnl_bak').show() } catch { /* */ } })
await page.waitForTimeout(400)
log.push(['chk', await snap()])
// 1) section
await page.evaluate(() => { const s = document.querySelector('select[name="bak_section_1"]'); if (s) { s.value = s.options[0].value; s.dispatchEvent(new Event('change', { bubbles: true })) } })
log.push(['chgBakSection', await step('chgBakSection', 1), await snap()])
// 2) side — bak_side 는 INPUT. 일반적으로 1(단면). chgBakSide 호출 전 set.
await page.evaluate(() => { const e = document.querySelector('[name="bak_side_1"]'); if (e) { e.value = '1'; e.dispatchEvent(new Event('change', { bubbles: true })) } })
log.push(['chgBakSide', await step('chgBakSide', 1), await snap()])
// 3) type
await page.evaluate(() => { const s = document.querySelector('select[name="bak_type_1"]'); if (s) { s.value = 'BKT02'; s.dispatchEvent(new Event('change', { bubbles: true })) } })
log.push(['chgBakType', await step('chgBakType', 1), await snap()])
// 4) size
await page.evaluate(() => { for (const nm of ['bak_x_size_1', 'bak_y_size_1']) { const e = document.querySelector(`[name="${nm}"]`); if (e) { e.value = nm.includes('x_') ? '50' : '30'; e.dispatchEvent(new Event('change', { bubbles: true })) } } })
log.push(['chgBakSize', await step('chgBakSize', 1), await snap()])
// 5) exist dongpan (신규 동판) — opts populate 후 첫 유효 선택
await page.evaluate(() => { const s = document.querySelector('select[name="bak_exist_dongpan_1"]'); if (s) { const f = Array.from(s.options).map((o) => o.value).find((o) => o && o !== '0'); if (f) { s.value = f; s.dispatchEvent(new Event('change', { bubbles: true })) } } })
log.push(['chgBakExistDongpan', await step('chgBakExistDongpan', 1), await snap()])
await step('chgBakExistDongpanPrice', 1)
// 6) addBak — 레이어 커밋
log.push(['addBak', await step('addBak', 1), await snap()])
await page.waitForTimeout(500)
// 7) recalc
await step('setIsPostpress', 'bak')
await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate() } catch { /* */ } })
await page.waitForTimeout(400)
log.push(['final', await snap()])

console.log(JSON.stringify(log, null, 2))
await browser.close()
