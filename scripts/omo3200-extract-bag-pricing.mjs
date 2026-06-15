/**
 * OMO-3200 — 성원 쇼핑백 4종 수량별 실가격 추출 (calcuEstimate 인터랙티브).
 *
 * 배경: 쇼핑백 가격행렬(print_info1)은 paper_code 가 비고 unit_key 가 내부 index(1~100)라
 * json_data 정적 파싱으로는 수량↔단가 매핑 불가(OMO-3200). 대신 goods_view 를 라이브
 * 렌더해 성원 자체 견적 JS(chgPaperCode/chgPrintColor/chgPaperSize/chgPaperQty →
 * caluPaperPrice/caluPrintPrice/caluPlatePrice/caluTwinePrice → calcuEstimate)를 실행시키고
 * hidden input #supply_amt(부가세 전 공급가 = 우리가 성원에 내는 도매원가) 를 수량별로 읽는다.
 *
 * 추출 범위(v1): 각 code 의 기본 옵션(paper_code/print_color_type/paper_size = is_default)
 * 에서 paper_qty 전 수량을 sweep. 용지/사이즈 가격편차는 후속 리파인(현 모델은 base + 수량곡선).
 *
 * 출력: scripts/omo3200-bag-pricing.json
 * 실행: node scripts/omo3200-extract-bag-pricing.mjs
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'https://www.swadpia.co.kr'
// code → procardcrafters slug (OMO-3197 CATEGORY_MAP 과 일치)
const CODES = {
  CPK2000: { label: '리본&브레이드 쇼핑백', slug: 'gift-bags' },
  CPK4000: { label: '종이끈 쇼핑백', slug: 'paper-shopping-bags' },
  CPK3000: { label: '끈없는 쇼핑백', slug: 'handleless-bags' },
  CPK5000: { label: '소량 쇼핑백', slug: 'small-batch-bags' },
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  viewport: { width: 1400, height: 1400 },
})
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))

async function setSelect(name, value) {
  return page.evaluate(({ name, value }) => {
    const el = document.querySelector(`select[name="${name}"]`)
    if (!el || !Array.from(el.options).some((o) => o.value === value)) return false
    el.value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, { name, value })
}
// 성원 자체 견적 체인을 그대로 호출 (CPK5000 면적비례 특수로직 포함 정확).
async function recalc() {
  await page.evaluate(() => {
    const call = (n) => { try { typeof window[n] === 'function' && window[n]() } catch {} }
    call('chgPaperCode'); call('chgPrintColor'); call('chgPaperSize'); call('chgPaperQty')
    try { window.product1?.calcuEstimate?.() } catch {}
  })
}
async function readCost() {
  return page.evaluate(() => {
    const v = (id) => { const el = document.getElementById(id); if (!el) return null; const n = parseInt(String(el.value ?? el.textContent ?? '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null }
    return { supply_amt: v('supply_amt'), total_price: v('total_price'), pay_amt: v('pay_amt'), paper_price: v('paper_price'), print_price: v('print_price'), plate_price: v('plate_price'), make_price: v('make_price') }
  })
}
async function optionValues(name) {
  return page.evaluate((n) => {
    const el = document.querySelector(`select[name="${n}"]`)
    return el ? Array.from(el.options).filter((o) => o.value !== '').map((o) => ({ value: o.value, text: (o.textContent || '').replace(/\s+/g, ' ').trim() })) : []
  }, name)
}
async function defaultValue(name) {
  return page.evaluate((n) => {
    const el = document.querySelector(`select[name="${n}"]`)
    if (!el) return null
    const cur = el.value && el.value !== '' ? el.value : null
    const first = Array.from(el.options).map((o) => o.value).find((v) => v !== '')
    return cur ?? first ?? null
  }, name)
}

const out = { fetchedAt: new Date().toISOString().slice(0, 10), source: 'calcuEstimate interactive (supply_amt=부가세전 도매원가)', codes: {} }

for (const [code, meta] of Object.entries(CODES)) {
  try {
    await page.goto(`${BASE}/goods/goods_view/${code}/1`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(3000)
    const paper = await defaultValue('paper_code')
    const print = await defaultValue('print_color_type')
    const size = await defaultValue('paper_size')
    const qtys = await optionValues('paper_qty')
    if (paper) await setSelect('paper_code', paper)
    if (print) await setSelect('print_color_type', print)
    if (size) await setSelect('paper_size', size)
    await page.waitForTimeout(400)

    const matrix = []
    for (const q of qtys) {
      await setSelect('paper_qty', q.value)
      await recalc()
      await page.waitForTimeout(650)
      const c = await readCost()
      const qty = parseInt(q.value, 10)
      matrix.push({ quantity: qty, cost_krw: c.supply_amt, total_price: c.total_price, pay_amt: c.pay_amt, breakdown: { paper: c.paper_price, print: c.print_price, plate: c.plate_price, make: c.make_price } })
      console.error(`[${code}] qty=${String(qty).padEnd(7)} supply=${c.supply_amt} (paper=${c.paper_price} print=${c.print_price} plate=${c.plate_price} make=${c.make_price})`)
    }
    // 단조증가 sanity
    const costs = matrix.map((m) => m.cost_krw).filter((x) => x != null)
    const monotonic = costs.every((v, i) => i === 0 || v >= costs[i - 1])
    out.codes[code] = { ...meta, defaults: { paper_code: paper, print_color_type: print, paper_size: size }, monotonic, matrix }
    console.error(`[${code}] ${meta.label} — ${matrix.length}개 수량, 단조증가=${monotonic ? '✅' : '⚠️'}\n`)
  } catch (e) {
    out.codes[code] = { ...meta, error: e.message }
    console.error(`[${code}] ERR ${e.message}`)
  }
}

await browser.close()
const dest = new URL('./omo3200-bag-pricing.json', import.meta.url).pathname
writeFileSync(dest, JSON.stringify(out, null, 2))
console.error(`저장: ${dest}`)
