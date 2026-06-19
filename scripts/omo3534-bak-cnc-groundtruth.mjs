// OMO-3534: CNC1000 박 단가 그라운드트루스 표집 — TS 재구현(getBakPriceUnit/calcuBakPrice) 검증용.
// READ-ONLY. 폼에 알려진 입력(사이즈/박종/매수)을 세팅 → 성원 JS 가 채운 hidden
// bak_amt / bak_price_unit / dongpan_price 를 직독. 실주문/결제 0.
//
// 실행: cd /Users/william/projects/procardcrafters && \
//   node --env-file=/Users/william/procardcrafters/.env.local \
//     /Users/william/projects/pccf-omo3528/scripts/omo3534-bak-cnc-groundtruth.mjs

import * as fs from 'node:fs'
const BASE = 'https://www.swadpia.co.kr'
const OUT = '/Users/william/projects/pccf-omo3528/scripts/test-artifacts/omo3534'

// 검증 케이스: bak_type / bak 사이즈 / order_count 다양화. cut/매수는 폼 기본 선택값 사용.
const CASES = [
  { bak_type: 'BKT01', bak_x: 40, bak_y: 20, order_count: 1, bak_side: 'BKD10', bak_section: 'BKS10' },
  { bak_type: 'BKT06', bak_x: 50, bak_y: 30, order_count: 1, bak_side: 'BKD10', bak_section: 'BKS10' },
  { bak_type: 'BKT07', bak_x: 60, bak_y: 40, order_count: 1, bak_side: 'BKD10', bak_section: 'BKS10' },
  { bak_type: 'BKT18', bak_x: 50, bak_y: 30, order_count: 1, bak_side: 'BKD10', bak_section: 'BKS10' }, // 백박(80000)
  { bak_type: 'BKT01', bak_x: 40, bak_y: 20, order_count: 1, bak_side: 'BKD30', bak_section: 'BKS10' }, // 양면박
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const results = []
  try {
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      page.click('#icon_member_login'),
    ])
    await page.waitForTimeout(2500)

    for (const c of CASES) {
      // 케이스별 페이지 새로고침 — in-page 상태 carryover 제거(박 재계산 누락 방지).
      await page.goto(`${BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 45000 })
      for (const f of ['paper_kind', 'paper_code', 'paper_type', 'paper_size', 'size_code']) {
        await page.evaluate((n) => {
          const el = document.querySelector(`select[name="${n}"]`)
          if (!el) return
          const o = Array.from(el.options).find((x) => x.value && x.value !== '' && x.value !== '0')
          if (o) { el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })) }
        }, f)
        await page.waitForTimeout(300)
      }
      await page.evaluate(() => {
        const chk = document.getElementById('chk_is_bak')
        if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
        const w = window
        try { if (typeof w.setIsPostpress === 'function') w.setIsPostpress('bak') } catch { /* */ }
      })
      await page.waitForTimeout(900)
      const out = await page.evaluate((cas) => {
        const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) } }
        set('order_count', String(cas.order_count))
        set('bak_type_1', cas.bak_type); set('bak_type', cas.bak_type)
        set('bak_section_1', cas.bak_section); set('bak_section', cas.bak_section)
        set('bak_side_1', cas.bak_side); set('bak_side', cas.bak_side)
        set('bak_x_size_1', String(cas.bak_x)); set('bak_x_size', String(cas.bak_x))
        set('bak_y_size_1', String(cas.bak_y)); set('bak_y_size', String(cas.bak_y))
        const w = window
        // calcuBakPrice 직접 트리거(product1 의 bak 인스턴스). 후보 호출.
        try { w.product1 && w.product1.calcuEstimate && w.product1.calcuEstimate() } catch { /* */ }
        const g = (id) => { const el = document.getElementById(id); return el ? el.value : null }
        return {
          input: cas,
          paper_qty: g('paper_qty'),
          cut_x_size: g('cut_x_size'), cut_y_size: g('cut_y_size'),
          order_count: g('order_count'),
          bak_section: g('bak_section_1') || g('bak_section'),
          bak_side: g('bak_side_1') || g('bak_side'),
          bak_x_size: g('bak_x_size_1') || g('bak_x_size'),
          bak_y_size: g('bak_y_size_1') || g('bak_y_size'),
          bak_amt: g('bak_amt'), bak_amt_1: g('bak_amt_1'),
          bak_price: g('bak_price'), bak_price_unit: g('bak_price_unit'),
          dongpan_price: g('dongpan_price'), bak_add_unit_price: g('bak_add_unit_price'),
        }
      }, c)
      results.push(out)
      await page.waitForTimeout(600)
    }
    fs.writeFileSync(`${OUT}/cnc-groundtruth.json`, JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results, null, 2))
  } finally {
    await browser.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
