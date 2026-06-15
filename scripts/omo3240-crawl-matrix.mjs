/**
 * OMO-3240 — 성원 가격 매트릭스 크롤러 (오프라인 표집 + qty 보간).
 *
 * 부모 OMO-3239 스파이크(3 게이트 PASS) 근거:
 *  - 페이지 hidden `total_price`(order_form 직렬화 대상)가 size/paper/side/qty 조합별
 *    실제 장바구니 등록가다(멀티사이즈·디지털·토너 포함). OCR/LLM 미사용 = 결정론.
 *  - select 변경 후 networkidle + settle 를 강제(게이트2 교훈: recompute AJAX 정착 전 스냅 금지).
 *
 * 동작:
 *  1) Playwright 로그인 → 제품별 size·paper·side 전수 enumerate.
 *  2) 조합당 qty 4~6점만 라이브 표집(source='sampled'), 나머지 선택가능 qty 는
 *     piecewise-linear 보간(source='interpolated') → 조합폭발/요청량 억제.
 *  3) 매트릭스를 아티팩트 JSON 으로 적재(durable). --load 시 DB upsert(omo3240-load-matrix).
 *
 * 안전(이슈 주의):
 *  - 라이브-퍼-리퀘스트 금지 = 고객 가격경로용 아님. 본 크롤러는 오프라인 배치 표집만.
 *  - 실주문/장바구니 등록 금지: cart/regist POST 는 route 단계에서 abort(방어).
 *  - select 변경 사이 throttle(천천히 원칙) — DEFAULT_THROTTLE_MS.
 *
 * 사용:
 *   node scripts/omo3240-crawl-matrix.mjs --products CPR2000 --max-paper 2 --qty-points 4
 *   node scripts/omo3240-crawl-matrix.mjs                 # 전체 타깃 전수
 *   옵션: --products A,B  --max-paper N  --qty-points N  --max-size N  --no-side  --load  --headed
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const OUT_DIR = 'scripts/test-artifacts/omo3240'
const DEFAULT_THROTTLE_MS = 700 // select 변경 사이 최소 대기(천천히 원칙)

// .env.local 수동 파싱
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// ── 타깃 제품 설정 ─────────────────────────────────────────────────────
// 부모 스파이크 4항: 멀티사이즈(CPR2000/CPR3000/CPR4000/CLF2000) + 디지털(CDP*) + 토너(COD1000/COD1100).
// 단일포맷(명함/스티커/봉투/캘린더)은 기존 json_data 경로 유지 — 제외.
// 각 제품: 어느 select 가 size/paper/side/qty 인지. null/auto 면 런타임 discover.
const PRODUCT_CONFIG = {
  // 멀티사이즈(오프셋/경인쇄)
  CPR2000: { slug: 'posters', group: 'multisize', sizeField: 'paper_size', paperField: 'paper_code', sideField: 'print_method', qtyField: 'order_count' },
  CPR3000: { slug: 'leaflets', group: 'multisize', sizeField: 'paper_size', paperField: 'paper_code', sideField: 'print_method', qtyField: 'order_count' },
  CPR4000: { slug: 'saddle-stitch-booklet', group: 'multisize', sizeField: 'paper_size', paperField: 'paper_code', sideField: 'print_method', qtyField: 'order_count' },
  CLF2000: { slug: 'brochures', group: 'multisize', sizeField: 'paper_size', paperField: 'paper_code', sideField: 'print_method', qtyField: 'order_count' },
  // 디지털(인디고)
  CDP3000: { slug: 'postcards', group: 'digital', sizeField: 'size_type', paperField: 'paper_code', sideField: 'print_color_type', qtyField: 'order_count' },
  CDP4000: { slug: 'posters-digital', group: 'digital', sizeField: 'size_type', paperField: 'paper_code', sideField: 'print_color_type', qtyField: 'order_count' },
  // 토너(미니배너 등)
  COD1000: { slug: 'toner-1000', group: 'toner', sizeField: 'paper_size', paperField: 'paper_code', sideField: 'print_method', qtyField: 'order_count' },
  COD1100: { slug: 'mini-banners', group: 'toner', sizeField: 'paper_size', paperField: 'paper_code', sideField: 'print_method', qtyField: 'order_count' },
}

// ── CLI 파싱 ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { maxPaper: Infinity, maxSize: Infinity, qtyPoints: 5, products: null, side: true, load: false, headed: false, force: false, throttle: DEFAULT_THROTTLE_MS }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--products') a.products = argv[++i].split(',').map(s => s.trim().toUpperCase())
    else if (k === '--max-paper') a.maxPaper = parseInt(argv[++i], 10)
    else if (k === '--max-size') a.maxSize = parseInt(argv[++i], 10)
    else if (k === '--qty-points') a.qtyPoints = parseInt(argv[++i], 10)
    else if (k === '--no-side') a.side = false
    else if (k === '--load') a.load = true
    else if (k === '--force') a.force = true
    else if (k === '--headed') a.headed = true
    else if (k === '--throttle') a.throttle = parseInt(argv[++i], 10)
  }
  return a
}

// ── 보간: piecewise-linear ─────────────────────────────────────────────
// sampled = [{qty, total, paper, plate, print}] (qty 오름차순). 대상 qty 리스트의
// 비표집 qty 를 두 인접 표집점 사이에서 선형보간한다(범위 밖은 스킵 — 양 끝점은 항상 표집).
export function interpolateQty(sampled, targetQtys) {
  const pts = [...sampled].filter(p => Number.isFinite(p.qty) && Number.isFinite(p.total)).sort((x, y) => x.qty - y.qty)
  if (pts.length < 2) return []
  const have = new Set(pts.map(p => p.qty))
  const lerp = (a, b, q, key) => {
    const av = a[key], bv = b[key]
    if (!Number.isFinite(av) || !Number.isFinite(bv)) return null
    const t = (q - a.qty) / (b.qty - a.qty)
    return Math.round(av + (bv - av) * t)
  }
  const out = []
  for (const q of targetQtys) {
    if (have.has(q)) continue
    if (q < pts[0].qty || q > pts[pts.length - 1].qty) continue // 외삽 금지
    let lo = pts[0], hi = pts[pts.length - 1]
    for (let i = 0; i < pts.length - 1; i++) {
      if (q >= pts[i].qty && q <= pts[i + 1].qty) { lo = pts[i]; hi = pts[i + 1]; break }
    }
    out.push({
      qty: q,
      total: lerp(lo, hi, q, 'total'),
      paper: lerp(lo, hi, q, 'paper'),
      plate: lerp(lo, hi, q, 'plate'),
      print: lerp(lo, hi, q, 'print'),
      source: 'interpolated',
    })
  }
  return out
}

// 표집할 qty 포인트 선택: 양 끝점 + 내부 균등 분포(보간이 항상 범위 안이 되도록).
export function pickQtySamples(qtyOptions, n) {
  const qs = [...new Set(qtyOptions.filter(Number.isFinite))].sort((a, b) => a - b)
  if (qs.length <= n) return qs
  const idx = new Set([0, qs.length - 1])
  for (let i = 1; i < n - 1; i++) idx.add(Math.round((i * (qs.length - 1)) / (n - 1)))
  return [...idx].sort((a, b) => a - b).map(i => qs[i])
}

const toInt = v => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }

async function crawlProduct(page, code, cfg, a, helpers) {
  const { snap, settle, enumSelects, setSelect } = helpers
  await page.goto(`${BASE}/goods/goods_view/${code}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)

  const selects = await enumSelects()
  const byName = Object.fromEntries(selects.map(s => [s.name, s]))
  const present = (f) => byName[f] && byName[f].optCount > 1
  const sizeField = present(cfg.sizeField) ? cfg.sizeField : (selects.find(s => /size/i.test(s.name) && !/basis/i.test(s.name) && s.optCount > 1)?.name || null)
  const paperField = present(cfg.paperField) ? cfg.paperField : (['paper_code', 'paper_type'].find(present) || null)
  const sideField = a.side && present(cfg.sideField) ? cfg.sideField : null
  const qtyField = present(cfg.qtyField) ? cfg.qtyField : (present('order_count') ? 'order_count' : (present('paper_qty') ? 'paper_qty' : null))

  if (!qtyField) return { code, error: 'no qty field present', selects: selects.map(s => ({ name: s.name, optCount: s.optCount })) }

  const sizeOpts = sizeField ? byName[sizeField].options.filter(o => o.v).slice(0, a.maxSize) : [{ v: '', t: '(none)' }]
  const sideOpts = sideField ? byName[sideField].options.filter(o => o.v).slice(0, 2) : [{ v: '', t: '(none)' }]
  const qtyAll = byName[qtyField].options.filter(o => o.v).map(o => toInt(o.v)).filter(Number.isFinite)
  const qtySamplePoints = pickQtySamples(qtyAll, a.qtyPoints)

  const rows = []
  const meta = { code, slug: cfg.slug, group: cfg.group, sizeField, paperField, sideField, qtyField, qtyOptionCount: qtyAll.length, qtySamplePoints }

  for (const sz of sizeOpts) {
    if (sizeField) { await setSelect(sizeField, sz.v); await settle() }
    // size 변경이 paper 사다리를 리로드할 수 있어 paper 옵션은 size 마다 재열거
    const paperOpts = paperField
      ? (await enumSelects()).find(s => s.name === paperField)?.options.filter(o => o.v).slice(0, a.maxPaper) || [{ v: '', t: '(none)' }]
      : [{ v: '', t: '(none)' }]
    for (const pp of paperOpts) {
      if (paperField && pp.v) { await setSelect(paperField, pp.v); await settle() }
      for (const sd of sideOpts) {
        if (sideField && sd.v) { await setSelect(sideField, sd.v); await settle() }
        const sampled = []
        for (const q of qtySamplePoints) {
          await setSelect(qtyField, String(q))
          await settle()
          await page.waitForTimeout(a.throttle)
          const s = await snap()
          const screen = toInt(s.screen)
          const total = toInt(s.total)
          sampled.push({ qty: q, total, paper: toInt(s.paper), plate: toInt(s.plate), print: toInt(s.print), screen, parity: screen != null && total != null && screen === total, source: 'sampled' })
        }
        const side = sideField ? (/(양면|2|double)/i.test(sd.t) ? 2 : 1) : 1
        const combo = { size_code: sz.v || '', size_label: sz.t, paper_code: pp.v || '', paper_label: pp.t, side, side_label: sd.t }
        for (const s of sampled) rows.push({ ...combo, ...s })
        for (const r of interpolateQty(sampled, qtyAll)) rows.push({ ...combo, ...r })
      }
    }
  }
  // 패리티 게이트(OMO-3238 리뷰 권고): 화면 공급가를 읽은 표집행 중 크롤==화면 비율.
  const sampledRows = rows.filter(r => r.source === 'sampled')
  const withScreen = sampledRows.filter(r => Number.isFinite(r.screen))
  const parityMatch = withScreen.filter(r => r.parity).length
  const parity = { sampled: sampledRows.length, withScreen: withScreen.length, match: parityMatch, pass: withScreen.length > 0 && parityMatch === withScreen.length }
  return { ...meta, parity, rowCount: rows.length, sampledCount: sampledRows.length, interpolatedCount: rows.filter(r => r.source === 'interpolated').length, rows }
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  const targets = (a.products || Object.keys(PRODUCT_CONFIG)).filter(c => PRODUCT_CONFIG[c])
  if (!targets.length) { console.error('대상 제품 없음 (PRODUCT_CONFIG 확인)'); process.exit(1) }
  if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) { console.error('SWADPIA_USERNAME/PASSWORD 누락 (.env.local)'); process.exit(1) }

  const browser = await chromium.launch({ headless: !a.headed })
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1800 } })
  const page = await ctx.newPage()
  page.on('dialog', d => d.accept().catch(() => {}))

  // 방어: cart/regist POST 차단(장바구니 오염/실주문 금지). json_data 재계산 XHR 은 통과.
  await page.route('**/*', route => {
    const req = route.request()
    if (req.method() === 'POST' && /(goods_action=regist|goods_mode=cart|\/cart|\/order)/i.test(req.url() + (req.postData() || '')) && !/json_data/.test(req.url())) {
      return route.abort()
    }
    return route.continue()
  })

  // 로그인
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
  await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

  const v = name => page.evaluate(n => { const e = document.querySelector(`input[name="${n}"],#${n}`); return e ? e.value : null }, name)
  // 화면 공급가(고객/직원에게 보이는 숫자) — OMO-3238 리뷰 권고: hidden total_price 가 ground truth 임을
  // 매 표집마다 visible 공급가와 대조해 패리티 게이트(크롤==화면)를 아티팩트에 자기-인증한다.
  const visSupply = () => page.evaluate(() => { const e = document.getElementById('lbl_supply_amt'); return e ? e.textContent.trim() : null })
  const helpers = {
    snap: async () => ({ total: await v('total_price'), paper: await v('paper_price'), plate: await v('plate_price'), print: await v('print_price'), screen: await visSupply() }),
    settle: async () => { await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1200) },
    enumSelects: () => page.evaluate(() => Array.from(document.querySelectorAll('select')).map(s => ({
      name: s.name, id: s.id, optCount: s.options.length, selected: s.value,
      options: Array.from(s.options).map(o => ({ v: o.value, t: (o.textContent || '').trim().slice(0, 40) })),
    })).filter(s => s.name)),
    setSelect: async (name, value) => { await page.selectOption(`select[name="${name}"]`, value).catch(() => {}) },
  }

  const startedAt = new Date().toISOString()
  const results = []
  for (const code of targets) {
    process.stdout.write(`[crawl] ${code} ...`)
    try {
      const r = await crawlProduct(page, code, PRODUCT_CONFIG[code], a, helpers)
      results.push(r)
      const par = r.parity ? ` · 패리티 ${r.parity.match}/${r.parity.withScreen} ${r.parity.pass ? '✅' : '⚠️'}` : ''
      console.log(r.error ? ` ERROR: ${r.error}` : ` ${r.sampledCount} sampled + ${r.interpolatedCount} interp = ${r.rowCount} rows (${r.qtyOptionCount} qty opts)${par}`)
    } catch (e) {
      results.push({ code, error: String(e).slice(0, 300) })
      console.log(` EXCEPTION: ${String(e).slice(0, 120)}`)
    }
  }
  await browser.close()

  const finishedAt = new Date().toISOString()
  const sampledTotal = results.reduce((s, r) => s + (r.sampledCount || 0), 0)
  const interpTotal = results.reduce((s, r) => s + (r.interpolatedCount || 0), 0)
  // 적재 게이트: 화면 공급가를 읽은 모든 표집행에서 크롤==화면이어야 한다(OMO-3238 권고).
  const parityWith = results.reduce((s, r) => s + (r.parity?.withScreen || 0), 0)
  const parityMatch = results.reduce((s, r) => s + (r.parity?.match || 0), 0)
  const parityPass = parityWith > 0 && parityMatch === parityWith
  const artifact = {
    issue: 'OMO-3240', startedAt, finishedAt,
    args: { products: targets, maxPaper: a.maxPaper, maxSize: a.maxSize, qtyPoints: a.qtyPoints, side: a.side, throttle: a.throttle },
    summary: { products: targets.length, sampledTotal, interpolatedTotal: interpTotal, parity: { withScreen: parityWith, match: parityMatch, pass: parityPass } },
    results,
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = startedAt.replace(/[:.]/g, '-')
  const file = `${OUT_DIR}/matrix-${stamp}.json`
  fs.writeFileSync(file, JSON.stringify(artifact, null, 2))
  fs.writeFileSync(`${OUT_DIR}/matrix-latest.json`, JSON.stringify(artifact, null, 2))
  console.log(`\n[artifact] ${file}`)
  console.log(`[summary] ${targets.length} products · ${sampledTotal} sampled · ${interpTotal} interpolated`)
  console.log(`[parity] 크롤==화면 ${parityMatch}/${parityWith} ${parityPass ? '✅ 게이트 PASS' : '⚠️ 게이트 FAIL (적재 차단)'}`)

  if (a.load) {
    if (!parityPass && !a.force) {
      console.error('[load] ✗ 패리티 게이트 FAIL — 크롤≠화면 행이 있어 적재 차단(OMO-3238 권고). 강제 적재는 --force.')
      process.exit(2)
    }
    console.log('[load] DB 적재 시도 → omo3240-load-matrix.mjs')
    const { loadMatrix } = await import('./omo3240-load-matrix.mjs')
    await loadMatrix(artifact)
  } else {
    console.log('[hint] DB 적재: node scripts/omo3240-load-matrix.mjs (마이그 배포 후 · 패리티 PASS 시)')
  }
}

// CLI 직접 실행 시에만 크롤 시작(import 시 부작용 방지 — 보간/표집 함수 단위테스트용 export).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1) })
}
