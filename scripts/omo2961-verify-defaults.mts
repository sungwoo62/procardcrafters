/**
 * OMO-2961: 런타임 4종 자동발주 기본값 검증. READ-ONLY(주문/결제 없음).
 * 각 후가공을 우리 DEFAULT 값으로 활성화 → 굳어지는지(select value) + 가격 델타(surcharge)
 * + 패널 내 모든 필드(추가 필수항목 유무) 확인.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2961-verify-defaults.mts
 */
import * as fs from 'fs'
import type { Page } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo2961'

// 검증 대상 + 우리가 코드에 넣을 DEFAULT (추출값 기반)
const CASES: { type: string; defaults: Record<string, string> }[] = [
  { type: 'guidori', defaults: { guidori_type: 'GDR40' } },
  { type: 'epoxy', defaults: { epoxy_type: 'EPT10' } },
  { type: 'osi', defaults: { osi_num: 'OSN01', osi_direction: 'OMD10' } },
  { type: 'missing', defaults: { missing_num: 'MSN01', missing_direction: 'OMD10' } },
]

async function readTotal(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    for (const k of ['pay_price', 'total_price', 'order_total_price', 'last_price']) {
      const v = w[k]
      if (typeof v === 'number' && v > 0) return v
    }
    for (const sel of ['#total_price', '#pay_price', '#order_total_price', '[id*="total_price"]']) {
      const el = document.querySelector(sel)
      if (el) { const n = Number((el.textContent || '').replace(/[^0-9]/g, '')); if (n > 0) return n }
    }
    return null
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const result: Record<string, unknown> = {}
  try {
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('#icon_member_login'),
    ])
    await page.waitForTimeout(2000)

    await page.goto(`${BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 30000 })
    // 용지/사이즈/수량 기본 세팅
    for (const f of ['paper_code', 'paper_size']) {
      const sel = await page.$(`select[name="${f}"]`)
      if (sel) { await sel.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(700) }
    }
    const qty = await page.$('select[name="paper_qty"]')
    if (qty) { await qty.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find((x) => /^\d+$/.test(x.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(700) }
    await page.evaluate(() => { try { (window as any).product1?.calcuEstimate() } catch {} }) // eslint-disable-line
    await page.waitForTimeout(800)
    const baseline = await readTotal(page)
    result.baseline = baseline

    const cases: Record<string, unknown> = {}
    for (const c of CASES) {
      const applied = await page.evaluate((p: { type: string; defaults: Record<string, string> }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        const chk = document.getElementById(`chk_is_${p.type}`) as HTMLInputElement | null
        if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
        try { w.$j && w.$j(`#pnl_${p.type}`).show() } catch {}
        const setF = (n: string, v: string) => {
          const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
          if (!el) return 'no-select'
          if (!Array.from(el.options).some((o) => o.value === v)) return 'value-absent'
          el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'
        }
        const fieldResults: Record<string, string> = {}
        for (const [n, v] of Object.entries(p.defaults)) fieldResults[n] = setF(n, v)
        try { w.setIsPostpress && w.setIsPostpress(p.type) } catch {}
        try { w.product1 && w.product1.calcuEstimate() } catch {}
        // 패널 내 모든 필드 덤프
        const panel = document.getElementById(`pnl_${p.type}`)
        const panelFields = panel ? Array.from(panel.querySelectorAll('select[name],input[name]')).map((e) => {
          const el = e as HTMLInputElement; return { name: el.name, tag: el.tagName, type: (el as any).type || '', value: el.value } // eslint-disable-line
        }) : []
        return { fieldResults, chkChecked: chk?.checked ?? null, panelFields }
      }, c)
      await page.waitForTimeout(1200)
      const total = await readTotal(page)
      const verify = await page.evaluate((p: { type: string; defaults: Record<string, string> }) => {
        const out: Record<string, string> = {}
        for (const n of Object.keys(p.defaults)) { const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; out[n] = el ? el.value : 'MISSING' }
        return out
      }, c)
      cases[c.type] = { applied, totalAfter: total, deltaFromBaseline: baseline != null && total != null ? total - baseline : null, valuesStuck: verify }
      // 다음 케이스 영향 최소화 위해 체크 해제
      await page.evaluate((type: string) => { const chk = document.getElementById(`chk_is_${type}`) as HTMLInputElement | null; if (chk) { chk.checked = false; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) } try { (window as any).product1?.calcuEstimate() } catch {} }, c.type) // eslint-disable-line
      await page.waitForTimeout(800)
    }
    result.cases = cases
  } catch (e) {
    result.error = String(e)
  } finally {
    fs.writeFileSync(`${OUT}/verify-defaults.json`, JSON.stringify(result, null, 2))
    await browser.close()
  }
  console.log(JSON.stringify(result, null, 2))
}

main()
