/**
 * OMO-3030: 후가공 5종(coating/cutting/bonding/partial_coating/laminex) 과금 시퀀스 확정 + 책자 BDT6 인쇄색.
 * READ-ONLY — 주문/결제 없음. 폼 활성화·재계산만 유발해 {type}_amt>0 을 확인한다.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3030-probe.mts
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

async function prep(page: Page, cat: string) {
  await page.goto(`${BASE}/goods/goods_view/${cat}/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    for (const f of ['paper_code', 'cover_paper_code']) {
      const s = document.querySelector(`select[name="${f}"]`) as HTMLSelectElement | null
      if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }
    }
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    for (const n of ['paper_qty', 'paper_qty_select', 'bundle_qty', 'order_count']) {
      const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
      if (s) { const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }
    }
  })
  await page.waitForTimeout(500)
}

// 0) 전역 함수 스캔: 각 후가공 관련 함수명을 카테고리별로 수집
async function scanFns(page: Page, cat: string) {
  return await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    const all = Object.getOwnPropertyNames(w).filter((k) => typeof w[k] === 'function')
    const pick = (re: RegExp) => all.filter((k) => re.test(k))
    return {
      coating: pick(/coat/i), cutting: pick(/cut/i), bonding: pick(/bond/i),
      partial: pick(/partial|busun/i), laminex: pick(/lamin|raminex|laminate/i),
      postpress: pick(/postpress|pp[A-Z]|setIs/i),
    }
  })
}

type Result = { type: string; cat: string; paper?: string; amt: string; chkOn: boolean; detail?: unknown }

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  await login(page)

  const results: Result[] = []
  const fnScan: Record<string, unknown> = {}

  // ── 0. 함수 스캔 (대표 카테고리) ──
  for (const cat of ['CST5000', 'CPR5000', 'CCD1000', 'CPR4000']) {
    await prep(page, cat)
    fnScan[cat] = await scanFns(page, cat)
  }

  // ── 1. coating: CCD1000(토글됨)·CPR5000(기본ON)·CDP3000 에서 용지별로 amt 확인 ──
  for (const cat of ['CCD1000', 'CPR5000', 'CDP3000', 'CST1000']) {
    await prep(page, cat)
    const r = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
      const out: Record<string, unknown> = {}
      const chk = document.getElementById('chk_is_coating') as HTMLInputElement | null
      out.exists = !!chk
      if (chk) {
        chk.checked = true
        chk.dispatchEvent(new Event('click', { bubbles: true }))
        chk.dispatchEvent(new Event('change', { bubbles: true }))
        out.checkedAfter = chk.checked
      }
      // coating_type 모든 옵션을 순회하며 가장 큰 amt 찾기
      const ct = document.querySelector('select[name="coating_type"]') as HTMLSelectElement | null
      out.coatingTypeOptions = ct ? Array.from(ct.options).map((o) => [o.value, o.text]) : null
      let best = 0; let bestVal = ''
      const opts = ct ? Array.from(ct.options).map((o) => o.value).filter(Boolean) : ['']
      for (const v of opts) {
        if (ct && v) { ct.value = v; ct.dispatchEvent(new Event('change', { bubbles: true })) }
        call('setIsPostpress', 'coating')
        const prod = w.product1 as Record<string, unknown> | undefined
        try { (prod?.calcuEstimate as (() => void))?.() } catch { /* */ }
        const amt = Number((document.querySelector('[name="coating_amt"]') as HTMLInputElement | null)?.value || '0')
        if (amt > best) { best = amt; bestVal = v }
      }
      out.bestAmt = String(best); out.bestCoatingType = bestVal
      out.chkOn = !!(document.getElementById('chk_is_coating') as HTMLInputElement | null)?.checked
      return out
    })
    results.push({ type: 'coating', cat, amt: String((r as { bestAmt?: string }).bestAmt ?? '0'), chkOn: !!(r as { chkOn?: boolean }).chkOn, detail: r })
  }

  // ── 2. cutting: chgCuttingType → chgCuttingSize, CTT 순회 + 사이즈/부수 ──
  for (const cat of ['CST5000', 'CST2000', 'CDP3000']) {
    await prep(page, cat)
    const r = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
      const set = (n: string, v: string) => { const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null; if (!el) return; el.value = v; for (const ev of ['input', 'keyup', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true })) }
      const chk = document.getElementById('chk_is_cutting') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      const ctt = document.querySelector('select[name="cutting_type"]') as HTMLSelectElement | null
      const cttOpts = ctt ? Array.from(ctt.options).map((o) => o.value).filter(Boolean) : []
      let best = 0; const trials: unknown[] = []
      for (const v of (cttOpts.length ? cttOpts : [''])) {
        if (ctt && v) { ctt.value = v; ctt.dispatchEvent(new Event('change', { bubbles: true })); call('chgCuttingType') }
        set('add_cut_x_size_1', '50'); set('add_cut_y_size_1', '30'); set('add_parts_num_1', '4')
        call('chgCuttingSize')
        call('setIsPostpress', 'cutting')
        try { (w.product1 as Record<string, unknown>)?.calcuEstimate && (w.product1 as { calcuEstimate: () => void }).calcuEstimate() } catch { /* */ }
        const amt = Number((document.querySelector('[name="cutting_amt"]') as HTMLInputElement | null)?.value || '0')
        trials.push({ v, amt })
        if (amt > best) best = amt
      }
      return { cttOpts, trials, best: String(best), chkOn: !!chk?.checked }
    })
    results.push({ type: 'cutting', cat, amt: (r as { best: string }).best, chkOn: (r as { chkOn: boolean }).chkOn, detail: r })
  }

  // ── 3. bonding: chgBondingType, BOT 순회 + num/사이즈 ──
  for (const cat of ['CST5000', 'CEV1000', 'CNR2000']) {
    await prep(page, cat)
    const r = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
      const set = (n: string, v: string) => { const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null; if (!el) return; el.value = v; for (const ev of ['input', 'keyup', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true })) }
      const chk = document.getElementById('chk_is_bonding') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      const bt = document.querySelector('select[name="bonding_type"]') as HTMLSelectElement | null
      const btOpts = bt ? Array.from(bt.options).map((o) => o.value).filter(Boolean) : []
      let best = 0; const trials: unknown[] = []
      for (const v of (btOpts.length ? btOpts : [''])) {
        if (bt && v) { bt.value = v; bt.dispatchEvent(new Event('change', { bubbles: true })); call('chgBondingType') }
        set('bonding_num', '1'); set('bonding_x_size', '50'); set('bonding_y_size', '30')
        call('chgBondingSize'); call('setIsPostpress', 'bonding')
        try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
        const amt = Number((document.querySelector('[name="bonding_amt"]') as HTMLInputElement | null)?.value || '0')
        trials.push({ v, amt }); if (amt > best) best = amt
      }
      return { btOpts, trials, best: String(best), chkOn: !!chk?.checked }
    })
    results.push({ type: 'bonding', cat, amt: (r as { best: string }).best, chkOn: (r as { chkOn: boolean }).chkOn, detail: r })
  }

  // ── 4. partial_coating: CPR4000(책자)·CPR5000(배너) 면적 + 모든 partial 함수 ──
  for (const cat of ['CPR4000', 'CPR5000', 'CLF2000']) {
    await prep(page, cat)
    const r = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
      const set = (n: string, v: string) => { const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null; if (!el) return; el.value = v; for (const ev of ['input', 'keyup', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true })) }
      const chk = document.getElementById('chk_is_partial_coating') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      set('partial_coating_x_size', '100'); set('partial_coating_y_size', '100')
      const fns = Object.getOwnPropertyNames(w).filter((k) => /partial|busun|coat/i.test(k) && typeof w[k] === 'function')
      for (const f of fns) call(f)
      call('setIsPostpress', 'partial_coating')
      try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
      const amt = (document.querySelector('[name="partial_coating_amt"]') as HTMLInputElement | null)?.value || '0'
      const suji = (document.querySelector('[name="partial_coating_suji_amt"]') as HTMLInputElement | null)?.value || '0'
      return { fns, amt, suji, chkOn: !!chk?.checked }
    })
    results.push({ type: 'partial_coating', cat, amt: (r as { amt: string }).amt, chkOn: (r as { chkOn: boolean }).chkOn, detail: r })
  }

  // ── 5. laminex: 카테고리/용지 순회로 laminex_num populate 찾기 ──
  for (const cat of ['CST5000', 'CST1000', 'CST7000', 'CLP1000']) {
    await prep(page, cat)
    const r = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      const call = (n: string, ...a: unknown[]) => { try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
      const paper = document.querySelector('select[name="paper_code"]') as HTMLSelectElement | null
      const papers = paper ? Array.from(paper.options).map((o) => o.value).filter(Boolean) : ['']
      let best = 0; let bestPaper = ''; let numOptsBest: string[] = []
      for (const p of papers.slice(0, 12)) {
        if (paper && p) { paper.value = p; paper.dispatchEvent(new Event('change', { bubbles: true })) }
        const chk = document.getElementById('chk_is_laminex') as HTMLInputElement | null
        if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
        const ln = document.querySelector('select[name="laminex_num"]') as HTMLSelectElement | null
        const numOpts = ln ? Array.from(ln.options).map((o) => o.value).filter(Boolean) : []
        if (numOpts.length && ln) { ln.value = numOpts[0]; ln.dispatchEvent(new Event('change', { bubbles: true })) }
        call('setIsPostpress', 'laminex')
        try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
        const amt = Number((document.querySelector('[name="laminex_amt"]') as HTMLInputElement | null)?.value || '0')
        if (numOpts.length > numOptsBest.length) numOptsBest = numOpts
        if (amt > best) { best = amt; bestPaper = p }
      }
      return { best: String(best), bestPaper, numOptsBest, nPapers: papers.length }
    })
    results.push({ type: 'laminex', cat, amt: (r as { best: string }).best, paper: (r as { bestPaper: string }).bestPaper, chkOn: true, detail: r })
  }

  // ── 6. CPR4000 책자 BDT6(PUR무선) 인쇄색/제본 옵션 ──
  await prep(page, 'CPR4000')
  const booklet = await page.evaluate(() => {
    const grab = (n: string) => { const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; return s ? Array.from(s.options).map((o) => [o.value, o.text]) : null }
    return {
      binding_type: grab('binding_type'),
      bookbinding_type: grab('bookbinding_type'),
      bdt: grab('bdt_type'),
      print_color_type: grab('print_color_type'),
      cover_color: grab('cover_color_info') || grab('cover_print_color_type'),
      inner_color: grab('inner_color_info') || grab('inner_print_color_type'),
      allSelects: Array.from(document.querySelectorAll('select[name]')).map((s) => (s as HTMLSelectElement).name),
    }
  })

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify({ probedAt: '2026-06-13', fnScan, results, booklet }, null, 2))
  console.log('=== FN SCAN ===')
  console.log(JSON.stringify(fnScan, null, 1))
  console.log('\n=== RESULTS (type@cat → amt) ===')
  for (const r of results) console.log(`${r.type}@${r.cat}${r.paper ? '/' + r.paper : ''}: amt=${r.amt} chkOn=${r.chkOn}`)
  console.log('\n=== BOOKLET CPR4000 ===')
  console.log(JSON.stringify(booklet, null, 1))
  await browser.close()
}
main()
