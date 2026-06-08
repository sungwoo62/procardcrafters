// OMO-2647: chkPostPress + product1 메서드 + estimate 계산 체인 본문 추출 (로그인 라이브).
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const CODE = process.argv[2] || 'CNC1000', GOODS = process.argv[3] || 'GNC1001'
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
await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

const out = await page.evaluate(() => {
  const r = {}
  const dump = (fn) => { try { return typeof fn === 'function' ? fn.toString() : String(fn) } catch { return 'ERR' } }
  // 전역 함수
  r.chkPostPress = dump(window.chkPostPress)
  r.chgPaperSize = dump(window.chgPaperSize)
  r.chgSizeType = dump(window.chgSizeType)
  r.chgBakType = dump(window.chgBakType)
  r.chgBakSection = dump(window.chgBakSection)
  r.initCalcuEstimate = dump(window.initCalcuEstimate)
  r.order_price_detail = dump(window.order_price_detail)
  // product1 객체 메서드 목록
  if (window.product1) {
    r.product1_keys = []
    for (const k in window.product1) { try { r.product1_keys.push(`${k}:${typeof window.product1[k]}`) } catch { /* */ } }
    r.product1_ppTagong = dump(window.product1.ppTagong)
    r.product1_calcuEstimate = dump(window.product1.calcuEstimate)
    r.product1_setPPBakAmtSum = dump(window.product1.setPPBakAmtSum)
    r.product1_ppBak = dump(window.product1.ppBak)
    r.product1_getEstimatePrice = dump(window.product1.getEstimatePrice)
  } else { r.product1 = 'ABSENT' }
  // 후가공 체크박스들
  r.checkboxes = Array.from(document.querySelectorAll('input[id^=chk_is_], input[name^=chk_is_]')).map(c => ({ id: c.id, name: c.name, checked: c.checked, type: c.type }))
  // 가격 표시 엘리먼트 현재값
  r.priceEls = Array.from(document.querySelectorAll('.estimate_pay_price, [id*=estimate i], [id*=total_price i], [class*=pay_price i]')).map(e => ({ sel: e.id ? '#'+e.id : '.'+(e.className.split(' ')[0]||''), txt: (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,30) })).slice(0, 15)
  return r
})
await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo2647', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo2647/product1.json', JSON.stringify(out, null, 2))
console.log('product1_keys:', out.product1_keys?.length, '\ncheckboxes:', JSON.stringify(out.checkboxes), '\npriceEls:', JSON.stringify(out.priceEls,null,1))
console.log('\n--- chkPostPress ---\n', (out.chkPostPress||'').slice(0,800))
console.log('\n--- product1.ppTagong ---\n', (out.product1_ppTagong||'').slice(0,700))
console.log('\n--- product1.calcuEstimate ---\n', (out.product1_calcuEstimate||'').slice(0,900))
