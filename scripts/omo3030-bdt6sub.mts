/** OMO-3030: CPR4000 sub-id 1~8 에서 binding_type 기본/옵션 — PUR무선(BDT6) 전용 goodsCode 발굴. READ-ONLY. */
import * as fs from 'fs'
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
  await page.waitForTimeout(1500)
}
async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  await login(page)
  const rows: Record<string, unknown>[] = []
  for (const sub of ['1', '2', '3', '4', '5', '6', '7', '8']) {
    try {
      const resp = await page.goto(`${BASE}/goods/goods_view/CPR4000/${sub}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(600)
      const r = await page.evaluate(() => {
        const title = (document.querySelector('h1,.goods_title,.tit,title') as HTMLElement | null)?.innerText?.slice(0, 60) || document.title.slice(0, 60)
        const s = document.querySelector('select[name="binding_type"]') as HTMLSelectElement | null
        const binding = s ? Array.from(s.options).map((o) => [o.value, o.text]) : null
        const def = s ? s.value : null
        return { title, binding, def, hasForm: !!document.querySelector('select[name="cover_paper_kind"],select[name="binding_type"]') }
      })
      rows.push({ sub, status: resp?.status(), ...r })
      console.log(`/${sub}: status=${resp?.status()} def=${r.def} binding=${JSON.stringify(r.binding ? (r.binding as string[][]).map((b) => b[0]) : null)} title="${r.title}"`)
    } catch (e) { rows.push({ sub, error: String(e) }); console.log(`/${sub}: ERR ${String(e).slice(0, 50)}`) }
  }
  fs.writeFileSync('scripts/test-artifacts/omo3030/bdt6sub.json', JSON.stringify(rows, null, 2))
  await browser.close()
}
main()
