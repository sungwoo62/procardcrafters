/**
 * OMO-3030 probe2: BDT6 조건 확정 + cutting/bonding 대면적 과금 + coating 첫옵션 + laminex 최종확인.
 * READ-ONLY. 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3030-probe2.mts
 */
import * as fs from 'fs'
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3030'

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
  const out: Record<string, unknown> = {}

  // ── A. BDT6 조건: CPR4000/1 raw → 선택 진행하며 binding_type 옵션 추적 ──
  await page.goto(`${BASE}/goods/goods_view/CPR4000/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  const bdtTrace = await page.evaluate(() => {
    const snap = () => { const s = document.querySelector('select[name="binding_type"]') as HTMLSelectElement | null; return s ? Array.from(s.options).map((o) => [o.value, o.text]) : null }
    const steps: Record<string, unknown> = { raw: snap() }
    // 표지/내지 용지 첫옵션 선택
    for (const f of ['cover_paper_kind', 'cover_paper_type', 'cover_paper_code', 'in_paper_kind', 'in_paper_type', 'in_paper_code']) {
      const s = document.querySelector(`select[name="${f}"]`) as HTMLSelectElement | null
      if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }
    }
    steps.afterPaper = snap()
    // 내지 페이지수 설정
    const pq = document.querySelector('select[name="in_page_qty"]') as HTMLSelectElement | null
    if (pq) { const o = Array.from(pq.options).find((x) => x.value); if (o) { pq.value = o.value; pq.dispatchEvent(new Event('change', { bubbles: true })) } }
    steps.afterPageQty = snap()
    return steps
  })
  await page.waitForTimeout(600)
  // 페이지수를 크게(무선제본 최소 페이지 가정) 잡고 다시 확인
  const bdtHighPage = await page.evaluate(() => {
    const pq = document.querySelector('select[name="in_page_qty"]') as HTMLSelectElement | null
    const opts = pq ? Array.from(pq.options).map((o) => o.value).filter(Boolean) : []
    const results: Record<string, unknown>[] = []
    const snap = () => { const s = document.querySelector('select[name="binding_type"]') as HTMLSelectElement | null; return s ? Array.from(s.options).map((o) => o.value) : null }
    // 여러 페이지수 시도해 BDT6 등장 조건 찾기
    for (const v of opts.filter((_, i) => i % 20 === 0).slice(0, 8)) {
      if (pq) { pq.value = v; pq.dispatchEvent(new Event('change', { bubbles: true })) }
      const bt = snap()
      results.push({ in_page_qty: v, binding: bt, hasBDT6: Array.isArray(bt) && (bt as string[]).includes('BDT6') })
    }
    return { nPageOpts: opts.length, results }
  })
  out.bdt = { trace: bdtTrace, highPage: bdtHighPage }

  // ── B. cutting 대면적: CST5000 200×200 parts10 + CDP3000 재확인 ──
  const cutting: Record<string, unknown>[] = []
  for (const [cat, x, y, parts] of [['CST5000', '200', '200', '10'], ['CST5000', '100', '100', '4'], ['CDP3000', '50', '30', '4']] as [string, string, string, string][]) {
    await page.goto(`${BASE}/goods/goods_view/${cat}/1`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(700)
    await page.evaluate(() => { for (const f of ['paper_code']) { const s = document.querySelector(`select[name="${f}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
    await page.waitForTimeout(800)
    await page.evaluate(() => { for (const n of ['paper_qty', 'paper_qty_select', 'order_count']) { const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
    await page.waitForTimeout(400)
    const r = await page.evaluate((p: { x: string; y: string; parts: string }) => {
      const w = window as unknown as Record<string, unknown>
      const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
      const set = (n: string, v: string) => { const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null; if (!el) return; el.value = v; for (const ev of ['input', 'keyup', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true })) }
      const chk = document.getElementById('chk_is_cutting') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      call('setIsPostpress', 'cutting')
      set('add_cut_x_size_1', p.x); set('add_cut_y_size_1', p.y); set('add_parts_num_1', p.parts)
      call('chgCuttingSize')
      try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
      const amt = (document.querySelector('[name="cutting_amt"]') as HTMLInputElement | null)?.value || '0'
      const fields: Record<string, string> = {}
      const pnl = document.getElementById('pnl_cutting')
      if (pnl) for (const e of Array.from(pnl.querySelectorAll('[name]'))) fields[(e as HTMLInputElement).name] = (e as HTMLInputElement).value
      return { amt, chkOn: !!chk?.checked, fields }
    }, { x, y, parts })
    cutting.push({ cat, x, y, parts, ...r })
  }
  out.cutting = cutting

  // ── C. bonding 대면적 + 모든 BOT 순회: CST5000 ──
  await page.goto(`${BASE}/goods/goods_view/CST5000/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(700)
  await page.evaluate(() => { const s = document.querySelector('select[name="paper_code"]') as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } })
  await page.waitForTimeout(800)
  await page.evaluate(() => { for (const n of ['paper_qty', 'order_count']) { const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
  const bonding = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
    const set = (n: string, v: string) => { const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null; if (!el) return; el.value = v; for (const ev of ['input', 'keyup', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true })) }
    const chk = document.getElementById('chk_is_bonding') as HTMLInputElement | null
    if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
    const bt = document.querySelector('select[name="bonding_type"]') as HTMLSelectElement | null
    const opts = bt ? Array.from(bt.options).map((o) => o.value).filter(Boolean) : []
    const trials: unknown[] = []
    for (const v of opts) {
      if (bt) { bt.value = v; bt.dispatchEvent(new Event('change', { bubbles: true })); call('chgBondingType') }
      set('bonding_num', '1'); set('bonding_x_size', '200'); set('bonding_y_size', '200')
      call('chgBondingType'); call('setIsPostpress', 'bonding')
      try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
      trials.push({ v, amt: (document.querySelector('[name="bonding_amt"]') as HTMLInputElement | null)?.value })
    }
    // 패널 전체 필드 덤프
    const fields: Record<string, string> = {}
    const pnl = document.getElementById('pnl_bonding')
    if (pnl) for (const e of Array.from(pnl.querySelectorAll('[name]'))) fields[(e as HTMLInputElement).name] = (e as HTMLInputElement).value
    return { opts, trials, fields }
  })
  out.bonding = bonding

  // ── D. coating CPR5000 첫옵션(COT10) amt ──
  await page.goto(`${BASE}/goods/goods_view/CPR5000/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(700)
  await page.evaluate(() => { const s = document.querySelector('select[name="paper_code"]') as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } })
  await page.waitForTimeout(800)
  await page.evaluate(() => { for (const n of ['paper_qty', 'order_count']) { const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
  const coating = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
    const ct = document.querySelector('select[name="coating_type"]') as HTMLSelectElement | null
    const opts = ct ? Array.from(ct.options).map((o) => o.value).filter(Boolean) : []
    const trials: unknown[] = []
    for (const v of opts) {
      if (ct) { ct.value = v; ct.dispatchEvent(new Event('change', { bubbles: true })); call('chgCoatingType') }
      call('setIsPostpress', 'coating')
      try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
      trials.push({ v, amt: (document.querySelector('[name="coating_amt"]') as HTMLInputElement | null)?.value })
    }
    return { opts, trials, chkOn: !!(document.getElementById('chk_is_coating') as HTMLInputElement | null)?.checked }
  })
  out.coating = coating

  fs.writeFileSync(`${OUT}/probe2.json`, JSON.stringify(out, null, 2))
  console.log('=== BDT trace ==='); console.log(JSON.stringify(out.bdt))
  console.log('\n=== cutting ==='); for (const c of cutting) console.log(JSON.stringify(c))
  console.log('\n=== bonding ==='); console.log(JSON.stringify(bonding.opts), JSON.stringify(bonding.trials))
  console.log('\n=== coating ==='); console.log(JSON.stringify(coating))
  await browser.close()
}
main()
