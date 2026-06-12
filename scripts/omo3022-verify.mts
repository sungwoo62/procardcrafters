/**
 * OMO-3022: 추가 후가공 10종 자동발주 라이브 검증 (READ-ONLY, 주문/결제 없음).
 * 실제 lib 경로(expandFinishingToSwadpiaFields → selectOrderOptions → activateFinishings)를
 * 대표 카테고리 goods_view 폼에서 구동한 뒤 {type}_amt(성원 산출 surcharge)를 읽어
 * 자동발주로 단가가 잡히는지 확인한다.
 *
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3022-verify.mts
 */
import * as fs from 'fs'
import type { Page } from 'playwright'
import { expandFinishingToSwadpiaFields } from '../src/config/swadpia-finishing-fields.ts'

// ⚠️ swadpia-order.ts 는 extensionless import('./swadpia') 라 node strip-types 로 직접
//    로드 불가(번들러 전용). 그래서 활성화 로직(activateFinishings 의 page.evaluate 본문)을
//    아래에 동일하게 미러링한다. expandFinishingToSwadpiaFields(실 transform)는 그대로 import.
//    FINISHING_SPECS 는 swadpia-order.ts 와 동기화(변경 시 양쪽 갱신).
interface Spec { ppType: string; prefixes: string[]; marker?: string; autoPick?: string[]; needsClick?: boolean; positions?: boolean }
const FINISHING_SPECS: Spec[] = [
  { ppType: 'coating', prefixes: ['coating_'], marker: '__fin_coating', autoPick: ['coating_type'], needsClick: true },
  { ppType: 'cutting', prefixes: ['cutting_', 'add_cut_', 'add_parts_num'], marker: '__fin_cutting', autoPick: ['cutting_type'], needsClick: true },
  { ppType: 'binding', prefixes: ['binding_', 'binding_add_set', 'bundle_type'], marker: '__fin_binding', autoPick: ['bundle_type'], needsClick: true },
  { ppType: 'folding', prefixes: ['folding_', 'select_folding_'], marker: '__fin_folding', autoPick: ['folding_type', 'folding_direction'], needsClick: true },
  { ppType: 'bonding', prefixes: ['bonding_'], marker: '__fin_bonding', needsClick: true },
  { ppType: 'laminex', prefixes: ['laminex_'], marker: '__fin_laminex', autoPick: ['laminex_num'], needsClick: true },
  { ppType: 'stitching', prefixes: ['stitching_'], marker: '__fin_stitching', autoPick: ['stitching_type'], needsClick: true },
  { ppType: 'window', prefixes: ['window_'], marker: '__fin_window', autoPick: ['window_size'], needsClick: true },
  { ppType: 'tape', prefixes: ['tape_'], marker: '__fin_tape', autoPick: ['tape_type'], needsClick: true },
  { ppType: 'partial_coating', prefixes: ['partial_coating_'], marker: '__fin_partial_coating', needsClick: true },
]
function specForKey(key: string): Spec | undefined {
  let best: Spec | undefined; let bestLen = -1
  for (const g of FINISHING_SPECS) {
    if (g.marker && key === g.marker) return g
    for (const p of g.prefixes) if (key.startsWith(p) && p.length > bestLen) { best = g; bestLen = p.length }
  }
  return best
}

// activateFinishings 의 page.evaluate 본문과 동일(미러).
async function activateOne(page: Page, g: Spec, fieldMap: Record<string, string>) {
  await page.evaluate((params: { ppType: string; fieldMap: Record<string, string>; autoPick: string[]; needsClick: boolean; positions: boolean }) => {
    const { ppType, fieldMap, autoPick, needsClick, positions } = params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const setField = (name: string, value: string) => {
      const el = document.querySelector(`[name="${name}"]`) as HTMLSelectElement | HTMLInputElement | null
      if (!el) return
      if (el.tagName === 'SELECT') { const sel = el as HTMLSelectElement; if (!Array.from(sel.options).some((o) => o.value === value)) return }
      el.value = value; el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const pickRuntime = (name: string) => {
      const ke = document.querySelector(`select[name="${name}"]`) as HTMLSelectElement | null
      if (!ke) return
      const opts = Array.from(ke.options).map((o) => o.value).filter(Boolean)
      if (opts.length === 0) return
      const want = fieldMap[name]
      ke.value = want && opts.indexOf(want) !== -1 ? want : opts[0]
      ke.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const chk = document.getElementById(`chk_is_${ppType}`) as HTMLInputElement | null
    if (chk) chk.checked = true
    const chk2 = document.getElementById(`chk_is_${ppType}2`) as HTMLInputElement | null
    if (chk2) chk2.checked = true
    if (chk && needsClick) { chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
    try { w.$j && w.$j(`#pnl_${ppType}`).show() } catch { /* */ }
    for (const [n, v] of Object.entries(fieldMap)) { if (n.endsWith('_kind') || autoPick.indexOf(n) !== -1) continue; setField(n, v) }
    if (positions) for (const i of [1, 2, 3, 4]) { const p = document.querySelector(`[name="guidori_position${i}"]`) as HTMLInputElement | null; if (p && !p.checked) { p.checked = true; p.dispatchEvent(new Event('click', { bubbles: true })); p.dispatchEvent(new Event('change', { bubbles: true })) } }
    try { w.setIsPostpress && w.setIsPostpress(ppType) } catch { /* */ }
    for (const name of autoPick) pickRuntime(name)
    try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
  }, { ppType: g.ppType, fieldMap, autoPick: g.autoPick ?? [], needsClick: !!g.needsClick, positions: !!g.positions })
  await page.waitForTimeout(900)
  await page.evaluate(() => { // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any; try { w.product1 && w.product1.calcuEstimate() } catch { /* */ } })
  await page.waitForTimeout(200)
}

const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3022'

// 후가공 value → [대표 categoryCode, surcharge 입력 필드명, 수량]
const CASES: { value: string; cat: string; amtField: string; qty: number }[] = [
  { value: 'coating', cat: 'CDP3000', amtField: 'coating_amt', qty: 1000 },
  { value: 'cutting', cat: 'CST5000', amtField: 'cutting_amt', qty: 1000 },
  { value: 'binding', cat: 'CNR2000', amtField: 'binding_amt', qty: 1000 },
  { value: 'folding', cat: 'CPR3000', amtField: 'folding_amt', qty: 1000 },
  { value: 'bonding', cat: 'CST5000', amtField: 'bonding_amt', qty: 1000 },
  { value: 'laminex', cat: 'CST5000', amtField: 'laminex_amt', qty: 1000 },
  { value: 'stitching', cat: 'CPR2000', amtField: 'stitching_amt', qty: 500 },
  { value: 'window', cat: 'CEV1000', amtField: 'window_amt', qty: 1000 },
  { value: 'tape', cat: 'CEV1000', amtField: 'tape_amt', qty: 1000 },
  { value: 'partial_coating', cat: 'CPR5000', amtField: 'partial_coating_amt', qty: 1 },
]

async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('#icon_member_login'),
  ])
  await page.waitForTimeout(1500)
  return !page.url().includes('/member/login')
}

// 폼에서 첫 유효 옵션값을 읽어 핵심옵션(용지/사이즈)을 채운다.
async function firstOpt(page: Page, name: string): Promise<string | null> {
  return page.evaluate((n: string) => {
    const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
    if (!el) return null
    const o = Array.from(el.options).find((x) => x.value)
    return o ? o.value : null
  }, name)
}

async function readAmt(page: Page, name: string): Promise<string | null> {
  return page.evaluate((n: string) => {
    const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null
    return el ? el.value : null
  }, name)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  const results: Record<string, unknown>[] = []
  try {
    if (!(await login(page))) throw new Error('login failed')

    for (const c of CASES) {
      const row: Record<string, unknown> = { value: c.value, cat: c.cat }
      try {
        await page.goto(`${BASE}/goods/goods_view/${c.cat}/1`, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(800)
        // 핵심옵션: 용지(필수) 선택 → 종속필드 populate
        const paperField = (await page.$('select[name="paper_code"]')) ? 'paper_code' : 'cover_paper_code'
        const paper = await firstOpt(page, paperField)
        if (paper) {
          await page.evaluate((p: { f: string; v: string }) => {
            const s = document.querySelector(`select[name="${p.f}"]`) as HTMLSelectElement | null
            if (s) { s.value = p.v; s.dispatchEvent(new Event('change', { bubbles: true })) }
          }, { f: paperField, v: paper })
          await page.waitForTimeout(900)
        }
        // 수량 선택(있으면)
        await page.evaluate((q: number) => {
          for (const n of ['paper_qty', 'paper_qty_select', 'bundle_qty']) {
            const s = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
            if (!s) continue
            const opts = Array.from(s.options).map((o) => o.value).filter((v) => /^\d+$/.test(v)).map(Number)
            if (!opts.length) continue
            const atLeast = opts.filter((x) => x >= q).sort((a, b) => a - b)
            s.value = String(atLeast.length ? atLeast[0] : Math.max(...opts))
            s.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }, c.qty)
        await page.waitForTimeout(600)
        // 후가공 toggle 을 실 transform(expandFinishingToSwadpiaFields)으로 확장 → 활성화
        const expanded = expandFinishingToSwadpiaFields({ finishing: c.value })
        const spec = FINISHING_SPECS.find((s) => s.ppType === (c.value === 'gluing' ? 'bonding' : c.value))!
        const fieldMap: Record<string, string> = {}
        for (const [k, v] of Object.entries(expanded)) { if (specForKey(k) === spec && k !== spec.marker) fieldMap[k] = v }
        await activateOne(page, spec, fieldMap)
        const amt = await readAmt(page, c.amtField)
        const chkOn = await page.evaluate((t: string) => {
          const chk = document.getElementById(`chk_is_${t}`) as HTMLInputElement | null
          return chk ? chk.checked : null
        }, c.value === 'partial_coating' ? 'partial_coating' : c.value)
        row.expandedKeys = Object.keys(expanded)
        row.chkOn = chkOn
        row.amt = amt
        row.surchargeCaptured = !!(amt && /[1-9]/.test(amt))
      } catch (e) {
        row.error = String(e)
      }
      results.push(row)
      console.log(`[verify] ${c.value}@${c.cat} chkOn=${row.chkOn} amt=${row.amt} ok=${row.surchargeCaptured}`)
    }
  } finally {
    fs.writeFileSync(`${OUT}/verify.json`, JSON.stringify({ verifiedAt: '2026-06-13', results }, null, 2))
    await browser.close()
  }
  const ok = results.filter((r) => r.surchargeCaptured).length
  console.log(`done — surcharge 잡힘 ${ok}/${results.length} → ${OUT}/verify.json`)
}
main()
