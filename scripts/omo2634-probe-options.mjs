/**
 * OMO-2634: 성원 goods_view 라이브 렌더링 후 4개 옵션 select 추출
 * paper_code / print_color_type / paper_size / paper_qty
 * 실행: node scripts/omo2634-probe-options.mjs CODE [CODE...]
 */
import { chromium } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const WANTED = ['paper_code', 'print_color_type', 'paper_size', 'paper_qty']
const codes = process.argv.slice(2)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR', viewport: { width: 1280, height: 900 },
})
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(()=>{}))

const out = {}
for (const code of codes) {
  try {
    await page.goto(`${BASE}/goods/goods_view/${code}/1`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(3500)
    const data = await page.evaluate((wanted) => {
      const res = {}
      for (const name of wanted) {
        const sel = document.querySelector(`select[name="${name}"]`)
        if (!sel) { res[name] = null; continue }
        res[name] = Array.from(sel.options)
          .filter(o => o.value !== '')
          .map(o => ({ value: o.value, text: (o.textContent||'').replace(/\s+/g,' ').trim() }))
      }
      return res
    }, WANTED)
    out[code] = data
    const summ = WANTED.map(w => `${w}=${data[w]===null?'∅':data[w].length}`).join(' ')
    console.error(`[${code}] ${summ}`)
  } catch (e) {
    out[code] = { error: e.message }
    console.error(`[${code}] ERR ${e.message}`)
  }
}
await browser.close()
console.log(JSON.stringify(out, null, 2))
