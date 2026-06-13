/**
 * OMO-3064 — size-키 인터랙티브 견적경로 프로브 (OMO-3062 후속)
 *
 * 검증 가설(부모 OMO-3062 결과 기반):
 *   bare json_data POST 는 default size 매트릭스 하나만 반환 → 멀티사이즈 제품에서
 *   옵셋/디지털이 서로 다른 size 디폴트를 비교해 오라우팅. 따라서:
 *   (Q1) goods_view 인터랙티브(size 선택 → product1.calcuEstimate)로 **고객이 고른
 *        동일 size** 의 per-unit 가격을 두 프레스 코드에서 각각 취득할 수 있는가?
 *   (Q2) 토너 COD1000/COD1100 (json_data 에 print_unit2 매트릭스 부재)는
 *        calcuEstimate 인터랙티브로 가격이 잡히는가?
 *
 * 방법: 로그인 후 goods_view 로드 → size select·quantity 필드 동적 발견 →
 *   대표 size(첫/중간/끝) × 고정수량에서 size 설정+calcuEstimate→order_price_detail
 *   가격 추출. 두 프레스 코드의 동일 size 라벨을 교차해 같은 size 비교 가능성 판정.
 *   ⚠️ 최종 제출/파일업로드 없음 (실주문 미발생).
 *
 * 실행: node scripts/omo3064-probe.mjs            (전체)
 *       node scripts/omo3064-probe.mjs CPR2000    (단일 코드 디스커버리)
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS (.env.local SWADPIA_USERNAME/PASSWORD)'); process.exit(2) }

// 후보 멀티사이즈 듀얼프레스 쌍 + 토너 (OMO-3062 코멘트 가격표)
const PAIRS = {
  posters: { offset: 'CPR2000', digital: 'CDP4000' },
  leaflets: { offset: 'CPR3000', digital: 'CDP7000' },
  brochures: { offset: 'CLF2000', digital: 'CDP8000' },
  'saddle-stitch-booklet': { offset: 'CPR4000', digital: 'CDP5000' },
}
const TONER = ['COD1000', 'COD1100']
const FIXED_QTY = 1000 // size별 비교용 고정 수량

const ONLY = process.argv[2] || null

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR', viewport: { width: 1400, height: 1400 },
})
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER)
await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])
const loggedIn = !page.url().includes('/member/login')
console.log(`로그인: ${loggedIn ? 'OK' : 'FAIL'}`)

// ── 한 코드의 size 필드/수량 필드/product1/가격 추출 메커니즘 디스커버리 + size별 가격 ──
async function probeCode(code) {
  await page.goto(`${BASE}/goods/goods_view/${code}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)

  // 1) 구조 디스커버리
  const struct = await page.evaluate(() => {
    const w = window
    const out = { hasProduct1: false, p1methods: [], sizeSelects: [], qtyFields: [], priceGlobals: [] }
    try {
      if (w.product1 && typeof w.product1 === 'object') {
        out.hasProduct1 = true
        out.p1methods = Object.getOwnPropertyNames(Object.getPrototypeOf(w.product1) || {})
          .concat(Object.keys(w.product1)).filter(k => { try { return typeof w.product1[k] === 'function' } catch { return false } })
          .filter(k => /calcu|estimate|price|size|qty|set|change/i.test(k)).slice(0, 20)
      }
    } catch { /* */ }
    // size select 후보
    for (const s of Array.from(document.querySelectorAll('select'))) {
      if (/size|sajize|gyugyeok|kyu|norm|gyu/i.test(s.name) && s.options.length > 1) {
        out.sizeSelects.push({
          name: s.name, optCount: s.options.length,
          opts: Array.from(s.options).slice(0, 12).map(o => `${o.value}=${(o.text || '').trim().slice(0, 18)}`),
          onchange: (s.getAttribute('onchange') || '').slice(0, 60),
        })
      }
    }
    // 수량 필드 후보 (select 또는 input)
    for (const el of Array.from(document.querySelectorAll('select,input'))) {
      if (/quantity|qty|order_count|count|su_ryang|suryang|unit/i.test(el.name) && !/file|page/i.test(el.name)) {
        out.qtyFields.push({ tag: el.tagName, name: el.name, type: el.type || '', optCount: el.options ? el.options.length : undefined })
      }
    }
    // 가격 전역
    const opd = w['order_price_detail']
    if (opd && typeof opd === 'object') out.priceGlobals = Object.keys(opd).filter(k => /price|amt|pay|total|unit/i.test(k)).slice(0, 20)
    return out
  })

  const sizeSel = struct.sizeSelects[0]
  const result = { code, struct, sizeName: sizeSel?.name || null, prices: [] }
  if (!sizeSel) { result.note = 'size select 미발견'; return result }

  // 2) 대표 size(첫/중간/끝) × 고정수량 → calcuEstimate → 가격
  const allOpts = sizeSel.opts.map(o => o.split('=')[0]).filter(Boolean)
  const idxs = [...new Set([0, Math.floor(allOpts.length / 2), allOpts.length - 1])]
  for (const i of idxs) {
    const sizeVal = allOpts[i]
    const sizeLabel = sizeSel.opts[i]?.split('=')[1] || sizeVal
    const priced = await page.evaluate((p) => {
      const w = window
      const setF = (name, value) => {
        const el = document.querySelector(`[name="${name}"]`)
        if (!el) return false
        el.value = value
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
      setF(p.sizeName, p.sizeVal)
      // 수량: 발견된 첫 qty 필드에 주입(select면 가장 가까운 단계, input이면 값)
      if (p.qtyName) setF(p.qtyName, String(p.qty))
      try { w.product1 && w.product1.calcuEstimate && w.product1.calcuEstimate() } catch { /* */ }
      // 가격 읽기
      const opd = w['order_price_detail']
      const grab = (o) => {
        if (!o || typeof o !== 'object') return null
        for (const k of ['pay_amt', 'pay_price', 'unit_price', 'print_unit2', 'total_price', 'order_total_price', 'last_price', 'total']) {
          const v = o[k]
          const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v.replace(/[^0-9]/g, ''), 10) : NaN)
          if (Number.isFinite(n) && n >= 100) return { key: k, val: n }
        }
        return null
      }
      let hit = grab(opd)
      if (!hit) for (const k of ['pay_price', 'total_price', 'order_total_price', 'last_price', 'order_price']) {
        const v = w[k]; const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(String(v).replace(/[^0-9]/g, ''), 10) : NaN)
        if (Number.isFinite(n) && n >= 100) { hit = { key: 'win.' + k, val: n }; break }
      }
      return hit
    }, { sizeName: sizeSel.name, sizeVal, qtyName: struct.qtyFields[0]?.name || null, qty: FIXED_QTY })
    await page.waitForTimeout(700)
    result.prices.push({ sizeVal, sizeLabel, qty: FIXED_QTY, priced })
  }
  return result
}

const report = { loggedIn, fixedQty: FIXED_QTY, codes: {}, pairs: {}, toner: {} }

const codesToProbe = ONLY ? [ONLY] : [...new Set([...Object.values(PAIRS).flatMap(p => [p.offset, p.digital]), ...TONER])]
for (const code of codesToProbe) {
  console.log(`\n── probe ${code} ──`)
  const r = await probeCode(code)
  report.codes[code] = r
  console.log(`  product1=${r.struct.hasProduct1} methods=[${r.struct.p1methods.join(',')}]`)
  console.log(`  sizeSelect=${r.sizeName || '(없음)'} (${r.struct.sizeSelects[0]?.optCount || 0}opt) qtyFields=[${r.struct.qtyFields.map(q => q.name).join(',') || '(없음)'}]`)
  console.log(`  priceGlobals=[${r.struct.priceGlobals.join(',') || '(없음)'}]`)
  for (const p of r.prices) console.log(`    size ${String(p.sizeVal).padEnd(6)} ${String(p.sizeLabel).padEnd(18)} → ${p.priced ? p.priced.val + '원 (' + p.priced.key + ')' : 'none'}`)
}

// 쌍별 동일-size 비교 가능성 판정
if (!ONLY) {
  for (const [slug, { offset, digital }] of Object.entries(PAIRS)) {
    const ro = report.codes[offset], rd = report.codes[digital]
    const offSizes = new Set((ro?.struct.sizeSelects[0]?.opts || []).map(o => o.split('=')[1]))
    const digSizes = (rd?.struct.sizeSelects[0]?.opts || []).map(o => o.split('=')[1])
    const shared = digSizes.filter(s => offSizes.has(s))
    const offPriced = (ro?.prices || []).some(p => p.priced)
    const digPriced = (rd?.prices || []).some(p => p.priced)
    const verdict = offPriced && digPriced && shared.length > 0
      ? `✅ 인터랙티브 size-키 라우팅 가능 (공유 size ${shared.length}종)`
      : `⛔ 보류 (offPriced=${offPriced} digPriced=${digPriced} sharedSizes=${shared.length})`
    report.pairs[slug] = { offset, digital, offPriced, digPriced, sharedSizeCount: shared.length, verdict }
    console.log(`\n### ${slug}: ${verdict}`)
  }
  for (const code of TONER) {
    const r = report.codes[code]
    const priced = (r?.prices || []).some(p => p.priced)
    report.toner[code] = { priced, sizeName: r?.sizeName || null }
    console.log(`### 토너 ${code}: ${priced ? '✅ calcuEstimate 가격 취득' : '⛔ 인터랙티브 가격 미취득'}`)
  }
}

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo3064', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo3064/probe.json', JSON.stringify(report, null, 2))
console.log('\n저장: scripts/test-artifacts/omo3064/probe.json')
