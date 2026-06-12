/** OMO-3022 진단2: 비활성 여부 + 면적 후가공 recalc 트리거 + coating 가용 카테고리. READ-ONLY. */
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
  await page.waitForTimeout(1500)
}
async function prep(page: Page, cat: string) {
  await page.goto(`${BASE}/goods/goods_view/${cat}/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(700)
  await page.evaluate(() => { for (const f of ['paper_code', 'cover_paper_code']) { const s = document.querySelector(`select[name="${f}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
  await page.waitForTimeout(900)
  await page.evaluate(() => { for (const n of ['paper_qty', 'paper_qty_select', 'bundle_qty']) { const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
  await page.waitForTimeout(500)
}

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  await login(page)

  // A) coating chk disabled 여부 — 여러 카테고리
  for (const cat of ['CDP3000', 'CCD1000', 'CST1000', 'CPR5000']) {
    await prep(page, cat)
    const r = await page.evaluate(() => {
      const c = document.getElementById('chk_is_coating') as HTMLInputElement | null
      const pc = document.getElementById('chk_is_partial_coating') as HTMLInputElement | null
      const probe = (chk: HTMLInputElement | null) => { if (!chk) return null; const before = { disabled: chk.disabled, checked: chk.checked }; chk.click(); return { ...before, afterClickChecked: chk.checked } }
      return { coating: probe(c), partial: probe(pc) }
    })
    console.log(`coating-disabled@${cat}:`, JSON.stringify(r))
  }

  // B) 면적 후가공 recalc: 사이즈 입력 후 input/keyup/blur + setIsPostpress + 전역 calc 시도
  for (const [cat, type, sizeFields] of [
    ['CST5000', 'cutting', ['add_cut_x_size_1', 'add_cut_y_size_1', 'add_parts_num_1']],
    ['CST5000', 'bonding', ['bonding_x_size', 'bonding_y_size', 'bonding_num']],
    ['CPR5000', 'partial_coating', ['partial_coating_x_size', 'partial_coating_y_size']],
  ] as [string, string, string[]][]) {
    await prep(page, cat)
    const r = await page.evaluate((p: { type: string; sizeFields: string[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const chk = document.getElementById(`chk_is_${p.type}`) as HTMLInputElement | null
      if (chk && !chk.checked) chk.click()
      const set = (n: string, v: string) => { const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null; if (!el) return; el.value = v; for (const ev of ['input', 'keyup', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true })) }
      for (const f of p.sizeFields) set(f, f.includes('num') ? '1' : '50')
      // 가능한 모든 recalc
      const fns = Object.getOwnPropertyNames(w).filter((k) => new RegExp(p.type, 'i').test(k) && typeof w[k] === 'function')
      for (const f of fns) { try { w[f]() } catch { /* */ } }
      try { w.setIsPostpress && w.setIsPostpress(p.type) } catch { /* */ }
      try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
      const amt = (document.querySelector(`[name="${p.type}_amt"]`) as HTMLInputElement | null)?.value
      return { globalFns: fns, amt }
    }, { type, sizeFields })
    console.log(`area-recalc ${type}@${cat}:`, JSON.stringify(r))
  }
  await browser.close()
}
main()
