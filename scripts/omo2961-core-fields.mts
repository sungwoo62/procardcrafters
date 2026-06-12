/**
 * OMO-2961: 성원 명함폼 핵심(비후가공) 옵션 필드 전수 enumerate. READ-ONLY.
 * 우리 canonical 옵션(paper_code/print_color_type/paper_size/paper_qty)이 실제 폼필드와
 * 맞는지 + 디자인건수/order_count 등 우리가 안 채우는 필수필드가 있는지 확인.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2961-core-fields.mts
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
    // 용지 선택해 사이즈/수량 사다리 populate
    const pc = await page.$('select[name="paper_code"]')
    if (pc) { await pc.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find((x) => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(900) }

    result.fields = await page.evaluate(() => {
      // 후가공 패널(pnl_*) 내부 필드는 제외 — 핵심 옵션만
      const inFinishingPanel = (el: Element) => !!el.closest('[id^="pnl_"]')
      const labelFor = (el: Element): string => {
        // 가까운 라벨 추정: 부모 tr 의 th/첫 td, 또는 직전 라벨
        const tr = el.closest('tr')
        if (tr) { const th = tr.querySelector('th'); if (th) return (th.textContent || '').trim().slice(0, 30) }
        return ''
      }
      const out: Record<string, unknown>[] = []
      document.querySelectorAll('select[name]').forEach((e) => {
        const el = e as HTMLSelectElement
        if (inFinishingPanel(el)) return
        const opts = Array.from(el.options).filter((o) => o.value)
        out.push({
          kind: 'select', name: el.name, label: labelFor(el), optionCount: opts.length,
          sample: opts.slice(0, 4).map((o) => `${o.value}=${(o.textContent || '').trim()}`),
          current: el.value, hidden: el.offsetParent === null,
        })
      })
      // 텍스트/숫자/라디오 input (수량·건수·기타)
      document.querySelectorAll('input[name]').forEach((e) => {
        const el = e as HTMLInputElement
        if (inFinishingPanel(el)) return
        if (['hidden'].includes(el.type)) return
        if (el.type === 'radio' || el.type === 'checkbox') {
          out.push({ kind: el.type, name: el.name, label: labelFor(el), value: el.value, checked: el.checked, hidden: el.offsetParent === null })
        } else {
          out.push({ kind: el.type || 'text', name: el.name, label: labelFor(el), value: el.value, hidden: el.offsetParent === null })
        }
      })
      return out
    })

    // 디자인건수/order_count 후보 명시 탐색
    result.designCountCandidates = await page.evaluate(() => {
      const hits: Record<string, unknown>[] = []
      document.querySelectorAll('[name]').forEach((e) => {
        const el = e as HTMLInputElement
        if (/count|건수|디자인|order_cnt|design|jong|species|jongsu|종수|수량/i.test(el.name)) {
          hits.push({ name: el.name, tag: el.tagName, type: el.type, value: el.value })
        }
      })
      return hits
    })
  } catch (e) { result.error = String(e) } finally {
    fs.writeFileSync(`${OUT}/core-fields.json`, JSON.stringify(result, null, 2))
    await browser.close()
  }
  console.log('done')
}
main()
