// OMO-3511: 성원 후가공 가격공식 면밀 RE — 박(OMO-3411) RE 와 동일 방식.
//
// 목표: 1순위(미적재) 귀도리/에폭시/오시/미싱/넘버링 + 2순위(미검증) 박/형압/도무송/타공 의
//   결정론 가격함수(입력→KRW)와 경계를 실측 확정. 핵심 질문 = "수량 의존성"(정액 setup 인가,
//   매수 비례인가). OMO-3485 의 정액 surcharge 가 손해(under/over-charge)인지 판정한다.
//
// 절대규칙: 가격은 hidden {type}_amt / pay_amt / total_price 직독(OCR/LLM 금지).
//   최종 제출/파일업로드/결제 없음(실주문 미발생). 결제 직전 dry-run 도 안 감 — goods_view 조회만.
//
// 방법(OMO-3411 동형): (A) product1.pp{Type} 등 산식 함수 본문 덤프 +
//   (B) 입력축 스윕(수량 / 옵션) → {type}_amt 측정. 활성화 로직은 production
//   src/lib/swadpia-order.ts activateFinishings 를 1:1 재현(측정값=실발주값 보장).
//
// 실행:  node scripts/omo3511-finishing-formula-sweep.mjs [CODE] [GOODS]
//   기본 CNC1000 GNC1001(명함, 박 RE 와 동일 검증상품). .env.local SWADPIA_USERNAME/PASSWORD 필요.
// 산출:  scripts/test-artifacts/omo3511/finishing-sweep.json (+ 콘솔 요약)
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const CODE = process.argv[2] || 'CNC1000', GOODS = process.argv[3] || 'GNC1001'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS — .env.local SWADPIA_USERNAME/PASSWORD 필요'); process.exit(2) }

// ── 후가공 그룹 정의 (production FINISHING_GROUPS 와 동일) ──────────────────
const RUNTIME_PP = ['guidori', 'epoxy', 'osi', 'missing']
const AMT_FIELD = {
  guidori: 'guidori_amt', epoxy: 'epoxy_amt', osi: 'osi_amt', missing: 'missing_amt',
  numbering: 'numbering_amt', bak: 'bak_amt', ap: 'ap_amt', domusong: 'domusong_amt', tagong: 'tagong_amt',
}

// 각 후가공 기본 fieldMap (OMO-2961/박 RE 검증 기본값)
const DEFAULTS = {
  guidori: { guidori_type: 'GDR40' },
  epoxy: { epoxy_type: 'EPT10' },
  osi: { osi_num: 'OSN01', osi_direction: 'OMD10' },
  missing: { missing_num: 'MSN01', missing_direction: 'OMD10' },
  numbering: { numbering_type: 'NBT10', numbering_kind: 'NBN11' },
  bak: { bak_section_1: 'BKS10', bak_side_1: 'BKD10', bak_type_1: 'BKT02', bak_compare_1: 'BAC10', bak_x_size_1: '50', bak_y_size_1: '30' },
  ap: { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '50', ap_y_size_1: '30' },
  domusong: { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '1' },
  tagong: { tagong_num: '1', tagong_size: '4' },
}

const QTYS = ['200', '500', '1000', '2000', '5000']

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1600 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
const loggedIn = !page.url().includes('/member/login')
if (!loggedIn) { console.error('LOGIN FAILED'); await browser.close(); process.exit(3) }
console.log('loggedIn=' + loggedIn)

const openProduct = async () => {
  await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1800)
}

// (A) 산식 함수 본문 덤프 — product1.pp{Type} + 관련 글로벌/getter.
const dumpFormulas = () => page.evaluate(() => {
  const out = {}
  const tryStr = (obj, name, key) => { try { const f = obj && obj[name]; if (typeof f === 'function') out[key || name] = f.toString() } catch (e) { out[key || name] = 'ERR:' + e.message } }
  const p = window.product1
  // product1 의 후가공 관련 메서드 전수 인벤토리
  if (p) { try { out._product1Methods = Object.getOwnPropertyNames(Object.getPrototypeOf(p) || p).filter(k => /guidori|epoxy|osi|missing|numbering|bak|^ap|domusong|tagong|amt|price|calcu|pp/i.test(k)) } catch (e) { /* */ } }
  const ppNames = ['ppGuidori', 'ppEpoxy', 'ppOsi', 'ppMissing', 'ppNumbering', 'ppBak', 'ppAp', 'ppDomusong', 'ppTagong',
    'calcuGuidoriPrice', 'calcuEpoxyPrice', 'calcuOsiPrice', 'calcuMissingPrice', 'calcuNumberingPrice', 'calcuBakPrice', 'calcuApPrice', 'calcuDomusongPrice', 'calcuTagongPrice',
    'setPPBakAmtSum', 'setPPApAmtSum', 'getCutXSize', 'getCutYSize', 'calcuEstimate']
  for (const m of ppNames) tryStr(p, m)
  const globals = ['setIsPostpress', 'chgNumberingType', 'chgGuidoriType', 'chgEpoxyType', 'chgOsiNum', 'chgMissingNum', 'calcuEstimate']
  for (const g of globals) tryStr(window, g, 'g_' + g)
  return out
})

// 수량 설정 (paper_qty select). 적용 가능한 옵션만.
const setQty = (q) => page.evaluate((q) => {
  const e = document.querySelector('select[name="paper_qty"]') || document.querySelector('select[name="paper_qty_select"]')
  if (!e) return { field: null, applied: false, opts: [] }
  const opts = Array.from(e.options).map(o => o.value)
  if (!opts.includes(q)) return { field: e.name, applied: false, opts: opts.slice(0, 12) }
  e.value = q; e.dispatchEvent(new Event('change', { bubbles: true }))
  return { field: e.name, applied: true, opts: opts.slice(0, 12) }
}, q)

// 단일 후가공 활성화 (production activateFinishings 1:1 재현)
const activate = (ppType, fieldMap) => page.evaluate(({ ppType, fieldMap, RUNTIME_PP }) => {
  const w = window
  const setField = (name, value) => {
    const el = document.querySelector(`[name="${name}"]`)
    if (!el) return 'ABSENT'
    if (el.tagName === 'SELECT' && !Array.from(el.options).some(o => o.value === value)) return 'NO_OPT(' + Array.from(el.options).map(o => o.value).filter(Boolean).slice(0, 8).join('|') + ')'
    el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); return 'SET'
  }
  const res = {}
  const chk = document.getElementById(`chk_is_${ppType}`)
  if (chk) chk.checked = true
  const chk2 = document.getElementById(`chk_is_${ppType}2`); if (chk2) chk2.checked = true
  if (chk && RUNTIME_PP.indexOf(ppType) !== -1) {
    chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true }))
  }
  try { w.$j && w.$j(`#pnl_${ppType}`).show() } catch { /* */ }
  if (ppType === 'bak' || ppType === 'ap') {
    let maxLayer = 1
    for (const f of Object.keys(fieldMap)) { const m = f.match(/_x_size_(\d+)$/); if (m) maxLayer = Math.max(maxLayer, Number(m[1])) }
    for (let i = 2; i <= maxLayer; i++) { try { if (ppType === 'bak') w.settingExistBakDongpan && w.settingExistBakDongpan(i) } catch { /* */ } }
  }
  for (const [n, v] of Object.entries(fieldMap)) { if (n.endsWith('_kind')) continue; res[n] = setField(n, v) }
  if (ppType === 'numbering') {
    try { w.chgNumberingType && w.chgNumberingType() } catch { /* */ }
    const ke = document.querySelector('select[name="numbering_kind"]')
    if (ke) { const opts = Array.from(ke.options).map(o => o.value).filter(Boolean); const want = fieldMap['numbering_kind']; const chosen = want && opts.includes(want) ? want : opts[0] || ''; if (chosen) { ke.value = chosen; ke.dispatchEvent(new Event('change', { bubbles: true })); res._numbering_kind = chosen + ' [opts:' + opts.join('|') + ']' } else { res._numbering_kind = 'EMPTY' } }
    else res._numbering_kind = 'NO_SELECT'
  }
  if (ppType === 'guidori') {
    for (const i of [1, 2, 3, 4]) { const pp = document.querySelector(`[name="guidori_position${i}"]`); if (pp && !pp.checked) { pp.checked = true; pp.dispatchEvent(new Event('click', { bubbles: true })); pp.dispatchEvent(new Event('change', { bubbles: true })) } }
  }
  if (ppType === 'epoxy') {
    const ke = document.querySelector('select[name="epoxy_kind"]')
    if (ke) { const opts = Array.from(ke.options).map(o => o.value).filter(Boolean); const want = fieldMap['epoxy_kind']; const chosen = want && opts.indexOf(want) !== -1 ? want : opts[0] || ''; if (chosen) { ke.value = chosen; ke.dispatchEvent(new Event('change', { bubbles: true })); res._epoxy_kind = chosen + ' [opts:' + opts.join('|') + ']' } else res._epoxy_kind = 'EMPTY' }
    else res._epoxy_kind = 'NO_SELECT'
  }
  try { w.setIsPostpress && w.setIsPostpress(ppType) } catch { /* */ }
  try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
  return res
}, { ppType, fieldMap, RUNTIME_PP })

const readAmt = (ppType) => page.evaluate((amtField) => {
  const g = (n) => { const e = document.querySelector(`[name="${n}"]`) || document.getElementById(n); return e ? parseInt(e.value || '0', 10) || 0 : null }
  return { amt: g(amtField), pay_amt: g('pay_amt'), total_price: g('total_price'), postpress_amt: g('postpress_amt') }
}, AMT_FIELD[ppType])

// 한 측정점: 페이지 로드 → (수량) → 후가공 활성화 → 읽기
const measure = async (ppType, fieldMap, qty) => {
  await openProduct()
  let qtyInfo = null
  if (qty) { qtyInfo = await setQty(qty); await page.waitForTimeout(1200) }
  const setRes = await activate(ppType, fieldMap)
  await page.waitForTimeout(900)
  await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate() } catch { /* */ } })
  await page.waitForTimeout(300)
  const st = await readAmt(ppType)
  return { ppType, fieldMap, qty, qtyInfo, setRes, ...st }
}

await openProduct()
const formulas = await dumpFormulas()
console.log('formula methods:', JSON.stringify(formulas._product1Methods || []).slice(0, 400))

const out = { code: CODE, goods: GOODS, loggedIn, qtySweep: {}, optionSweep: {} }

// ── 1) 수량 스윕 (전 후가공 기본설정) — "정액 vs 매수비례" 판정 (핵심) ──────────
const QTY_TARGETS = ['guidori', 'epoxy', 'osi', 'missing', 'numbering', 'bak', 'ap', 'domusong', 'tagong']
for (const t of QTY_TARGETS) {
  out.qtySweep[t] = []
  for (const q of QTYS) {
    const r = await measure(t, DEFAULTS[t], q)
    out.qtySweep[t].push({ qty: q, applied: r.qtyInfo?.applied, amt: r.amt, pay_amt: r.pay_amt })
    console.log(`[QTY ${t}] q=${q}(${r.qtyInfo?.applied ? 'OK' : 'NA:' + (r.qtyInfo?.opts || []).join(',')}) → ${AMT_FIELD[t]}=${r.amt} pay=${r.pay_amt}`)
  }
}

// ── 2) 옵션 스윕 (1순위 5종 + 2순위 형압/도무송/타공; 박은 OMO-3411) ──────────
const OPTION_SWEEPS = {
  guidori: [
    ['GDR10', { guidori_type: 'GDR10' }], ['GDR20', { guidori_type: 'GDR20' }], ['GDR30', { guidori_type: 'GDR30' }], ['GDR40', { guidori_type: 'GDR40' }],
    ['GDR50(6mm)', { guidori_type: 'GDR50' }], ['GDR80(6mm)', { guidori_type: 'GDR80' }],
  ],
  epoxy: [
    ['EPT10전', { epoxy_type: 'EPT10' }], ['EPT20후', { epoxy_type: 'EPT20' }], ['EPT30양', { epoxy_type: 'EPT30' }],
  ],
  osi: [
    ['OSN01', { osi_num: 'OSN01', osi_direction: 'OMD10' }], ['OSN02', { osi_num: 'OSN02', osi_direction: 'OMD10' }], ['OSN03', { osi_num: 'OSN03', osi_direction: 'OMD10' }], ['OSN04십자', { osi_num: 'OSN04', osi_direction: 'OMD10' }],
    ['OSN01세로', { osi_num: 'OSN01', osi_direction: 'OMD20' }],
  ],
  missing: [
    ['MSN01', { missing_num: 'MSN01', missing_direction: 'OMD10' }], ['MSN02', { missing_num: 'MSN02', missing_direction: 'OMD10' }], ['MSN03', { missing_num: 'MSN03', missing_direction: 'OMD10' }], ['MSN04십자', { missing_num: 'MSN04', missing_direction: 'OMD10' }],
  ],
  numbering: [
    ['NBT10/NBN11', { numbering_type: 'NBT10', numbering_kind: 'NBN11' }], ['NBT10/NBN12', { numbering_type: 'NBT10', numbering_kind: 'NBN12' }],
    ['NBT10/NBN13끝까지', { numbering_type: 'NBT10', numbering_kind: 'NBN13' }], ['NBT20난수', { numbering_type: 'NBT20', numbering_kind: 'NBN11' }],
  ],
  ap: [
    ['10x10', { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '10', ap_y_size_1: '10' }],
    ['50x30', { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '50', ap_y_size_1: '30' }],
    ['100x100', { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '100', ap_y_size_1: '100' }],
    ['APS20보유동판', { ap_section_1: 'APS20', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '50', ap_y_size_1: '30' }],
    ['APT20뒤돌출', { ap_section_1: 'APS10', ap_type_1: 'APT20', ap_compare_1: 'BAC10', ap_x_size_1: '50', ap_y_size_1: '30' }],
  ],
  domusong: [
    ['DMS20전체/1', { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '1' }],
    ['DMS21부분/1', { domusong_section: 'DMS21', domusong_type: 'DMT51', domusong_num: '1' }],
    ['num=2', { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '2' }],
    ['num=4', { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '4' }],
    ['DMT53사물', { domusong_section: 'DMS20', domusong_type: 'DMT53', domusong_num: '1' }],
  ],
  tagong: [
    ['1개4mm', { tagong_num: '1', tagong_size: '4' }], ['2개4mm', { tagong_num: '2', tagong_size: '4' }], ['4개4mm', { tagong_num: '4', tagong_size: '4' }],
    ['1개8mm', { tagong_num: '1', tagong_size: '8' }],
  ],
}
for (const [t, cases] of Object.entries(OPTION_SWEEPS)) {
  out.optionSweep[t] = []
  for (const [label, fm] of cases) {
    const r = await measure(t, fm, '1000') // 옵션 스윕은 1,000매 고정
    out.optionSweep[t].push({ label, fieldMap: fm, amt: r.amt, pay_amt: r.pay_amt, setRes: r.setRes })
    console.log(`[OPT ${t}] ${label} → ${AMT_FIELD[t]}=${r.amt}`)
  }
}

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo3511', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo3511/finishing-sweep.json', JSON.stringify({ ...out, formulas }, null, 2))
console.log('\nSAVED scripts/test-artifacts/omo3511/finishing-sweep.json')
