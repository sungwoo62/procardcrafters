// OMO-3488: 후가공 surcharge(공급가) 모델의 비명함 카테고리 라이브 검증.
//
// 부모 OMO-3483 전수검사. finishing-surcharge.ts 의 면적모델(foil/deboss
// ratePerMm2 @50×30mm 기준 ₩22,300)·정액(die_cut ₩21,500 / drilled_hole ₩3,800)
// 및 OMO-3485 5종(귀도리/에폭시/오시/미싱)은 **명함 CNC1000 에서만 라이브 검증**됐다.
// 본 스크립트는 대표 비명함 카테고리에서 hidden amt(bak_amt/ap_amt/domusong_amt/
// tagong_amt/…)를 표집해 동일 단가 성립 여부를 검증하고, 카테고리별 계수 필요성을 산출한다.
//
// 가격 결정론 절대규칙 준수:
//   - 화면 OCR/LLM 추론 금지. hidden {type}_amt / total_price / pay_amt 직독만.
//   - 결제 직전 dry-run(파일 업로드·제출 없음). 실발주(결제) 금지.
//
// 시퀀스(omo2647-extract-surcharge.mjs 와 동일 검증 경로를 카테고리 일반화):
//   1) goods_view 진입(런타임 옵션 populate) → 2) 후가공 select 값 설정(선호코드,
//      미존재 시 첫 유효옵션 fallback) → 3) chk_is_{type} 체크 + 패널 show →
//   4) setIsPostpress(type) → product1.calcuEstimate() → 5) hidden {type}_amt + pay_amt 측정.
//
// 사용법:
//   node scripts/omo3488-noncard-surcharge.mjs            # 기본 5종 카테고리(아래 TARGETS)
//   node scripts/omo3488-noncard-surcharge.mjs CST1000 CLF1000   # 특정 카테고리만
// 사전조건:
//   - .env.local 에 SWADPIA_USERNAME / SWADPIA_PASSWORD (READ-ONLY dry-run 계정)
//   - playwright 설치(npx playwright install chromium)
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'

// ── 검증 대상 카테고리(비명함) + CNC1000 컨트롤 ──────────────────────────────
//   goods_code = 'G' + categoryCode.slice(1,-1) + '1' (swadpia.ts swadpiaGoodsCode 와 동일)
const goodsCode = (code) => 'G' + code.slice(1, -1) + '1'
const DEFAULT_TARGETS = [
  { code: 'CST1000', label: '스티커' },
  { code: 'CLF1000', label: '전단' },
  { code: 'CPR4000', label: '책자' },
  { code: 'CPR5000', label: '배너' },
  { code: 'CNC1000', label: '명함(control)' },
]

// ── 후가공 검증 정의 ─────────────────────────────────────────────────────────
//   선호 필드코드는 DEFAULT_FINISHING_FIELD_VALUES(swadpia-finishing-fields.ts) 기준.
//   카테고리별로 옵션값이 다를 수 있으므로, 선호코드 미존재 시 첫 유효옵션으로 fallback.
//   expected: 현행 모델(finishing-surcharge.ts)이 비명함에도 성립한다고 가정한 기대 amt.
const AREA_BASE_KRW = 22300
const AREA_BASE_MM2 = 50 * 30 // 1,500
const FIN = {
  foil_stamp: {
    ppType: 'bak', amt: 'bak_amt', model: 'area',
    expected: AREA_BASE_KRW, // @50×30mm
    pref: { bak_section_1: 'BKS10', bak_side_1: 'BKD10', bak_type_1: 'BKT02', bak_compare_1: 'BAC10', bak_x_size_1: '50', bak_y_size_1: '30' },
    sizeFields: ['bak_x_size_1', 'bak_y_size_1'],
  },
  deboss_emboss: {
    ppType: 'ap', amt: 'ap_amt', model: 'area',
    expected: AREA_BASE_KRW,
    pref: { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '50', ap_y_size_1: '30' },
    sizeFields: ['ap_x_size_1', 'ap_y_size_1'],
  },
  die_cut: {
    ppType: 'domusong', amt: 'domusong_amt', model: 'flat', expected: 21500,
    pref: { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '1' },
  },
  drilled_hole: {
    ppType: 'tagong', amt: 'tagong_amt', model: 'flat', expected: 3800,
    pref: { tagong_num: '1', tagong_size: '4' },
  },
  // OMO-3485 5종 비명함 재확인
  round_corner: { ppType: 'guidori', amt: 'guidori_amt', model: 'flat', expected: 3000, pref: { guidori_type: 'GDR40' } },
  epoxy: { ppType: 'epoxy', amt: 'epoxy_amt', model: 'flat', expected: 22500, pref: { epoxy_type: 'EPT10' } },
  score_crease: { ppType: 'osi', amt: 'osi_amt', model: 'flat', expected: 7000, pref: { osi_num: 'OSN01', osi_direction: 'OMD10' } },
  perforation: { ppType: 'missing', amt: 'missing_amt', model: 'flat', expected: 7000, pref: { missing_num: 'MSN01', missing_direction: 'OMD10' } },
  // OMO-3511 RE 범위: 넘버링은 현행 모델에서 의도적 미적재(=0, 용지별 차단 케이스 가능).
  //   expected=null → 비교 없이 SAMPLED(데이터 표집)만 수행. numbering_kind 는 동적 populate.
  numbering: { ppType: 'numbering', amt: 'numbering_amt', model: 'flat', expected: null, kindField: 'numbering_kind', pref: { numbering_type: 'NBT10' } },
}

// 카테고리별 시도 후가공(allcat-summary.json mappedFin 기준; 미지원은 ABSENT 로 자동 스킵)
const SUPPORTED = {
  CST1000: ['foil_stamp'],
  CLF1000: ['foil_stamp', 'deboss_emboss', 'die_cut', 'drilled_hole', 'epoxy', 'score_crease', 'perforation', 'numbering'],
  CPR4000: ['foil_stamp', 'deboss_emboss', 'die_cut', 'epoxy', 'round_corner', 'score_crease'],
  CPR5000: ['foil_stamp', 'deboss_emboss', 'die_cut', 'epoxy'],
  CNC1000: Object.keys(FIN),
}

// ── env 로드 ─────────────────────────────────────────────────────────────────
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) {
  console.error('NO CREDS: .env.local 에 SWADPIA_USERNAME / SWADPIA_PASSWORD 필요 (READ-ONLY dry-run 계정)')
  process.exit(2)
}

const argCodes = process.argv.slice(2).filter((a) => /^C[A-Z]{2}\d{4}$/.test(a))
const TARGETS = argCodes.length
  ? argCodes.map((code) => ({ code, label: code }))
  : DEFAULT_TARGETS

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

// OMO-3488/3513: 카테고리별로 hidden amt 필드명·수량래더가 달라 명함 필드명(bak_amt 등) 직독이
// 0/undefined 가 됨(OMO-3513 §4 실증). 따라서 명함 필드명에 의존하지 말고, 모든 `*_amt` hidden
// input 을 스냅샷해 후가공 적용 전/후 **변화한 필드**를 동적 발견한다(결정론: hidden 직독 유지).
const readAmts = () => page.evaluate(() => {
  const out = {}
  for (const el of document.querySelectorAll('input[name$="_amt"], input[id$="_amt"]')) {
    const key = el.name || el.id
    if (!key) continue
    const v = parseInt((el.value || '0'), 10)
    if (Number.isFinite(v)) out[key] = v
  }
  return out
})
// 전/후 amt 스냅샷 diff → {field, before, after, delta}[] (delta>0 만, postpress_amt/pay_amt 제외)
const diffAmts = (before, after) => {
  const changed = []
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (k === 'postpress_amt' || k === 'pay_amt' || k === 'total_amt') continue
    const d = (after[k] || 0) - (before[k] || 0)
    if (d !== 0) changed.push({ field: k, before: before[k] || 0, after: after[k] || 0, delta: d })
  }
  return changed.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

// 후가공 적용: 선호코드 설정(미존재 시 첫 유효옵션) → 체크 → 패널노출 → setIsPostpress → calcuEstimate
const applyFinishing = (cfg) => page.evaluate(({ cfg }) => {
  const log = []
  const setF = (n, v) => {
    const e = document.querySelector(`select[name="${n}"]`) || document.querySelector(`input[name="${n}"]`)
    if (!e) return 'ABSENT'
    if (e.tagName === 'SELECT') {
      const opts = Array.from(e.options).map((o) => o.value)
      let val = v
      if (!opts.includes(v)) {
        const firstValid = opts.find((o) => o !== '' && o !== '0')
        if (!firstValid) return `NO_OPT(${opts.slice(0, 4).join('|')})`
        val = firstValid // 카테고리별 코드 상이 → 첫 유효옵션 fallback
      }
      e.value = val; e.dispatchEvent(new Event('change', { bubbles: true }))
      return val === v ? 'SET' : `SET_FALLBACK(${val})`
    }
    e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); return 'SET'
  }
  const setRes = {}
  for (const [n, v] of Object.entries(cfg.pref)) setRes[n] = setF(n, v)
  const chk = document.querySelector(`#chk_is_${cfg.ppType}`)
  if (chk) chk.checked = true
  const chk2 = document.querySelector(`#chk_is_${cfg.ppType}2`)
  if (chk2) chk2.checked = true
  try { window.$j && window.$j(`#pnl_${cfg.ppType}`).show() } catch { /* */ }
  // 에폭시 kind 동적 populate 시 첫 옵션 보강
  if (cfg.ppType === 'epoxy') {
    try { window.chgEpoxyType && window.chgEpoxyType() } catch { /* */ }
    const ke = document.querySelector('select[name="epoxy_kind"]')
    const opts = ke ? Array.from(ke.options).map((o) => o.value).filter(Boolean) : []
    if (opts.length) setRes.epoxy_kind = setF('epoxy_kind', opts[0])
  }
  // 넘버링 kind 동적 populate(settingNumberingKind/chgNumberingType) 후 첫 유효옵션 선택
  if (cfg.kindField) {
    try { window.chgNumberingType && window.chgNumberingType() } catch { /* */ }
    try { window.settingNumberingKind && window.settingNumberingKind() } catch { /* */ }
    const ke = document.querySelector(`select[name="${cfg.kindField}"]`)
    const opts = ke ? Array.from(ke.options).map((o) => o.value).filter(Boolean) : []
    setRes[cfg.kindField] = opts.length ? setF(cfg.kindField, opts[0]) : 'NO_OPT(empty)'
  }
  try { window.setIsPostpress && window.setIsPostpress(cfg.ppType); log.push('setIsPostpress ok') } catch (e) { log.push('setIsPostpress ERR: ' + e.message) }
  try { window.product1 && window.product1.calcuEstimate(); log.push('calcuEstimate ok') } catch (e) { log.push('calcuEstimate ERR: ' + e.message) }
  return { setRes, log, chkExists: !!chk }
}, { cfg })

// 모델 대비 parity 판정
const TOL = 0.01 // ±1%
function verdict(finValue, cfg, amt, payDelta) {
  // 결정론 게이트: hidden amt 가 실제 가격영향(payDelta)과 일치해야 신뢰(드리프트 차단)
  const determinismOk = amt > 0 && Math.abs(amt - payDelta) <= Math.max(50, amt * TOL)
  if (amt <= 0) return { state: 'NO_DATA', detail: 'amt=0 (미지원/차단/필수필드 누락 가능)', determinismOk: false }
  const expected = cfg.expected
  // expected=null(현행 미적재, 예: numbering) → 비교 없이 데이터 표집만(SAMPLED)
  const ratio = expected ? amt / expected : null
  const match = expected != null && Math.abs(amt - expected) <= Math.max(50, expected * TOL)
  const state = expected == null ? 'SAMPLED' : (match ? 'MATCH' : 'DIVERGE')
  const out = {
    state,
    determinismOk,
    expected,
    amt,
    ratio: ratio != null ? Number(ratio.toFixed(4)) : null,
  }
  if (cfg.model === 'area') {
    out.ratePerMm2 = Number((amt / AREA_BASE_MM2).toFixed(4)) // @50×30mm 기준 카테고리 계수 도출
    out.modelRatePerMm2 = Number((AREA_BASE_KRW / AREA_BASE_MM2).toFixed(4))
  }
  if (!match) out.coefficient = ratio != null ? Number(ratio.toFixed(4)) : null // 카테고리별 계수 후보
  if (!determinismOk) out.detail = `DRIFT: amt(${amt}) ≠ payΔ(${payDelta})`
  return out
}

const report = { ranAt: new Date().toISOString(), loggedIn, base: BASE, tolerance: TOL, categories: [] }
for (const t of TARGETS) {
  const goods = goodsCode(t.code)
  const url = `${BASE}/goods/goods_view/${t.code}/${goods}`
  const catRow = { code: t.code, label: t.label, goods, url, finishings: {} }
  const toTry = SUPPORTED[t.code] || Object.keys(FIN)
  for (const finValue of toTry) {
    const cfg = FIN[finValue]
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForTimeout(2500)
      const before = await readState()
      const beforeAmts = await readAmts()
      const ap = await applyFinishing(cfg)
      await page.waitForTimeout(1200)
      await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate() } catch { /* */ } })
      await page.waitForTimeout(400)
      const after = await readState()
      const afterAmts = await readAmts()
      // 명함 필드명 직독(있으면) + 카테고리-비의존 동적 발견(변화한 *_amt 필드)
      const namedAmt = await page.evaluate((a) => parseInt(($(a)?.value) || '0', 10), cfg.amt)
      const changedAmts = diffAmts(beforeAmts, afterAmts)
      const discovered = changedAmts.find((c) => c.delta > 0) || null
      // 권위 amt: 명함 필드명이 양수면 그것, 아니면 동적 발견 필드(카테고리별 상이 대응)
      const amt = namedAmt > 0 ? namedAmt : (discovered ? discovered.delta : 0)
      const amtSource = namedAmt > 0 ? `named:${cfg.amt}` : (discovered ? `discovered:${discovered.field}` : 'none')
      const payDelta = after.pay - before.pay
      const v = verdict(finValue, cfg, amt, payDelta)
      catRow.finishings[finValue] = {
        ppType: cfg.ppType, amtField: cfg.amt, model: cfg.model,
        amt, amtSource, namedAmt, discoveredAmts: changedAmts,
        payBefore: before.pay, payAfter: after.pay, payDelta,
        setRes: ap.setRes, log: ap.log, verdict: v,
      }
      console.log(`[${t.code}/${finValue}] amt=${amt}(${amtSource}) payΔ=${payDelta} → ${v.state}${v.coefficient ? ` coef=${v.coefficient}` : ''}${v.determinismOk === false ? ' ⚠DRIFT' : ''}`)
    } catch (e) {
      catRow.finishings[finValue] = { error: String(e).slice(0, 200) }
      console.log(`[${t.code}/${finValue}] ERROR ${String(e).slice(0, 120)}`)
    }
  }
  report.categories.push(catRow)
}

await browser.close()

// 요약: 카테고리별 DIVERGE / DRIFT 집계
const summary = { matched: [], diverged: [], drift: [], noData: [], sampled: [] }
for (const c of report.categories) for (const [fv, r] of Object.entries(c.finishings)) {
  if (r.error) continue
  const key = `${c.code}/${fv}`
  if (r.verdict?.determinismOk === false) summary.drift.push(key)
  if (r.verdict?.state === 'MATCH') summary.matched.push(key)
  else if (r.verdict?.state === 'DIVERGE') summary.diverged.push({ key, coef: r.verdict.coefficient, amt: r.amt, expected: r.verdict.expected })
  else if (r.verdict?.state === 'SAMPLED') summary.sampled.push({ key, amt: r.amt })
  else if (r.verdict?.state === 'NO_DATA') summary.noData.push(key)
}
report.summary = summary

const outDir = 'scripts/test-artifacts/omo3488'
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'noncard-surcharge.json'), JSON.stringify(report, null, 2))
console.log('\n=== SUMMARY ===')
console.log('MATCH  :', summary.matched.length, summary.matched.join(', '))
console.log('DIVERGE:', summary.diverged.length, summary.diverged.map((d) => `${d.key}(coef ${d.coef})`).join(', '))
console.log('DRIFT  :', summary.drift.length, summary.drift.join(', '), summary.drift.length ? '← parity 게이트 차단 대상' : '')
console.log('SAMPLED:', summary.sampled.length, summary.sampled.map((s) => `${s.key}=${s.amt}`).join(', '), '(현행 미적재 — RE 표집)')
console.log('NO_DATA:', summary.noData.length, summary.noData.join(', '))
console.log(`\nSAVED ${outDir}/noncard-surcharge.json  loggedIn=${loggedIn}`)
