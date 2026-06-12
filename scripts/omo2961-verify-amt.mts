/**
 * OMO-2961: 런타임 4종 surcharge(_amt) 확정 검증 + guidori 위치/epoxy_kind 보강. READ-ONLY.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2961-verify-amt.mts
 */
import * as fs from 'fs'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo2961'

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const result: Record<string, unknown> = {}
  try {
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

    result.epoxyKindOptions = await page.evaluate(() => {
      const el = document.querySelector('select[name="epoxy_kind"]') as HTMLSelectElement | null
      return el ? Array.from(el.options).map((o) => ({ value: o.value, label: (o.textContent || '').trim() })) : 'no-select'
    })

    const amt = (name: string) => page.evaluate((n: string) => {
      const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null
      return el ? el.value : 'MISSING'
    }, name)

    // guidori: GDR40 + 위치 4개 체크
    await page.evaluate(() => {
      const w = window as any // eslint-disable-line
      const chk = document.getElementById('chk_is_guidori') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      const t = document.querySelector('select[name="guidori_type"]') as HTMLSelectElement | null
      if (t) { t.value = 'GDR40'; t.dispatchEvent(new Event('change', { bubbles: true })) }
      for (const i of [1, 2, 3, 4]) { const p = document.querySelector(`[name="guidori_position${i}"]`) as HTMLInputElement | null; if (p && !p.checked) { p.checked = true; p.dispatchEvent(new Event('click', { bubbles: true })); p.dispatchEvent(new Event('change', { bubbles: true })) } }
      try { w.setIsPostpress && w.setIsPostpress('guidori') } catch {}
      try { w.product1 && w.product1.calcuEstimate() } catch {}
    })
    await page.waitForTimeout(1500)
    result.guidori_amt = await amt('guidori_amt')

    // epoxy: type EPT10 + kind 첫 유효값
    const epoxyKindChosen = await page.evaluate(() => {
      const w = window as any // eslint-disable-line
      const chk = document.getElementById('chk_is_epoxy') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      const t = document.querySelector('select[name="epoxy_type"]') as HTMLSelectElement | null
      if (t) { t.value = 'EPT10'; t.dispatchEvent(new Event('change', { bubbles: true })) }
      const k = document.querySelector('select[name="epoxy_kind"]') as HTMLSelectElement | null
      let chosen = null
      if (k) { const o = Array.from(k.options).find((x) => x.value); if (o) { k.value = o.value; k.dispatchEvent(new Event('change', { bubbles: true })); chosen = o.value } }
      try { w.setIsPostpress && w.setIsPostpress('epoxy') } catch {}
      try { w.product1 && w.product1.calcuEstimate() } catch {}
      return chosen
    })
    await page.waitForTimeout(1500)
    result.epoxy_kind_chosen = epoxyKindChosen
    result.epoxy_amt = await amt('epoxy_amt')

    // osi
    await page.evaluate(() => {
      const w = window as any // eslint-disable-line
      const chk = document.getElementById('chk_is_osi') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      for (const [n, v] of [['osi_num', 'OSN01'], ['osi_direction', 'OMD10']]) { const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) } }
      try { w.setIsPostpress && w.setIsPostpress('osi') } catch {}
      try { w.product1 && w.product1.calcuEstimate() } catch {}
    })
    await page.waitForTimeout(1500)
    result.osi_amt = await amt('osi_amt')

    // missing
    await page.evaluate(() => {
      const w = window as any // eslint-disable-line
      const chk = document.getElementById('chk_is_missing') as HTMLInputElement | null
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
      for (const [n, v] of [['missing_num', 'MSN01'], ['missing_direction', 'OMD10']]) { const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null; if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) } }
      try { w.setIsPostpress && w.setIsPostpress('missing') } catch {}
      try { w.product1 && w.product1.calcuEstimate() } catch {}
    })
    await page.waitForTimeout(1500)
    result.missing_amt = await amt('missing_amt')
  } catch (e) { result.error = String(e) } finally {
    fs.writeFileSync(`${OUT}/verify-amt.json`, JSON.stringify(result, null, 2))
    await browser.close()
  }
  console.log(JSON.stringify(result, null, 2))
}
main()
