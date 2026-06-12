/** OMO-3022: 실패 5종 진단. READ-ONLY. */
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'

async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
  await page.waitForTimeout(1500)
}

const CASES: { type: string; cat: string }[] = [
  { type: 'coating', cat: 'CDP3000' },
  { type: 'partial_coating', cat: 'CPR5000' },
  { type: 'cutting', cat: 'CST5000' },
  { type: 'bonding', cat: 'CST5000' },
  { type: 'laminex', cat: 'CST5000' },
]

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  await login(page)
  for (const c of CASES) {
    await page.goto(`${BASE}/goods/goods_view/${c.cat}/1`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(700)
    // 용지+수량
    await page.evaluate(() => {
      for (const f of ['paper_code', 'cover_paper_code']) { const s = document.querySelector(`select[name="${f}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } }
    })
    await page.waitForTimeout(900)
    await page.evaluate(() => { for (const n of ['paper_qty', 'paper_qty_select', 'bundle_qty']) { const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
    await page.waitForTimeout(500)
    const diag = await page.evaluate((t: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const chk = document.getElementById(`chk_is_${t}`) as HTMLInputElement | null
      const out: Record<string, unknown> = { chkExists: !!chk, chkType: chk?.type, hasOnclick: !!chk?.getAttribute('onclick'), onclick: chk?.getAttribute('onclick') }
      // 클릭 시도(사이트 핸들러 그대로)
      if (chk) { chk.click() }
      out.afterClickChecked = chk?.checked
      // 관련 전역함수 존재
      out.fns = ['setIsPostpress', 'calcuEstimate', `chg${t}`, `set${t}`, `calcu${t}`, `pp${t}`].filter((f) => typeof w[f] === 'function')
      out.product1fns = w.product1 ? Object.getOwnPropertyNames(w.product1).filter((k) => new RegExp(t, 'i').test(k) && typeof w.product1[k] === 'function') : []
      // 패널 내 select/input 현재값
      const pnl = document.getElementById(`pnl_${t}`)
      const fields: Record<string, string> = {}
      if (pnl) for (const e of Array.from(pnl.querySelectorAll('select[name],input[name]'))) { const el = e as HTMLInputElement; fields[el.name] = el.value }
      out.panelFields = fields
      out.amt = (document.querySelector(`[name="${t}_amt"]`) as HTMLInputElement | null)?.value
      return out
    }, c.type)
    console.log(`\n=== ${c.type}@${c.cat} ===`)
    console.log(JSON.stringify(diag, null, 1))
  }
  await browser.close()
}
main()
