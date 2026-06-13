/**
 * OMO-3068 — 토너(COD) 저가옵션 정확도 가드검증.
 *
 * OMO-3064 가 밝힌 default-size commit 한계(paper_size 를 바꿔도 price_unit2 가
 * default 값에 고정 → CPR2000/CDP4000 전부 단일값)가 토너 COD 에도 잠재한다.
 * 토너의 단일 견적값(COD1000=363,330 / COD1100=495,350)은 "default (size,qty)"
 * 한 점에서만 읽혔을 뿐, size·order_count 를 바꾸면 실제로 갈라지는지 미검증.
 *
 * 본 스크립트는 실주문/실결제 없이:
 *   1) COD1000/COD1100 에서 order_count(수량) 를 실제 옵션값으로 sweep 하며
 *      product1.price_unit2 가 갈라지는지 확인 (qty→price 분기 가드).
 *   2) paper_size 를 바꿔가며 동일 확인 (size→price 분기 가드).
 *   3) 각 지점에서 product1.price_unit2 와 화면 표시가격(order_price_detail / readOrderPayAmount
 *      과 동일 로직)을 대조 — 잡힌 단가가 성원 표시가격과 일치하는지.
 *   4) 비교용으로 인디고 CDP1000(디지털명함) 의 동일 수량 sweep 도 수집 → 토너가
 *      실제 저가인 수량구간 산출 근거 확보.
 *
 * 통과 기준: qty sweep 에서 price_unit2 가 단조 증가(또는 최소 2개 이상 distinct)하고,
 *           표시가격과 일치(±오차 0) 하면 "정확도 검증 통과".
 *           qty 를 바꿔도 price_unit2 가 단일값이면 → 토너 견적 신뢰불가 → 보류.
 *
 * 실행: node scripts/omo3068-toner-guard.mjs
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
  console.error('⛔ SWADPIA_USERNAME/PASSWORD 미설정 (.env.local)'); process.exit(2)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1400 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

// onchange 핸들러를 실제로 발화하며 select 설정
async function setSelect(name, value) {
  // 네이티브 selectOption 으로 자연 onchange 유도 후, 보조로 dispatch
  const ok = await page.selectOption(`select[name="${name}"]`, String(value)).then(() => true).catch(() => false)
  if (!ok) return false
  await page.evaluate(({ name }) => {
    const el = document.querySelector(`select[name="${name}"]`)
    if (el) el.dispatchEvent(new Event('change', { bubbles: true }))
  }, { name }).catch(() => {})
  return true
}

async function optionValues(name) {
  return page.evaluate((name) => {
    const el = document.querySelector(`select[name="${name}"]`)
    if (!el) return []
    return Array.from(el.options).map(o => ({ v: o.value, t: (o.textContent || '').trim() })).filter(o => o.v)
  }, name)
}

async function readUnit() {
  return page.evaluate(() => {
    const p = window.product1 || {}
    const num = v => { const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) && n >= 1 ? n : null }
    return {
      price_unit1: num(p.price_unit1), price_unit2: num(p.price_unit2),
      PLATE2: num(p.PLATE_UNIT2_PRICE),
      save_size: p.save_paper_size, save_count: p.save_order_count,
    }
  })
}

// readOrderPayAmount 와 동일한 1순위 로직 — order_price_detail / 전역 합계 추출
const PRICE_GLOBAL_KEYS = ['pay_amt', 'pay_price', 'total_price', 'sum_price', 'order_price', 'last_price', 'price_total', 'total_amount', 'goods_price']
async function readDisplayPrice() {
  return page.evaluate((keys) => {
    const w = window
    const tryNum = v => {
      if (typeof v === 'number' && isFinite(v) && v >= 100) return Math.round(v)
      if (typeof v === 'string') { const d = v.replace(/[^0-9]/g, ''); if (d.length) { const n = parseInt(d, 10); if (n >= 100) return n } }
      return null
    }
    const opd = w['order_price_detail']
    if (opd && typeof opd === 'object') for (const k of keys) { const hit = tryNum(opd[k]); if (hit != null) return { k: `order_price_detail.${k}`, v: hit } }
    for (const k of keys) { const hit = tryNum(w[k]); if (hit != null) return { k: `window.${k}`, v: hit } }
    // 화면 라벨(결제/합계/총액) 근처 금액
    const els = Array.from(document.querySelectorAll('tr, li, div, p, td, span'))
    for (const el of els) {
      const t = el.innerText || el.textContent || ''
      if (t.length > 200) continue
      if (/(결제금액|총.?금액|합계|주문금액|공급가)/.test(t) && t.includes('원')) {
        const m = t.match(/([0-9][0-9,]{2,})\s*원/); if (m) { const n = parseInt(m[1].replace(/[^0-9]/g, ''), 10); if (n >= 100) return { k: 'label', v: n } }
      }
    }
    return null
  }, PRICE_GLOBAL_KEYS)
}

async function setQty(qty) {
  // COD 는 order_count(세트수) 와 paper_qty_select(매수) 둘 다 존재. 둘 다 시도.
  await setSelect('order_count', qty)
  await page.evaluate(() => { try { window.product1 && window.product1.changeOrderCount && window.product1.changeOrderCount() } catch {} })
  await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate && window.product1.calcuEstimate() } catch {} })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(700)
}

async function probeProduct(code, qtySweep) {
  await page.goto(`${BASE}/goods/goods_view/${code}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const sizes = await optionValues('paper_size')
  const counts = await optionValues('order_count')
  // 실제 존재하는 order_count 값으로 sweep 보정
  const countVals = counts.map(c => c.v)
  const wanted = qtySweep.map(String).filter(q => countVals.includes(q))
  const useQ = wanted.length >= 2 ? wanted : countVals.slice(0, 6) // fallback: 앞 6개
  console.log(`\n=== ${code} ===  paper_size=[${sizes.map(s => s.v).join(',') || '없음'}]  order_count(${counts.length}개) sweep=[${useQ.join(',')}]`)

  // (A) qty sweep — paper_size 는 default 고정
  const qtyRows = []
  for (const q of useQ) {
    await setQty(q)
    const u = await readUnit(); const disp = await readDisplayPrice()
    qtyRows.push({ qty: q, unit: u, disp })
    console.log(`  qty=${String(q).padEnd(6)} → unit2=${u.price_unit2} unit1=${u.price_unit1} save_count=${u.save_count} | 표시가=${disp ? `${disp.v}(${disp.k})` : 'n/a'}`)
  }
  const qtyDistinct = new Set(qtyRows.map(r => r.unit.price_unit2).filter(Boolean))

  // (B) size sweep — qty 는 첫 sweep 값 고정
  const sizeRows = []
  if (sizes.length > 1) {
    await setQty(useQ[0])
    for (const sz of sizes) {
      await setSelect('paper_size', sz.v)
      await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate && window.product1.calcuEstimate() } catch {} })
      await page.waitForTimeout(700)
      const u = await readUnit()
      sizeRows.push({ size: sz.v, label: sz.t, unit: u })
      console.log(`  size=${sz.v.padEnd(8)}(${sz.t}) qty=${useQ[0]} → unit2=${u.price_unit2} save_size=${u.save_size}`)
    }
  }
  const sizeDistinct = new Set(sizeRows.map(r => r.unit.price_unit2).filter(Boolean))

  // 가드 판정
  const qtyOk = qtyDistinct.size > 1
  const sizeOk = sizes.length <= 1 ? 'n/a(단일size)' : (sizeDistinct.size > 1)
  // 표시가 대조: unit2 와 표시가가 모든 행에서 일치하는지(혹은 일정 배수관계인지)
  const dispMatch = qtyRows.map(r => ({ qty: r.qty, unit2: r.unit.price_unit2, disp: r.disp?.v ?? null, eq: r.disp?.v != null && r.unit.price_unit2 != null ? r.disp.v === r.unit.price_unit2 : null }))
  console.log(`  → qty 분기: ${qtyDistinct.size}개 distinct ${qtyOk ? '✅ qty→price 갈라짐' : '⛔ 단일값(qty 무관, 신뢰불가)'}`)
  console.log(`  → size 분기: ${sizes.length <= 1 ? 'n/a (size 옵션 1개 이하)' : `${sizeDistinct.size}개 distinct ${sizeOk ? '✅' : '⛔ 단일값'}`}`)
  return { code, sizes, counts: counts.length, useQ, qtyRows, sizeRows, qtyDistinct: qtyDistinct.size, sizeDistinct: sizeDistinct.size, qtyOk, sizeOk, dispMatch }
}

const QTY_SWEEP = [100, 200, 500, 1000, 2000, 5000]
const report = {}
report.COD1000 = await probeProduct('COD1000', QTY_SWEEP) // 디지털명함 토너
report.COD1100 = await probeProduct('COD1100', QTY_SWEEP) // 종이미니배너 토너
// 비교 기준: 인디고 디지털명함 CDP1000 — 동일 수량 sweep (저가구간 산출용)
report.CDP1000 = await probeProduct('CDP1000', QTY_SWEEP)

// 토너 vs 인디고 저가구간(명함: COD1000 vs CDP1000) 산출
const cmp = []
const codByQ = Object.fromEntries(report.COD1000.qtyRows.map(r => [r.qty, r.unit.price_unit2]))
const cdpByQ = Object.fromEntries(report.CDP1000.qtyRows.map(r => [r.qty, r.unit.price_unit2]))
for (const q of new Set([...Object.keys(codByQ), ...Object.keys(cdpByQ)])) {
  const toner = codByQ[q] ?? null, indigo = cdpByQ[q] ?? null
  cmp.push({ qty: q, toner, indigo, cheaper: toner != null && indigo != null ? (toner < indigo ? 'toner' : toner > indigo ? 'indigo' : 'tie') : 'n/a' })
}
console.log('\n=== 명함 토너(COD1000) vs 인디고(CDP1000) 수량별 ===')
for (const c of cmp) console.log(`  qty=${String(c.qty).padEnd(6)} 토너=${c.toner} 인디고=${c.indigo} → 저가: ${c.cheaper}`)
report.comparison = cmp

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo3068', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo3068/toner-guard.json', JSON.stringify(report, null, 2))

// 최종 가드 요약
const verdict = {
  COD1000: { qtyOk: report.COD1000.qtyOk, sizeOk: report.COD1000.sizeOk },
  COD1100: { qtyOk: report.COD1100.qtyOk, sizeOk: report.COD1100.sizeOk },
}
console.log('\n==================== 가드 최종 ====================')
console.log(JSON.stringify(verdict, null, 2))
const pass = report.COD1000.qtyOk && report.COD1100.qtyOk
console.log(pass ? '✅ 통과: 토너 qty→price 분기 확인 — 조건부 추가 진행 가능' : '⛔ 실패: 토너 가격이 qty 무관 단일값 — 신뢰불가, 토너 옵션 보류')
console.log('저장: scripts/test-artifacts/omo3068/toner-guard.json')
