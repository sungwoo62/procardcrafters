/**
 * OMO-3240 — DB-스코프 가격 매트릭스 크롤러.
 *
 * 전수 enumerate 대신 **사이트가 실제 노출하는 옵션 집합**(print_product_options)만 크롤한다.
 * 근거: 성원은 제품당 paper 수십~수백종을 노출하지만(CLF2000=269) 우리 사이트는 큐레이션
 * 부분집합(brochures=4)만 제공한다. 매트릭스는 사이트가 요청 가능한 조합만 커버하면 된다.
 *  - slug → category_code 는 print_swadpia_mapping, 옵션 값은 print_product_options 에서 읽는다.
 *  - option_type 이 곧 성원 select name(paper_code/paper_size/paper_qty/print_color_type ...).
 *  - **수량 드라이버 = paper_qty**(있으면; OMO-3238 명함 리뷰 교훈 — order_count 아님). 사이트가
 *    딱 N개 수량만 노출하므로 전부 표집(보간 불필요·정확).
 *  - 매 표집행이 hidden total_price + 화면 공급가(lbl_supply_amt)를 대조(parity 게이트).
 *
 * 안전: regist/cart POST abort, throttle, 라이브-퍼-리퀘스트 아님(오프라인 배치).
 *
 * 사용:
 *   node scripts/omo3240-crawl-scoped.mjs --products CPR2000,CDP3000 --load
 *   node scripts/omo3240-crawl-scoped.mjs --load        # 전체 타깃(소규모 우선 정렬)
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const OUT_DIR = 'scripts/test-artifacts/omo3240'

const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// 타깃 category_code(멀티사이즈/디지털/토너). 단일포맷은 제외(기존 json_data 유지·회귀금지).
const TARGETS = ['CPR2000', 'CPR3000', 'CPR4000', 'CLF2000', 'CDP3000', 'CDP4000', 'COD1000', 'COD1100']

const toInt = v => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }
const sideFromLabel = lbl => /양면|double/i.test(lbl || '') ? 2 : 1

function parseArgs(argv) {
  const a = { products: null, load: false, headed: false, force: false, resume: false, throttle: 400 }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--products') a.products = argv[++i].split(',').map(s => s.trim().toUpperCase())
    else if (k === '--load') a.load = true
    else if (k === '--force') a.force = true
    else if (k === '--resume') a.resume = true // 이미 적재된 제품 스킵(heartbeat 경계 넘김)
    else if (k === '--headed') a.headed = true
    else if (k === '--throttle') a.throttle = parseInt(argv[++i], 10)
  }
  return a
}

// print_swadpia_mapping + print_product_options 에서 제품별 스코프(옵션 값 집합)를 만든다.
async function buildScopes(sb, targets) {
  const { data: maps } = await sb.from('print_swadpia_mapping')
    .select('slug,category_code,status,hidden_from_customer').in('category_code', targets)
  const byCode = {}
  for (const m of maps || []) {
    if (m.status !== 'verified' || m.hidden_from_customer) continue
    ;(byCode[m.category_code] ||= new Set()).add(m.slug)
  }
  const scopes = []
  for (const code of targets) {
    const slugs = [...(byCode[code] || [])]
    if (!slugs.length) { scopes.push({ code, slugs: [], skip: '사이트 매핑 없음(미노출 제품)' }); continue }
    const { data: prods } = await sb.from('print_products').select('id,slug').in('slug', slugs)
    const ids = (prods || []).map(p => p.id)
    if (!ids.length) { scopes.push({ code, slugs, skip: 'print_products 없음' }); continue }
    const { data: opts } = await sb.from('print_product_options')
      .select('option_type,value,label_ko').in('product_id', ids)
    // option_type 별 distinct value(라벨 유지)
    const byType = {}
    for (const o of opts || []) {
      if (o.value == null || o.value === '') continue
      const t = (byType[o.option_type] ||= new Map())
      if (!t.has(String(o.value))) t.set(String(o.value), o.label_ko || '')
    }
    const vals = t => [...(byType[t]?.entries() || [])].map(([v, label]) => ({ v, label }))
    const sizeField = byType.paper_size ? 'paper_size' : (byType.size_type ? 'size_type' : null)
    const paperField = byType.paper_code ? 'paper_code' : (byType.paper ? 'paper' : null)
    const sideField = byType.print_color_type ? 'print_color_type' : null
    const qtyField = byType.paper_qty ? 'paper_qty' : (byType.order_count ? 'order_count' : (byType.quantity ? 'quantity' : null))
    scopes.push({
      code, slugs,
      sizeField, paperField, sideField, qtyField,
      sizes: sizeField ? vals(sizeField) : [{ v: '', label: '(none)' }],
      papers: paperField ? vals(paperField) : [{ v: '', label: '(none)' }],
      sides: sideField ? vals(sideField) : [{ v: '', label: '(none)' }],
      qtys: qtyField ? vals(qtyField).map(o => ({ ...o, n: toInt(o.v) })).filter(o => Number.isFinite(o.n)) : [],
      comboCount: (sizeField ? vals(sizeField).length : 1) * (paperField ? vals(paperField).length : 1) * (sideField ? vals(sideField).length : 1),
    })
  }
  // 소규모 우선(조합수×qty 오름차순) — 하트비트 내 최대한 많은 제품 완료
  scopes.sort((a, b) => (a.comboCount * (a.qtys?.length || 1)) - (b.comboCount * (b.qtys?.length || 1)))
  return scopes
}

async function crawlScope(page, scope, helpers, a) {
  const { snap, settle, setSelect } = helpers
  await page.goto(`${BASE}/goods/goods_view/${scope.code}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  const rows = []
  let attempted = 0
  for (const sz of scope.sizes) {
    if (scope.sizeField && sz.v) { await setSelect(scope.sizeField, sz.v); await settle() }
    for (const pp of scope.papers) {
      if (scope.paperField && pp.v) { await setSelect(scope.paperField, pp.v); await settle() }
      for (const sd of scope.sides) {
        if (scope.sideField && sd.v) { await setSelect(scope.sideField, sd.v); await settle() }
        const side = scope.sideField ? sideFromLabel(sd.label) : 1
        for (const q of scope.qtys) {
          await setSelect(scope.qtyField, q.v); await settle(); await page.waitForTimeout(a.throttle)
          const s = await snap(); attempted++
          const total = toInt(s.total), screen = toInt(s.screen)
          rows.push({
            size_code: sz.v || '', size_label: sz.label, paper_code: pp.v || '', paper_label: pp.label,
            side, side_label: sd.label, qty: q.n, total, paper: toInt(s.paper), plate: toInt(s.plate), print: toInt(s.print),
            screen, parity: screen != null && total != null && screen === total, source: 'sampled',
          })
        }
      }
    }
  }
  const withScreen = rows.filter(r => Number.isFinite(r.screen))
  const match = withScreen.filter(r => r.parity).length
  const priced = rows.filter(r => Number.isFinite(r.total)).length
  return {
    code: scope.code, slug: scope.slugs[0] || null, qtyField: scope.qtyField,
    sizeField: scope.sizeField, paperField: scope.paperField, sideField: scope.sideField,
    parity: { sampled: rows.length, withScreen: withScreen.length, match, pass: withScreen.length > 0 && match === withScreen.length },
    attempted, priced, rowCount: rows.length, sampledCount: rows.length, interpolatedCount: 0, rows,
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('SUPABASE 키 누락'); process.exit(1) }
  if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) { console.error('SWADPIA 자격증명 누락'); process.exit(1) }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  const targets = (a.products || TARGETS).filter(c => TARGETS.includes(c))
  const scopes = await buildScopes(sb, targets)
  // --resume: 이미 paper_qty 기반 표집행이 기대치만큼 적재된 제품은 스킵(heartbeat 경계 복원).
  if (a.resume) {
    for (const s of scopes) {
      if (s.skip) continue
      const expect = s.comboCount * (s.qtys?.length || 0)
      const { count } = await sb.from('print_swadpia_price_matrix')
        .select('id', { count: 'exact', head: true })
        .eq('category_code', s.code).eq('source', 'sampled').contains('option_combo', { qty_field: s.qtyField })
      if ((count || 0) >= expect && expect > 0) s.skip = `이미 적재(${count}/${expect}행)`
    }
  }
  console.log('=== 스코프(사이트 노출 옵션) ===')
  for (const s of scopes) {
    if (s.skip) { console.log(`  ${s.code}: SKIP — ${s.skip}`); continue }
    console.log(`  ${s.code}: paper ${s.papers.length} × size ${s.sizes.length} × side ${s.sides.length} × qty ${s.qtys.length} = ${s.comboCount * s.qtys.length} 표집 (qtyField=${s.qtyField})`)
  }

  const browser = await chromium.launch({ headless: !a.headed })
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1800 } })
  const page = await ctx.newPage()
  page.on('dialog', d => d.accept().catch(() => {}))
  await page.route('**/*', route => {
    const req = route.request()
    if (req.method() === 'POST' && /(goods_action=regist|goods_mode=cart|\/cart|\/order)/i.test(req.url() + (req.postData() || '')) && !/json_data/.test(req.url())) return route.abort()
    return route.continue()
  })
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
  await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])

  const v = name => page.evaluate(n => { const e = document.querySelector(`input[name="${n}"],#${n}`); return e ? e.value : null }, name)
  const helpers = {
    snap: async () => ({ total: await v('total_price'), paper: await v('paper_price'), plate: await v('plate_price'), print: await v('print_price'), screen: await page.evaluate(() => { const e = document.getElementById('lbl_supply_amt'); return e ? e.textContent.trim() : null }) }),
    settle: async () => { await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(900) },
    setSelect: async (name, value) => { await page.selectOption(`select[name="${name}"]`, value).catch(() => {}) },
  }

  let loadOne = null
  if (a.load) { try { ({ loadMatrix: loadOne } = await import('./omo3240-load-matrix.mjs')) } catch {} }

  const startedAt = new Date().toISOString()
  const results = []
  for (const scope of scopes) {
    if (scope.skip) { results.push({ code: scope.code, error: scope.skip }); continue }
    process.stdout.write(`[crawl] ${scope.code} (${scope.comboCount * scope.qtys.length} 표집) ...`)
    try {
      const r = await crawlScope(page, scope, helpers, a)
      results.push(r)
      console.log(` priced ${r.priced}/${r.attempted} · 패리티 ${r.parity.match}/${r.parity.withScreen} ${r.parity.pass ? '✅' : '⚠️'}`)
      if (loadOne && (r.parity.pass || a.force) && r.priced > 0) {
        const res = await loadOne({ issue: 'OMO-3240', startedAt, finishedAt: new Date().toISOString(), results: [r] })
        console.log(`  └ [load] ${scope.code}: ${res.ok ? `upserted ${res.upserted}` : res.reason}`)
      } else if (loadOne) {
        console.log(`  └ [load] ${scope.code}: 건너뜀(패리티 ${r.parity.pass} priced ${r.priced})`)
      }
    } catch (e) {
      results.push({ code: scope.code, error: String(e).slice(0, 300) })
      console.log(` EXCEPTION: ${String(e).slice(0, 140)}`)
    }
  }
  await browser.close()

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = startedAt.replace(/[:.]/g, '-')
  const artifact = { issue: 'OMO-3240', mode: 'scoped', startedAt, finishedAt: new Date().toISOString(), summary: { products: results.length }, results }
  fs.writeFileSync(`${OUT_DIR}/scoped-${stamp}.json`, JSON.stringify(artifact, null, 2))
  fs.writeFileSync(`${OUT_DIR}/scoped-latest.json`, JSON.stringify(artifact, null, 2))
  const ok = results.filter(r => r.parity?.pass).length
  console.log(`\n[done] ${results.length} 제품 · 패리티 PASS ${ok} · artifact scoped-latest.json`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1) })
}
