/**
 * OMO-2961: config(expandFinishingToSwadpiaFields) + activateFinishings 시퀀스 통합 검증.
 * 실제 config 기본값으로 4종 동시 활성화 → 각 surcharge(_amt) > 0 확인. READ-ONLY.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2961-integration.mts
 */
import * as fs from 'fs'
import { expandFinishingToSwadpiaFields } from '../src/config/swadpia-finishing-fields.ts'

const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo2961'

// 프로덕션 activateFinishings 와 동일 시퀀스 (검증용 인라인)
const ACTIVATE = `
(params) => {
  const { ppType, fieldMap } = params
  const w = window
  const setField = (name, value) => {
    const el = document.querySelector('[name="'+name+'"]')
    if (!el) return
    if (el.tagName === 'SELECT' && !Array.from(el.options).some(o => o.value === value)) return
    el.value = value; el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const chk = document.getElementById('chk_is_'+ppType)
  if (chk) chk.checked = true
  const RUNTIME_PP = ['guidori','epoxy','osi','missing']
  if (chk && RUNTIME_PP.indexOf(ppType) !== -1) {
    chk.dispatchEvent(new Event('click', { bubbles: true }))
    chk.dispatchEvent(new Event('change', { bubbles: true }))
  }
  try { w.$j && w.$j('#pnl_'+ppType).show() } catch {}
  for (const [n,v] of Object.entries(fieldMap)) { if (n.endsWith('_kind')) continue; setField(n,v) }
  if (ppType === 'guidori') {
    for (const i of [1,2,3,4]) { const p = document.querySelector('[name="guidori_position'+i+'"]'); if (p && !p.checked) { p.checked = true; p.dispatchEvent(new Event('click',{bubbles:true})); p.dispatchEvent(new Event('change',{bubbles:true})) } }
  }
  if (ppType === 'epoxy') {
    const ke = document.querySelector('select[name="epoxy_kind"]')
    if (ke) { const opts = Array.from(ke.options).map(o=>o.value).filter(Boolean); const want = fieldMap['epoxy_kind']; const chosen = want && opts.indexOf(want)!==-1 ? want : (opts[0]||''); if (chosen) { ke.value = chosen; ke.dispatchEvent(new Event('change',{bubbles:true})) } }
  }
  try { w.setIsPostpress && w.setIsPostpress(ppType) } catch {}
  try { w.product1 && w.product1.calcuEstimate() } catch {}
}`

const GROUPS = [
  { ppType: 'guidori', prefix: 'guidori_' },
  { ppType: 'epoxy', prefix: 'epoxy_' },
  { ppType: 'osi', prefix: 'osi_' },
  { ppType: 'missing', prefix: 'missing_' },
]

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const result: Record<string, unknown> = {}
  try {
    // config 기본값으로 4종 필드맵 생성 (실제 주문 경로와 동일)
    const snapshot = expandFinishingToSwadpiaFields({ finishing: 'round_corner,epoxy,score_crease,perforation' })
    result.snapshot = snapshot

    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
    await page.waitForTimeout(2000)
    await page.goto(`${BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 30000 })
    for (const f of ['paper_code', 'paper_size']) {
      const sel = await page.$(`select[name="${f}"]`)
      if (sel) { await sel.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(700) }
    }
    const qty = await page.$('select[name="paper_qty"]')
    if (qty) { await qty.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(700) }

    // 4종 동시 활성화 (config 필드맵 사용)
    for (const g of GROUPS) {
      const fieldMap: Record<string, string> = {}
      for (const [k, v] of Object.entries(snapshot)) if (k.startsWith(g.prefix)) fieldMap[k] = v as string
      await page.evaluate(`(${ACTIVATE})(${JSON.stringify({ ppType: g.ppType, fieldMap })})`)
      await page.waitForTimeout(1000)
    }
    await page.evaluate(() => { try { (window as any).product1?.calcuEstimate() } catch {} }) // eslint-disable-line
    await page.waitForTimeout(1000)

    const amts: Record<string, string> = {}
    for (const n of ['guidori_amt', 'epoxy_amt', 'osi_amt', 'missing_amt']) {
      amts[n] = await page.evaluate((nm: string) => { const el = document.querySelector(`[name="${nm}"]`) as HTMLInputElement | null; return el ? el.value : 'MISSING' }, n)
    }
    result.amts = amts
    result.allApplied = Object.values(amts).every((v) => /^[0-9]+$/.test(v) && Number(v) > 0)
  } catch (e) { result.error = String(e) } finally {
    fs.writeFileSync(`${OUT}/integration.json`, JSON.stringify(result, null, 2))
    await browser.close()
  }
  console.log(JSON.stringify(result, null, 2))
}
main()
