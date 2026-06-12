/**
 * OMO-3030: 정확한 카테고리에서 production 경로(generic activateFinishings) + per-type recalc 비교 검증.
 * coating→CPR5000, partial_coating→CPR4000(올바른 카테고리). cutting/bonding/laminex 재확인.
 * + BDT6 cover_paper_kind 스윕. READ-ONLY.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3030-verify.mts
 */
import * as fs from 'fs'
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3030'

// 후가공별: 카테고리, 제안 DEFAULT 필드, surcharge 필드, per-type recalc 함수
const CASES: { value: string; ppType: string; cat: string; def: Record<string, string>; amtField: string; recalc?: string }[] = [
  { value: 'coating', ppType: 'coating', cat: 'CPR5000', def: { __fin_coating: '1' }, amtField: 'coating_amt', recalc: 'chgCoatingType' },
  { value: 'partial_coating', ppType: 'partial_coating', cat: 'CPR4000', def: { __fin_partial_coating: '1', partial_coating_x_size: '100', partial_coating_y_size: '100' }, amtField: 'partial_coating_amt', recalc: 'chgPartialCoatingSize' },
  { value: 'cutting', ppType: 'cutting', cat: 'CDP3000', def: { __fin_cutting: '1', add_cut_x_size_1: '50', add_cut_y_size_1: '30', add_parts_num_1: '4' }, amtField: 'cutting_amt', recalc: 'chgCuttingSize' },
  { value: 'bonding', ppType: 'bonding', cat: 'CST5000', def: { __fin_bonding: '1', bonding_num: '1', bonding_x_size: '200', bonding_y_size: '200' }, amtField: 'bonding_amt', recalc: 'chgBondingType' },
  { value: 'laminex', ppType: 'laminex', cat: 'CST5000', def: { __fin_laminex: '1' }, amtField: 'laminex_amt', recalc: 'chgLaminexNum' },
]

async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
  await page.waitForTimeout(1500)
}
async function prep(page: Page, cat: string) {
  await page.goto(`${BASE}/goods/goods_view/${cat}/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  await page.evaluate(() => { for (const f of ['paper_code', 'cover_paper_code']) { const s = document.querySelector(`select[name="${f}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
  await page.waitForTimeout(900)
  await page.evaluate(() => { for (const n of ['paper_qty', 'paper_qty_select', 'bundle_qty', 'order_count']) { const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } } })
  await page.waitForTimeout(500)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  await login(page)
  const results: Record<string, unknown>[] = []

  for (const c of CASES) {
    const row: Record<string, unknown> = { value: c.value, cat: c.cat }
    try {
      await prep(page, c.cat)
      // generic activateFinishings 본문 미러(swadpia-order.ts 와 동일) — recalc 인자만 추가
      const r = await page.evaluate((p: { ppType: string; def: Record<string, string>; amtField: string; recalc?: string }) => {
        const w = window as unknown as Record<string, unknown>
        const call = (n?: string, ...a: unknown[]) => { if (!n) return; try { (w[n] as ((...x: unknown[]) => void))?.(...a) } catch { /* */ } }
        const fieldMap: Record<string, string> = {}
        for (const [k, v] of Object.entries(p.def)) { if (k.startsWith('__fin_')) continue; fieldMap[k] = v }
        const setField = (name: string, value: string) => { const el = document.querySelector(`[name="${name}"]`) as HTMLSelectElement | HTMLInputElement | null; if (!el) return; if (el.tagName === 'SELECT') { const sel = el as HTMLSelectElement; if (!Array.from(sel.options).some((o) => o.value === value)) return } el.value = value; for (const ev of ['input', 'change']) el.dispatchEvent(new Event(ev, { bubbles: true })) }
        const chk = document.getElementById(`chk_is_${p.ppType}`) as HTMLInputElement | null
        if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
        for (const [n, v] of Object.entries(fieldMap)) setField(n, v)
        call('setIsPostpress', p.ppType)
        // amt after generic path only (no recalc)
        try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
        const amtGeneric = (document.querySelector(`[name="${p.amtField}"]`) as HTMLInputElement | null)?.value || '0'
        // now fire per-type recalc + re-set sizes (some recalc reads current size inputs)
        for (const [n, v] of Object.entries(fieldMap)) setField(n, v)
        call(p.recalc)
        try { (w.product1 as { calcuEstimate?: () => void })?.calcuEstimate?.() } catch { /* */ }
        const amtRecalc = (document.querySelector(`[name="${p.amtField}"]`) as HTMLInputElement | null)?.value || '0'
        return { amtGeneric, amtRecalc, chkOn: !!(document.getElementById(`chk_is_${p.ppType}`) as HTMLInputElement | null)?.checked }
      }, { ppType: c.ppType, def: c.def, amtField: c.amtField, recalc: c.recalc })
      await page.waitForTimeout(300)
      row.amtGeneric = r.amtGeneric; row.amtRecalc = r.amtRecalc; row.chkOn = r.chkOn
      row.genericOk = /[1-9]/.test(r.amtGeneric); row.recalcOk = /[1-9]/.test(r.amtRecalc)
    } catch (e) { row.error = String(e) }
    results.push(row)
    console.log(`[v] ${c.value}@${c.cat} chkOn=${row.chkOn} generic=${row.amtGeneric} recalc=${row.amtRecalc}`)
  }

  // ── BDT6 cover_paper_kind 스윕 (CPR4000) ──
  await page.goto(`${BASE}/goods/goods_view/CPR4000/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  const bdtSweep = await page.evaluate(() => {
    const kindSel = document.querySelector('select[name="cover_paper_kind"]') as HTMLSelectElement | null
    const kinds = kindSel ? Array.from(kindSel.options).map((o) => o.value).filter(Boolean) : []
    const snap = () => { const s = document.querySelector('select[name="binding_type"]') as HTMLSelectElement | null; return s ? Array.from(s.options).map((o) => o.value) : null }
    const rows: Record<string, unknown>[] = []
    for (const k of kinds) {
      if (kindSel) { kindSel.value = k; kindSel.dispatchEvent(new Event('change', { bubbles: true })) }
      // 표지 type/code 도 첫옵션 선택(종속)
      for (const f of ['cover_paper_type', 'cover_paper_code']) { const s = document.querySelector(`select[name="${f}"]`) as HTMLSelectElement | null; if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } } }
      const bt = snap()
      rows.push({ cover_paper_kind: k, binding: bt, hasBDT6: Array.isArray(bt) && (bt as string[]).includes('BDT6') })
    }
    return { kinds, rows }
  })

  fs.writeFileSync(`${OUT}/verify.json`, JSON.stringify({ verifiedAt: '2026-06-13', note: 'OMO-3030 corrected-category verify', results, bdtSweep }, null, 2))
  console.log('\n=== BDT6 sweep ===')
  console.log(JSON.stringify(bdtSweep.rows.map((r) => ({ k: r.cover_paper_kind, h: r.hasBDT6, b: r.binding }))))
  await browser.close()
}
main()
