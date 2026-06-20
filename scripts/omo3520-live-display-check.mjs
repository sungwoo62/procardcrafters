// OMO-3520: 라이브 제품페이지에서 수량별 "고객 표시가" 직접 확인 (READ-ONLY, 공개 페이지).
import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const page = await (await b.newContext({ locale: 'en-US', viewport: { width: 1280, height: 1600 } })).newPage()
await page.goto('https://procardcrafters.com/products/business-cards', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(3000)
// 가격 표시 요소 후보 + 수량 컨트롤 덤프
const dump = await page.evaluate(() => {
  const prices = [...document.querySelectorAll('*')]
    .filter(el => el.children.length === 0 && /\$\s?\d/.test(el.textContent || ''))
    .map(el => (el.textContent || '').trim()).filter(t => t.length < 40).slice(0, 25)
  const qtyEls = [...document.querySelectorAll('button, [role=button], option, label, div')]
    .filter(el => /\b(100|200|500|1,?000|2,?000)\b\s*(cards|pcs|매)?/i.test((el.textContent || '').trim()) && (el.textContent || '').length < 60)
    .map(el => ({ tag: el.tagName, t: (el.textContent || '').trim().slice(0, 40) })).slice(0, 20)
  return { prices: [...new Set(prices)], qtyEls }
})
console.log(JSON.stringify(dump, null, 1))
await page.screenshot({ path: 'scripts/test-artifacts/omo3520/live-product-page.png', fullPage: false }).catch(()=>{})
await b.close()
