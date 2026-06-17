// OMO-3411: 성원 박(foil) 가격 공식 라이브 RE — 면적/종류/면/section(동판)/레이어/수량 스윕.
//
// 목표(OMO-3409 보드 코멘트 파생): 박 단가가 무엇에 어떻게 의존하는지 실측 확정.
//   - 공식 REST JSON 없음(OMO-2647 확정). bak_amt 는 goods_view 클라이언트 JS
//     product1.ppBak(seq)/setPPBakAmtSum() 가 계산 → hidden bak_amt 직독.
//   - 본 스크립트는 (A) 공식 함수 본문 덤프 + (B) 변수 스윕 측정 을 한 번에 수행.
//
// 절대규칙: 가격은 hidden bak_amt/total_price 직독(OCR/LLM 금지). 최종 제출/업로드 없음(실주문 미발생).
//
// 실행:  node scripts/omo3411-bak-formula-sweep.mjs [CODE] [GOODS]
//   기본 CNC1000 GNC1001(명함, OMO-2647 검증 상품). .env.local 의 SWADPIA_USERNAME/PASSWORD 필요.
//
// 산출:  scripts/test-artifacts/omo3411/bak-sweep.json  (+ 콘솔 요약)
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
if (!USER || !PW) { console.error('NO CREDS — .env.local SWADPIA_USERNAME/PASSWORD 필요 (보드/CEO 발급 게이트)'); process.exit(2) }

// ── 스윕 차원 정의 (단일 레이어 _1 기준, 한 번에 한 변수만 변화) ───────────────
const BASELINE = { bak_section_1: 'BKS10', bak_side_1: 'BKD10', bak_type_1: 'BKT02', bak_compare_1: 'BAC10', bak_x_size_1: '50', bak_y_size_1: '30' }
// 1) 면적 곡선: 같은 종류/면, 면적만 스윕 → 선형 vs 구간(step) 판정
const AREA_POINTS = [[10, 10], [20, 20], [30, 20], [50, 30], [80, 50], [100, 100], [150, 100]]
// 2) 종류 델타: 대표 박 종류 (금/은/홀로그램/로즈골드/먹박)
const TYPES = ['BKT02', 'BKT01', 'BKT06', 'BKT11', 'BKT12', 'BKT16']
// 3) 면: 전/후/양
const SIDES = ['BKD10', 'BKD20', 'BKD30']
// 4) section(동판 신규 vs 보유동판) — 동판 setup-fee 게이트
const SECTIONS = ['BKS10', 'BKS20']
// 5) 수량: 페이지 수량 select 후보값 (런타임 옵션에서 가능한 값만 적용)
const QTYS = ['500', '1000', '2000', '5000']

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1400 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
const loggedIn = !page.url().includes('/member/login')
if (!loggedIn) { console.error('LOGIN FAILED'); await browser.close(); process.exit(3) }

const openProduct = async () => {
  await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
}

// (A) 공식 함수 본문 덤프 — product1 메서드 + 관련 글로벌. 오프라인 RE 갭(ppBak/setPPBakAmtSum) 보완.
const dumpFormula = () => page.evaluate(() => {
  const out = {}
  const tryStr = (obj, name) => { try { const f = obj && obj[name]; if (typeof f === 'function') out[name] = f.toString() } catch (e) { out[name] = 'ERR:' + e.message } }
  const p = window.product1
  for (const m of ['ppBak', 'setPPBakAmtSum', 'getPPBakAmt', 'getBakAmt', 'calcuBakPrice', 'getCutXSize', 'getCutYSize', 'getBakUnitPrice', 'getBakDongpanPrice']) tryStr(p, m)
  // product1 의 bak 관련 메서드 전수 수집
  if (p) { try { out._product1BakMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(p) || p).filter(k => /bak|dongpan|amt|cut/i.test(k)) } catch (e) { /* */ } }
  for (const g of ['calcuBakPrice', 'chgBakSize', 'chgBakSection', 'chgBakSide', 'chgBakType', 'chgBakExistDongpan', 'chgBakExistDongpanPrice', 'setPPBakAmtSum']) tryStr(window, g)
  return out
})

// 박 1레이어 활성화 + 필드설정 + 면적입력 → 재계산. select/input 모두 대응.
const applyBak = (fields) => page.evaluate(({ fields }) => {
  const setRes = {}
  const setF = (n, v) => {
    const e = document.querySelector(`select[name="${n}"]`) || document.querySelector(`input[name="${n}"]`) || document.getElementById(n)
    if (!e) return 'ABSENT'
    if (e.tagName === 'SELECT' && !Array.from(e.options).some(o => o.value === v)) return `NO_OPT(${Array.from(e.options).map(o => o.value).slice(0, 6).join('|')})`
    e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('keyup', { bubbles: true })); return 'SET'
  }
  for (const [n, v] of Object.entries(fields)) setRes[n] = setF(n, v)
  const chk = document.querySelector('#chk_is_bak'); if (chk) chk.checked = true
  try { window.$j && window.$j('#pnl_bak').show() } catch { /* */ }
  try { window.$j && window.$j('#pnl_bak1').show() } catch { /* */ }
  // 면적 변경 반영 → 박 재계산 시퀀스
  try { window.chgBakSize && window.chgBakSize(1) } catch { /* */ }
  try { window.setIsPostpress && window.setIsPostpress('bak') } catch { /* */ }
  try { window.product1 && window.product1.setPPBakAmtSum && window.product1.setPPBakAmtSum() } catch { /* */ }
  try { window.product1 && window.product1.calcuEstimate() } catch { /* */ }
  return setRes
}, { fields })

const readBak = () => page.evaluate(() => ({
  bak_amt: parseInt(($('bak_amt')?.value) || '0', 10),
  pay_amt: parseInt(($('pay_amt')?.value) || '0', 10),
  total_price: parseInt(($('total_price')?.value) || '0', 10),
  postpress_amt: parseInt(($('postpress_amt')?.value) || '0', 10),
  bak_x: ($('bak_x_size_1')?.value) || '', bak_y: ($('bak_y_size_1')?.value) || '',
}))

// 수량 select 후보(런타임). 측정 시 가능한 첫 필드만 사용.
const setQty = (q) => page.evaluate((q) => {
  for (const n of ['paper_amount', 'quantity', 'amount', 'paper_amt', 'count']) {
    const e = document.querySelector(`select[name="${n}"]`) || document.querySelector(`input[name="${n}"]`)
    if (e) { if (e.tagName === 'SELECT' && !Array.from(e.options).some(o => o.value === q)) continue; e.value = q; e.dispatchEvent(new Event('change', { bubbles: true })); return n }
  }
  return null
}, q)

// 한 측정점 실행: 새 페이지 로드 → (옵션 수량) → 박 적용 → 읽기
const measure = async (fields, qty) => {
  await openProduct()
  let qtyField = null
  if (qty) { qtyField = await setQty(qty); await page.waitForTimeout(1500) }
  const setRes = await applyBak(fields)
  await page.waitForTimeout(1200)
  await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate() } catch { /* */ } })
  await page.waitForTimeout(400)
  const st = await readBak()
  return { fields, qty, qtyField, setRes, ...st }
}

await openProduct()
const formula = await dumpFormula()

const sweep = { area: [], type: [], side: [], section: [], layers: [], qty: [] }

// 1) 면적 곡선
for (const [x, y] of AREA_POINTS) {
  const r = await measure({ ...BASELINE, bak_x_size_1: String(x), bak_y_size_1: String(y) })
  sweep.area.push({ x, y, areaMm2: x * y, bak_amt: r.bak_amt, ratePerMm2: r.bak_amt / (x * y), echo: { bak_x: r.bak_x, bak_y: r.bak_y } })
  console.log(`[AREA] ${x}x${y}=${x * y}mm² → bak_amt=${r.bak_amt} (${(r.bak_amt / (x * y)).toFixed(2)}/mm²)`)
}
// 2) 종류
for (const t of TYPES) {
  const r = await measure({ ...BASELINE, bak_type_1: t })
  sweep.type.push({ bak_type: t, bak_amt: r.bak_amt })
  console.log(`[TYPE] ${t} → bak_amt=${r.bak_amt}`)
}
// 3) 면
for (const s of SIDES) {
  const r = await measure({ ...BASELINE, bak_side_1: s })
  sweep.side.push({ bak_side: s, bak_amt: r.bak_amt })
  console.log(`[SIDE] ${s} → bak_amt=${r.bak_amt}`)
}
// 4) section(동판 신규/보유)
for (const s of SECTIONS) {
  const r = await measure({ ...BASELINE, bak_section_1: s })
  sweep.section.push({ bak_section: s, bak_amt: r.bak_amt })
  console.log(`[SECTION] ${s} → bak_amt=${r.bak_amt}`)
}
// 5) 레이어 2/3 합산 — settingExistBakDongpan(seq) 로 행 생성 후 동일 면적 반복
for (const layers of [1, 2, 3]) {
  await openProduct()
  const fields = { ...BASELINE }
  for (let i = 2; i <= layers; i++) {
    Object.assign(fields, { [`bak_section_${i}`]: 'BKS10', [`bak_side_${i}`]: 'BKD10', [`bak_type_${i}`]: 'BKT02', [`bak_compare_${i}`]: 'BAC10', [`bak_x_size_${i}`]: '50', [`bak_y_size_${i}`]: '30' })
  }
  await page.evaluate((n) => { try { for (let i = 2; i <= n; i++) window.settingExistBakDongpan && window.settingExistBakDongpan(i) } catch { /* */ } }, layers)
  await page.waitForTimeout(800)
  await applyBak(fields)
  await page.waitForTimeout(1000)
  await page.evaluate(() => { try { window.product1 && window.product1.setPPBakAmtSum(); window.product1.calcuEstimate() } catch { /* */ } })
  await page.waitForTimeout(400)
  const st = await readBak()
  sweep.layers.push({ layers, bak_amt: st.bak_amt })
  console.log(`[LAYERS] ${layers}레이어 → bak_amt=${st.bak_amt}`)
}
// 6) 수량
for (const q of QTYS) {
  const r = await measure({ ...BASELINE }, q)
  sweep.qty.push({ qty: q, qtyField: r.qtyField, bak_amt: r.bak_amt, total_price: r.total_price })
  console.log(`[QTY] ${q} (field=${r.qtyField}) → bak_amt=${r.bak_amt} total=${r.total_price}`)
}

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo3411', { recursive: true })
const artifact = { code: CODE, goods: GOODS, loggedIn, baseline: BASELINE, formula, sweep }
fs.writeFileSync('scripts/test-artifacts/omo3411/bak-sweep.json', JSON.stringify(artifact, null, 2))

// 간이 분석: 면적 선형 vs 구간 판정 + 동판 분해
const a = sweep.area.filter(p => p.bak_amt > 0)
if (a.length >= 2) {
  const lo = a[0], hi = a[a.length - 1]
  const slope = (hi.bak_amt - lo.bak_amt) / (hi.areaMm2 - lo.areaMm2)
  const intercept = lo.bak_amt - slope * lo.areaMm2
  console.log(`\n면적 모델: bak_amt ≈ ${intercept.toFixed(0)} + ${slope.toFixed(3)}·mm²  (intercept=동판/setup 추정, slope=면적단가)`)
  console.log(`현행 선형근사(14.87/mm², intercept=0) 검증: ${Math.abs(intercept) < 500 ? 'OK(원점통과)' : '⚠️ intercept≠0 → 동판 setup-fee 분리 필요'}`)
}
console.log('\nSAVED scripts/test-artifacts/omo3411/bak-sweep.json  loggedIn=' + loggedIn)
