import * as fs from 'fs'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo2961'
async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const r: Record<string, unknown> = {}
  try {
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
    await page.waitForTimeout(2000)
    await page.goto(`${BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 30000 })
    // 핵심 옵션 select 4종 직접 확인 + populate
    const core = ['paper_code', 'paper_size', 'paper_qty', 'print_color_type', 'order_count', 'f_design_type', 'b_design_type', 'f_design_edit', 'b_design_edit']
    const read = async (n: string) => page.evaluate((nm: string) => {
      const el = document.querySelector(`select[name="${nm}"]`) as HTMLSelectElement | null
      if (!el) { const inp = document.querySelector(`[name="${nm}"]`) as HTMLInputElement | null; return inp ? { type: inp.tagName, value: inp.value } : 'ABSENT' }
      return { type: 'SELECT', current: el.value, optionCount: Array.from(el.options).filter(o => o.value).length, sample: Array.from(el.options).filter(o => o.value).slice(0, 5).map(o => `${o.value}=${(o.textContent || '').trim()}`) }
    }, n)
    const before: Record<string, unknown> = {}
    for (const n of core) before[n] = await read(n)
    // 용지/사이즈/수량 선택해 populate 확인
    for (const f of ['paper_code', 'paper_size', 'print_color_type']) {
      const sel = await page.$(`select[name="${f}"]`)
      if (sel) { await sel.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find(x => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(700) }
    }
    await page.waitForTimeout(800)
    const after: Record<string, unknown> = {}
    for (const n of core) after[n] = await read(n)
    r.before = before; r.after = after
  } catch (e) { r.error = String(e) } finally {
    fs.writeFileSync(`${OUT}/core2.json`, JSON.stringify(r, null, 2)); await browser.close()
  }
  console.log('done')
}
main()
