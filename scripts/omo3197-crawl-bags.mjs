/**
 * OMO-3197: 성원 쇼핑백 4종 옵션 재크롤링
 *
 * 성원 쇼핑백 페이지 상단의 4개 버튼(쇼핑백/종이끈/소량/끈없는)은 각각
 * 별도 category_code 이며, 클릭 시 옵션 select(용지/인쇄/사이즈/수량)가 바뀐다.
 *
 *   CPK2000  리본&브레이드 쇼핑백 (일반 쇼핑백 버튼)
 *   CPK4000  종이끈 쇼핑백        (현재 보던 페이지)
 *   CPK5000  소량 쇼핑백          (50/100 소량 전용)
 *   CPK3000  끈없는 쇼핑백
 *
 * 기존 맵핑은 2개 코드(CPK4000/CPK2000)만 사용하고 DB 옵션 수량이
 * 100/200/500 으로 성원 실값(200~50000, 소량 50/100)과 불일치했다.
 * 이 스크립트가 goods_view 라이브 렌더 후 4개 select 옵션 + size 치수를
 * 추출해 scripts/omo3197-bag-options.json 으로 저장한다.
 *
 * 실행: node scripts/omo3197-crawl-bags.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'https://www.swadpia.co.kr'
const CODES = {
  CPK2000: '리본&브레이드 쇼핑백',
  CPK4000: '종이끈 쇼핑백',
  CPK5000: '소량 쇼핑백',
  CPK3000: '끈없는 쇼핑백',
}
const SELECTS = ['paper_code', 'print_color_type', 'paper_size', 'paper_qty']

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  viewport: { width: 1280, height: 900 },
})
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))

const out = {}
for (const [code, label] of Object.entries(CODES)) {
  try {
    await page.goto(`${BASE}/goods/goods_view/${code}/1`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(3500)
    const selects = await page.evaluate((wanted) => {
      const res = {}
      for (const name of wanted) {
        const sel = document.querySelector(`select[name="${name}"]`)
        res[name] = sel
          ? Array.from(sel.options)
              .filter((o) => o.value !== '')
              .map((o) => ({ value: o.value, text: (o.textContent || '').replace(/\s+/g, ' ').trim() }))
          : null
      }
      return res
    }, SELECTS)
    out[code] = { label, ...selects }
    const summ = SELECTS.map((s) => `${s}=${selects[s] === null ? '∅' : selects[s].length}`).join(' ')
    console.error(`[${code}] ${label} — ${summ}`)
  } catch (e) {
    out[code] = { label, error: e.message }
    console.error(`[${code}] ${label} — ERR ${e.message}`)
  }
}
await browser.close()

const dest = new URL('./omo3197-bag-options.json', import.meta.url).pathname
writeFileSync(dest, JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), codes: out }, null, 2))
console.error(`\n저장: ${dest}`)
