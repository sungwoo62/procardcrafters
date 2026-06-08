import { chromium } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
const codes = process.argv.slice(2)
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale:'ko-KR', viewport:{width:1280,height:900} })
const page = await ctx.newPage()
page.on('dialog', d=>d.accept().catch(()=>{}))
const out = {}
for (const code of codes) {
  try {
    await page.goto(`${BASE}/goods/goods_view/${code}/1`, { waitUntil:'networkidle', timeout:45000 })
    await page.waitForTimeout(3500)
    const sels = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('select[name]')).map(sel => ({
        name: sel.getAttribute('name'),
        count: Array.from(sel.options).filter(o=>o.value!=='').length,
        sample: Array.from(sel.options).filter(o=>o.value!=='').slice(0,3).map(o=>`${o.value}:${(o.textContent||'').replace(/\s+/g,' ').trim()}`)
      }))
    })
    out[code] = sels
    console.error(`[${code}] ${sels.map(s=>`${s.name}(${s.count})`).join(' ')}`)
  } catch(e){ out[code]={error:e.message}; console.error(`[${code}] ERR ${e.message}`) }
}
await browser.close()
console.log(JSON.stringify(out,null,2))
