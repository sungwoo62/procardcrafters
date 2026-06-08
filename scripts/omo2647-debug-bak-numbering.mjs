// OMO-2647: 박/형압/넘버링 recalc 실패 원인 디버그 (로그인 라이브).
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1200 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
await page.goto(`${BASE}/goods/goods_view/CNC1000/GNC1001`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

const bodies = await page.evaluate(() => {
  const d = (f) => { try { return typeof f === 'function' ? f.toString() : String(f) } catch { return 'ERR' } }
  return {
    ppBak: d(window.product1?.ppBak),
    setPPBakAmtSum: d(window.product1?.setPPBakAmtSum),
    ppNumbering: d(window.product1?.ppNumbering),
    chgNumberingType: d(window.chgNumberingType),
    chgBakType: d(window.chgBakType),
    setIsPostpress: d(window.setIsPostpress),
  }
})
fs.mkdirSync('scripts/test-artifacts/omo2647', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo2647/bodies2.json', JSON.stringify(bodies, null, 2))

// 박: chkPostPress('1','bak') 경유 활성화 후 chgBakType('1') 호출 (페이지 네이티브 경로) — 에러 캡처
const bakTest = await page.evaluate(() => {
  const log = []
  const setF = (n, v) => { const e = document.querySelector(`select[name="${n}"]`); if (e && Array.from(e.options).some(o=>o.value===v)) { e.value = v; return true } return false }
  setF('bak_section_1', 'BKS10'); setF('bak_side_1', 'BKD10'); setF('bak_type_1', 'BKT02'); setF('bak_compare_1', 'BAC10')
  try { window.chkPostPress('1', 'bak'); log.push('chkPostPress ok') } catch (e) { log.push('chkPostPress ERR: ' + e.message) }
  try { window.chgBakSection('1'); log.push('chgBakSection ok') } catch (e) { log.push('chgBakSection ERR: ' + e.message) }
  try { window.chgBakType('1'); log.push('chgBakType ok') } catch (e) { log.push('chgBakType ERR: ' + e.message) }
  try { window.product1.ppBak(); log.push('ppBak ok') } catch (e) { log.push('ppBak ERR: ' + e.message) }
  return { log, bak_amt: document.querySelector('#bak_amt')?.value, chk: document.querySelector('#chk_is_bak')?.checked, pay: document.querySelector('#pay_amt')?.value, dongpanOpts: Array.from(document.querySelector('select[name="bak_exist_dongpan_1"]')?.options||[]).map(o=>o.value) }
})
console.log('=== BAK (native path) ==='); console.log(JSON.stringify(bakTest, null, 1))

// 넘버링: chkPostPress('1','numbering') → chgNumberingType() 로 numbering_kind populate → recalc
await page.goto(`${BASE}/goods/goods_view/CNC1000/GNC1001`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)
const numTest = await page.evaluate(() => {
  const log = []
  const setF = (n, v) => { const e = document.querySelector(`select[name="${n}"]`); if (e && Array.from(e.options).some(o=>o.value===v)) { e.value = v; e.dispatchEvent(new Event('change',{bubbles:true})); return 'SET' } return e ? 'NO_OPT('+Array.from(e.options).map(o=>o.value).join('|')+')' : 'ABSENT' }
  try { window.chkPostPress('1', 'numbering'); log.push('chkPostPress ok') } catch (e) { log.push('chkPostPress ERR: ' + e.message) }
  const t = setF('numbering_type', 'NBT10')
  try { window.chgNumberingType(); log.push('chgNumberingType ok') } catch (e) { log.push('chgNumberingType ERR: ' + e.message) }
  const kindOpts = Array.from(document.querySelector('select[name="numbering_kind"]')?.options||[]).map(o=>`${o.value}=${o.text.trim().slice(0,14)}`)
  const k = setF('numbering_kind', kindOpts[0]?.split('=')[0] || 'NBN11')
  try { window.product1.ppNumbering(); log.push('ppNumbering ok') } catch (e) { log.push('ppNumbering ERR: ' + e.message) }
  return { log, typeSet: t, kindOpts, kindSet: k, numbering_amt: document.querySelector('#numbering_amt')?.value, pay: document.querySelector('#pay_amt')?.value }
})
console.log('=== NUMBERING (native path) ==='); console.log(JSON.stringify(numTest, null, 1))

await browser.close()
