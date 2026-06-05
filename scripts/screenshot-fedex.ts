import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const OUT = 'public/fedex-status'

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  const captures: { name: string; url: string; note: string }[] = []
  async function shot(name: string, url: string, note: string, opts: { fullPage?: boolean; waitMs?: number } = {}) {
    console.log(`[shot] ${name} ← ${url}`)
    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 30000 })
      if (opts.waitMs) await page.waitForTimeout(opts.waitMs)
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.fullPage ?? true })
      captures.push({ name: `${name}.png`, url, note })
    } catch (e: any) {
      console.log(`  ! ${e.message?.slice(0, 100)}`)
      try { await page.screenshot({ path: `${OUT}/${name}.png` }) } catch {}
      captures.push({ name: `${name}.png`, url, note: note + ' (오류 가능)' })
    }
  }

  await shot('01-home', '/', '홈 — Pro Card Crafters')
  await shot('02-products', '/products', '제품 카탈로그')
  await shot('03-product-detail', '/products/business-cards', '제품 상세 (BIZ)')
  await shot('04-admin-shipping', '/admin/shipping', '관리자: 권역/요금표 (로그인 필요 — 리다이렉트 캡처)')
  await shot('05-admin-orders', '/admin/orders', '관리자: 주문 목록 (로그인 필요 — 리다이렉트 캡처)')
  await shot('06-fedex-status', '/fedex-status', '/fedex-status 페이지 (이번에 빌드)', { waitMs: 1500 })

  writeFileSync(`${OUT}/captures.json`, JSON.stringify(captures, null, 2))
  await browser.close()
  console.log(`Done. ${captures.length} captures`)
})()
