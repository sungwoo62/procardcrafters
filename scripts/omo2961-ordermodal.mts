/**
 * OMO-2961: 바로주문 모달 오픈 후 design_type/order_count 상태 확인. READ-ONLY(업로드/제출 없음).
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2961-ordermodal.mts
 */
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
    for (const f of ['paper_code', 'paper_size', 'print_color_type']) {
      const sel = await page.$(`select[name="${f}"]`)
      if (sel) { await sel.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find(x => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(600) }
    }
    const read = () => page.evaluate(() => {
      const g = (n: string) => { const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null; return el ? { value: el.value, tag: el.tagName, visible: el.offsetParent !== null } : 'ABSENT' }
      return {
        f_design_type: g('f_design_type'), b_design_type: g('b_design_type'),
        f_design_edit: g('f_design_edit'), b_design_edit: g('b_design_edit'),
        order_count: g('order_count'), order_path: g('order_path'),
        design_type: g('design_type'),
      }
    })
    r.beforeModal = await read()
    // 바로주문 모달 열기 (#btn_order3)
    await page.evaluate(() => { (document.querySelector('#btn_order3') as HTMLElement)?.click() })
    await page.waitForTimeout(2500)
    r.afterModal = await read()
    // 모달에 design 관련 select 가 노출되는지 + 라벨
    r.modalDesignSelects = await page.evaluate(() => {
      const out: Record<string, unknown>[] = []
      for (const n of ['f_design_type', 'b_design_type', 'f_design_edit', 'b_design_edit', 'order_count']) {
        const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
        if (el) out.push({ name: n, visible: el.offsetParent !== null, current: el.value, opts: Array.from(el.options).filter(o => o.value).map(o => `${o.value}=${(o.textContent || '').trim()}`) })
      }
      return out
    })
  } catch (e) { r.error = String(e) } finally {
    fs.writeFileSync(`${OUT}/ordermodal.json`, JSON.stringify(r, null, 2)); await browser.close()
  }
  console.log('done')
}
main()
