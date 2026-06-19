// OMO-3557 (부모 OMO-3488): 비명함 surcharge 카테고리별 라이브 측정 — 수량 스윕 + 공식 fit.
//
// 진단 정정(OMO-3488 라이브 probe, category-form-probe.json):
//   hidden `*_amt` 필드명은 카테고리 간 일관(bak_amt/ap_amt/domusong_amt/…)이며
//   토글 chk_is_* 도 제공 후가공만큼 존재. 실제 갭은 두 가지였다:
//     (a) base-config(사이즈/용지/수량) 미설정 → 기준가가 0/불완전이라 postpress 미계산.
//     (b) 카테고리별 활성화 선행조건/패널 필드 차이(예: 스티커 박은 bak_side/compare 없고
//         bak_exist_dongpan 동판선택이 가격 주체) + 런타임 populate(chk click) 시퀀스.
//
// 본 스크립트는 omo3488-noncard-surcharge.mjs 의 readAmts/diffAmts/verdict 를 재사용하되:
//   1) setBaseConfig: 모든 base(비후가공) select 의 빈값을 첫 유효옵션으로 채워 기준가 확정.
//   2) applyFinishingFull: swadpia-order.ts activateFinishings 의 검증된 시퀀스를 이식
//      (chk click 런타임 populate, settingExistBakDongpan, 패널 내 모든 prefix select 첫유효,
//       exist_dongpan/size input 기본주입, numbering/epoxy kind 동적, setIsPostpress→calcuEstimate).
//   3) 수량 스윕: 카테고리 실제 qty 래더(paper_qty | bundle_qty)에서 4점 표집.
//   4) 공식 fit: amt = base + rate·qty (최소제곱) + R². rate≈0 → 정액(셋업비).
//
// 가격 결정론 절대규칙: 화면 OCR/LLM 추론 금지. hidden {type}_amt / pay_amt 직독만.
//   결제 직전 dry-run(제출/파일업로드 없음). 실발주(결제) 금지.
//
// 사용법:
//   node scripts/omo3557-noncard-surcharge-sweep.mjs               # 기본 5종 카테고리
//   node scripts/omo3557-noncard-surcharge-sweep.mjs CST1000 CLF1000
// 사전조건: .env.local 의 SWADPIA_USERNAME/PASSWORD (READ-ONLY dry-run), playwright chromium.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const goodsCode = (code) => 'G' + code.slice(1, -1) + '1'

const DEFAULT_TARGETS = [
  { code: 'CST1000', label: '스티커' },
  { code: 'CLF1000', label: '전단' },
  { code: 'CPR4000', label: '책자' },
  { code: 'CPR5000', label: '배너' },
  { code: 'CNC1000', label: '명함(control)' },
]

const AREA_BASE_KRW = 22300
const AREA_BASE_MM2 = 50 * 30 // 1,500
// 후가공 정의(omo3488 와 동일 기대값; 비교 기준은 명함 CNC1000 1,000매 라이브값)
const FIN = {
  foil_stamp: { ppType: 'bak', amt: 'bak_amt', model: 'area', expected: AREA_BASE_KRW,
    pref: { bak_section_1: 'BKS10', bak_side_1: 'BKD10', bak_type_1: 'BKT02', bak_compare_1: 'BAC10', bak_x_size_1: '50', bak_y_size_1: '30' } },
  deboss_emboss: { ppType: 'ap', amt: 'ap_amt', model: 'area', expected: AREA_BASE_KRW,
    pref: { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '50', ap_y_size_1: '30' } },
  die_cut: { ppType: 'domusong', amt: 'domusong_amt', model: 'flat', expected: 21500,
    pref: { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '1' } },
  drilled_hole: { ppType: 'tagong', amt: 'tagong_amt', model: 'flat', expected: 3800,
    pref: { tagong_num: '1', tagong_size: '4' } },
  round_corner: { ppType: 'guidori', amt: 'guidori_amt', model: 'flat', expected: 3000, pref: { guidori_type: 'GDR40' } },
  epoxy: { ppType: 'epoxy', amt: 'epoxy_amt', model: 'flat', expected: 22500, pref: { epoxy_type: 'EPT10' } },
  score_crease: { ppType: 'osi', amt: 'osi_amt', model: 'flat', expected: 7000, pref: { osi_num: 'OSN01', osi_direction: 'OMD10' } },
  perforation: { ppType: 'missing', amt: 'missing_amt', model: 'flat', expected: 7000, pref: { missing_num: 'MSN01', missing_direction: 'OMD10' } },
  numbering: { ppType: 'numbering', amt: 'numbering_amt', model: 'flat', expected: null, kindField: 'numbering_kind', pref: { numbering_type: 'NBT10' } },
}
const SUPPORTED = {
  CST1000: ['foil_stamp'],
  CLF1000: ['foil_stamp', 'deboss_emboss', 'die_cut', 'drilled_hole', 'epoxy', 'score_crease', 'perforation', 'numbering'],
  CPR4000: ['foil_stamp', 'deboss_emboss', 'die_cut', 'epoxy', 'round_corner', 'score_crease'],
  CPR5000: ['foil_stamp', 'deboss_emboss', 'die_cut', 'epoxy'],
  CNC1000: Object.keys(FIN),
}
// 카테고리별 수량 select 우선순위(probe 기준). bundle_qty(책자) 우선, 없으면 paper_qty.
const QTY_FIELDS = ['bundle_qty', 'paper_qty', 'paper_qty_select']
const RUNTIME_PP = ['guidori', 'epoxy', 'osi', 'missing']
const FIN_PREFIXES = ['bak_', 'dbak_', 'ap_', 'domusong_', 'tagong_', 'guidori_', 'epoxy_', 'osi_', 'missing_', 'numbering_', 'moghyeong_']

// ── env 로드 ──
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS: .env.local SWADPIA_USERNAME/PASSWORD 필요'); process.exit(2) }

const argCodes = process.argv.slice(2).filter((a) => /^C[A-Z]{2}\d{4}$/.test(a))
const TARGETS = argCodes.length ? argCodes.map((code) => ({ code, label: code })) : DEFAULT_TARGETS
// 실측 범위 캡(비현실적 대량 제외) + 후가공 필터(SWEEP_FINS=foil_stamp,die_cut …)
const QTY_CAP = Number(process.env.SWEEP_QTY_CAP || 5000)
const SWEEP_POINTS = Number(process.env.SWEEP_POINTS || 3)
const FIN_FILTER = (process.env.SWEEP_FINS || '').split(',').map((s) => s.trim()).filter(Boolean)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR', viewport: { width: 1400, height: 1200 },
})
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER)
await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
const loggedIn = !page.url().includes('/member/login')
if (!loggedIn) { console.error('LOGIN FAILED'); await browser.close(); process.exit(3) }

const readState = () => page.evaluate(() => ({
  pay: parseInt(($('pay_amt')?.value) || '0', 10),
  total: parseInt(($('total_price')?.value) || '0', 10),
  pp: parseInt(($('postpress_amt')?.value) || '0', 10),
}))
const readAmts = () => page.evaluate(() => {
  const out = {}
  for (const el of document.querySelectorAll('input[name$="_amt"], input[id$="_amt"]')) {
    const key = el.name || el.id; if (!key) continue
    const v = parseInt((el.value || '0'), 10); if (Number.isFinite(v)) out[key] = v
  }
  return out
})
const diffAmts = (before, after) => {
  const changed = []
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (k === 'postpress_amt' || k === 'pay_amt' || k === 'total_amt' || k === 'order_amt' || k === 'supply_amt' || k === 'tax_amt' || k === 'sale_amt' || k === 'risk_amt') continue
    const d = (after[k] || 0) - (before[k] || 0)
    if (d !== 0) changed.push({ field: k, before: before[k] || 0, after: after[k] || 0, delta: d })
  }
  return changed.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

// base-config: 모든 비후가공 select 의 빈값을 첫 유효옵션으로 채워 기준가 확정.
const setBaseConfig = (qtyFields, prefixes) => page.evaluate(({ qtyFields, prefixes }) => {
  const log = []
  const isFin = (n) => !n || prefixes.some((p) => n.startsWith(p)) || n.startsWith('chk_is_') || qtyFields.includes(n)
  for (const sel of document.querySelectorAll('select')) {
    const n = sel.name
    if (isFin(n)) continue
    const cur = sel.value
    if (cur && cur !== '0' && cur !== '') continue
    const first = Array.from(sel.options).map((o) => o.value).find((o) => o !== '' && o !== '0')
    if (first) { sel.value = first; sel.dispatchEvent(new Event('change', { bubbles: true })); log.push(`${n}=${first}`) }
  }
  try { window.product1 && window.product1.calcuEstimate() } catch { /* */ }
  return log
}, { qtyFields, prefixes })

// 수량 설정: 카테고리 실제 qty select 탐지 후 지정 수량 선택(없으면 가장 가까운 값).
const setQty = (qtyFields, want) => page.evaluate(({ qtyFields, want }) => {
  for (const name of qtyFields) {
    const sel = document.querySelector(`select[name="${name}"]`)
    if (!sel) continue
    const opts = Array.from(sel.options).map((o) => o.value).filter((v) => v && v !== '0')
    if (!opts.length) continue
    let chosen = opts.includes(String(want)) ? String(want)
      : opts.map(Number).filter(Number.isFinite).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0]
    chosen = String(chosen)
    sel.value = chosen; sel.dispatchEvent(new Event('change', { bubbles: true }))
    try { window.product1 && window.product1.calcuEstimate() } catch { /* */ }
    return { field: name, chosen: Number(chosen), opts: opts.map(Number) }
  }
  return null
}, { qtyFields, want })

// 검증된 활성화 시퀀스 이식 (swadpia-order.ts activateFinishings).
const applyFinishingFull = (cfg) => page.evaluate(({ cfg }) => {
  const w = window, log = []
  const setF = (n, v) => {
    const e = document.querySelector(`[name="${n}"]`)
    if (!e) return 'ABSENT'
    if (e.tagName === 'SELECT') {
      const opts = Array.from(e.options).map((o) => o.value)
      let val = v
      if (!opts.includes(v)) { const fv = opts.find((o) => o !== '' && o !== '0'); if (!fv) return `NO_OPT`; val = fv }
      e.value = val; e.dispatchEvent(new Event('change', { bubbles: true }))
      return val === v ? 'SET' : `FB(${val})`
    }
    e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); return 'SET'
  }
  const t = cfg.ppType, setRes = {}
  // 1) 활성화: 체크 + (런타임형) click populate + 패널 노출
  const chk = document.getElementById(`chk_is_${t}`); if (chk) chk.checked = true
  const chk2 = document.getElementById(`chk_is_${t}2`); if (chk2) chk2.checked = true
  if (chk) { chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
  try { w.$j && w.$j(`#pnl_${t}`).show() } catch { /* */ }
  if (t === 'bak') { for (let i = 2; i <= 1; i++) { try { w.settingExistBakDongpan && w.settingExistBakDongpan(i) } catch { /* */ } } }
  // 2) 선호 필드 적용
  for (const [n, v] of Object.entries(cfg.pref)) { if (n.endsWith('_kind')) continue; setRes[n] = setF(n, v) }
  // 2-b) 패널 내 prefix select 중 빈값 → 첫유효(카테고리별 필드명 차이 자동대응: exist_dongpan 등)
  for (const sel of document.querySelectorAll(`select[name^="${t}_"]`)) {
    const n = sel.name
    if (n.endsWith('_kind') || setRes[n]) continue
    if (sel.value && sel.value !== '0' && sel.value !== '') continue
    const first = Array.from(sel.options).map((o) => o.value).find((o) => o !== '' && o !== '0')
    if (first) { sel.value = first; sel.dispatchEvent(new Event('change', { bubbles: true })); setRes[n] = `AUTO(${first})` }
  }
  // 3) 넘버링/에폭시 kind 동적 populate
  if (t === 'numbering') {
    try { w.chgNumberingType && w.chgNumberingType() } catch { /* */ }
    const ke = document.querySelector('select[name="numbering_kind"]')
    if (ke) { const o = Array.from(ke.options).map((x) => x.value).filter(Boolean); if (o[0]) { ke.value = o[0]; ke.dispatchEvent(new Event('change', { bubbles: true })); setRes.numbering_kind = `K(${o[0]})` } }
  }
  if (t === 'guidori') {
    for (const i of [1, 2, 3, 4]) { const p = document.querySelector(`[name="guidori_position${i}"]`); if (p && !p.checked) { p.checked = true; p.dispatchEvent(new Event('click', { bubbles: true })); p.dispatchEvent(new Event('change', { bubbles: true })) } }
  }
  if (t === 'epoxy') {
    try { w.chgEpoxyType && w.chgEpoxyType() } catch { /* */ }
    const ke = document.querySelector('select[name="epoxy_kind"]')
    if (ke) { const o = Array.from(ke.options).map((x) => x.value).filter(Boolean); if (o[0]) { ke.value = o[0]; ke.dispatchEvent(new Event('change', { bubbles: true })); setRes.epoxy_kind = `K(${o[0]})` } }
  }
  // 4) 재계산
  try { w.setIsPostpress && w.setIsPostpress(t); log.push('setIsPostpress ok') } catch (e) { log.push('setIsPostpress ERR ' + e.message) }
  try { w.product1 && w.product1.calcuEstimate(); log.push('calcuEstimate ok') } catch (e) { log.push('calcuEstimate ERR ' + e.message) }
  return { setRes, log, chkExists: !!chk, runtime: ['guidori', 'epoxy', 'osi', 'missing'].includes(t) }
}, { cfg })

// 선형 최소제곱 fit: y = base + rate·x, R² 반환
function fitLinear(points) {
  const n = points.length
  if (n < 2) return null
  const xs = points.map((p) => p.qty), ys = points.map((p) => p.amt)
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0)
  const sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * ys[i], 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  const rate = (n * sxy - sx * sy) / denom
  const base = (sy - rate * sx) / n
  const meanY = sy / n
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0)
  const ssRes = ys.reduce((a, y, i) => a + (y - (base + rate * xs[i])) ** 2, 0)
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot
  return { base: Math.round(base), ratePerUnit: Number(rate.toFixed(5)), r2: Number(r2.toFixed(4)), n,
    flat: Math.abs(rate) < 1e-3, model: Math.abs(rate) < 1e-3 ? 'flat(setup)' : 'linear(base+rate·qty)' }
}

const TOL = 0.01
const report = { ranAt: new Date().toISOString(), loggedIn, base: BASE, tolerance: TOL, qtySweep: true, categories: [] }
const OUT_DIR = 'scripts/test-artifacts/omo3488'
fs.mkdirSync(OUT_DIR, { recursive: true })
const OUT_NAME = `noncard-surcharge${process.env.OUT_SUFFIX || ''}.json`
const flush = () => fs.writeFileSync(path.join(OUT_DIR, OUT_NAME), JSON.stringify(report, null, 2))
for (const t of TARGETS) {
  const goods = goodsCode(t.code)
  const url = `${BASE}/goods/goods_view/${t.code}/${goods}`
  let toTry = SUPPORTED[t.code] || Object.keys(FIN)
  if (FIN_FILTER.length) toTry = toTry.filter((f) => FIN_FILTER.includes(f))
  const catRow = { code: t.code, label: t.label, goods, url, qtyField: null, qtyLadder: [], finishings: {} }
  // 카테고리 qty 래더 1회 탐지(첫 진입)
  let ladder = []
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(2000)
    const probe = await page.evaluate((qf) => {
      for (const name of qf) { const s = document.querySelector(`select[name="${name}"]`); if (s) { const o = Array.from(s.options).map((x) => Number(x.value)).filter((v) => Number.isFinite(v) && v > 0); if (o.length) return { field: name, opts: o } } }
      return null
    }, QTY_FIELDS)
    if (probe) { catRow.qtyField = probe.field; ladder = probe.opts }
  } catch (e) { /* */ }
  // 실측 범위 캡 후 ~N점 표집(최소/최대 포함, 균등). 비현실적 대량(>QTY_CAP) 제외.
  const capped = ladder.filter((q) => q <= QTY_CAP)
  const usable = capped.length >= 2 ? capped : ladder.slice(0, 4)
  const pick = (arr, k) => { if (arr.length <= k) return arr; const out = []; for (let i = 0; i < k; i++) out.push(arr[Math.round(i * (arr.length - 1) / (k - 1))]); return [...new Set(out)] }
  const sweepQtys = pick(usable, SWEEP_POINTS)
  catRow.qtyLadder = sweepQtys
  console.log(`\n=== ${t.code} (${t.label}) qty=${catRow.qtyField} sweep=[${sweepQtys.join(',')}] ===`)

  for (const finValue of toTry) {
    const cfg = FIN[finValue]
    const series = []
    for (const qty of sweepQtys) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(2200)
        await setBaseConfig(QTY_FIELDS, FIN_PREFIXES)
        await page.waitForTimeout(400)
        const qtyRes = await setQty(QTY_FIELDS, qty)
        await page.waitForTimeout(700)
        const before = await readState(); const beforeAmts = await readAmts()
        const ap = await applyFinishingFull(cfg)
        await page.waitForTimeout(1100)
        await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate() } catch { /* */ } })
        await page.waitForTimeout(400)
        const after = await readState(); const afterAmts = await readAmts()
        const namedAmt = await page.evaluate((a) => parseInt(($(a)?.value) || '0', 10), cfg.amt)
        const changed = diffAmts(beforeAmts, afterAmts)
        const discovered = changed.find((c) => c.delta > 0) || null
        const amt = namedAmt > 0 ? namedAmt : (discovered ? discovered.delta : 0)
        const amtSource = namedAmt > 0 ? `named:${cfg.amt}` : (discovered ? `disc:${discovered.field}` : 'none')
        const payDelta = after.pay - before.pay
        const determinismOk = amt > 0 && Math.abs(amt - payDelta) <= Math.max(50, amt * TOL)
        series.push({ qty: qtyRes?.chosen ?? qty, amt, amtSource, payDelta, determinismOk, pp: after.pp, setRes: ap.setRes, log: ap.log })
        console.log(`  [${finValue}] qty=${qtyRes?.chosen ?? qty} amt=${amt}(${amtSource}) payΔ=${payDelta}${determinismOk ? '' : ' ⚠'}`)
      } catch (e) {
        series.push({ qty, error: String(e).slice(0, 160) })
        console.log(`  [${finValue}] qty=${qty} ERROR ${String(e).slice(0, 100)}`)
      }
    }
    const valid = series.filter((s) => !s.error && s.amt > 0 && s.determinismOk)
    const fit = fitLinear(valid.map((s) => ({ qty: s.qty, amt: s.amt })))
    catRow.finishings[finValue] = {
      ppType: cfg.ppType, amtField: cfg.amt, model: cfg.model, expected: cfg.expected,
      series, fit,
      verdict: valid.length === 0 ? 'NO_DATA'
        : (cfg.expected == null ? 'SAMPLED'
          : (fit && fit.flat && Math.abs(fit.base - cfg.expected) <= Math.max(50, cfg.expected * TOL) ? 'MATCH' : 'DIVERGE')),
    }
    if (fit) console.log(`    fit: ${fit.model} base=${fit.base} rate=${fit.ratePerUnit} R²=${fit.r2} → ${catRow.finishings[finValue].verdict}`)
  }
  report.categories.push(catRow); flush()
}
await browser.close()

// 요약
const summary = { match: [], diverge: [], sampled: [], noData: [], drift: [] }
for (const c of report.categories) for (const [fv, r] of Object.entries(c.finishings)) {
  const key = `${c.code}/${fv}`
  if (r.series.some((s) => s.amt > 0 && !s.determinismOk)) summary.drift.push(key)
  if (r.verdict === 'MATCH') summary.match.push(key)
  else if (r.verdict === 'DIVERGE') summary.diverge.push({ key, fit: r.fit, expected: r.expected })
  else if (r.verdict === 'SAMPLED') summary.sampled.push({ key, fit: r.fit })
  else summary.noData.push(key)
}
report.summary = summary
const outDir = OUT_DIR
flush()
console.log('\n=== SUMMARY ===')
console.log('MATCH  :', summary.match.join(', ') || '-')
console.log('DIVERGE:', summary.diverge.map((d) => `${d.key}(base ${d.fit?.base} rate ${d.fit?.ratePerUnit})`).join(', ') || '-')
console.log('SAMPLED:', summary.sampled.map((s) => `${s.key}(base ${s.fit?.base})`).join(', ') || '-')
console.log('DRIFT  :', summary.drift.join(', ') || '-')
console.log('NO_DATA:', summary.noData.join(', ') || '-')
console.log(`\nSAVED ${outDir}/${OUT_NAME}`)
