#!/usr/bin/env node
// OMO-3452: printcity.co.kr 실제 명함 카탈로그 ground-truth 확인(읽기전용).
// 보드 지적: census가 site-scope 없는 product?categoryName1st=명함(공용 SaaS 전역)으로 크롤 →
//   일반지/통합/수입지/특가/VIP 명함이 printcity 스토어프론트에 없을 수 있음.
// 본 프로브는 printcity SPA를 렌더하며 price-api.dtp21.com 호출을 가로채 siteId·실제 제품목록을 캡처.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const apiHits = []
const productNames = new Set()
let siteId = null

const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'ko-KR' })
const page = await ctx.newPage()

page.on('response', async (res) => {
  const url = res.url()
  if (!/price-api\.dtp21\.com/.test(url)) return
  const m = url.match(/productbysite\/([a-f0-9]{8,})/i)
  if (m) siteId = m[1]
  let body = null
  try { body = await res.json() } catch { /* non-json */ }
  apiHits.push({ url: url.replace('https://price-api.dtp21.com/v2/', ''), status: res.status() })
  // 제품명 수집
  const rows = body?.data || (Array.isArray(body) ? body : null)
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const n = r?.productNameKO || r?.nameKO || r?.productName
      if (n) productNames.add(n)
    }
  }
})

async function visit(u) {
  try {
    await page.goto(u, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(1500)
  } catch (e) { console.log('  visit fail', u, String(e).slice(0, 80)) }
}

console.log('1) 홈')
await visit('https://www.printcity.co.kr/')
// 명함 카테고리로 진입 시도(여러 후보 경로)
const candidates = [
  'https://www.printcity.co.kr/product/category/명함',
  'https://www.printcity.co.kr/product/list',
  'https://www.printcity.co.kr/products',
]
// 홈에서 '명함' 링크 클릭 시도
try {
  const link = page.locator('a:has-text("명함")').first()
  if (await link.count()) {
    console.log('2) 명함 링크 클릭')
    await link.click({ timeout: 8000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
  }
} catch (e) { console.log('  명함 클릭 실패', String(e).slice(0, 80)) }

for (const c of candidates) {
  if (productNames.size > 3) break
  console.log('3) 후보', c)
  await visit(c)
}

console.log('\n=== siteId:', siteId)
console.log('=== price-api 호출(상위 25) ===')
for (const h of apiHits.slice(0, 25)) console.log(' ', h.status, h.url.slice(0, 90))
console.log('\n=== 캡처된 제품명(', productNames.size, ') ===')
for (const n of productNames) console.log('  ·', n)

writeFileSync(new URL('./test-artifacts/omo3452-printcity-site-probe.json', import.meta.url),
  JSON.stringify({ siteId, apiHits, productNames: [...productNames] }, null, 2))
await browser.close()
