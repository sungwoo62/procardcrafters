// OMO-2647: 후가공 인터랙티브 발주 플로우 검증 + 도매 surcharge 추출 (로그인 라이브).
//
// 확정된 시퀀스 (RE: omo2647-re-finishing-flow / product1 / debug-bak-numbering):
//   1) 사이즈 선택(기본 paper_size 존재) → 런타임 옵션 populate
//   2) 후가공 select 필드값 설정 (DEFAULT_FINISHING_FIELD_VALUES)
//   3) 활성화: chk_is_{type}.checked=true + pnl_{type} show
//   4) 재계산: setIsPostpress(type) → product1.pp{Type}('1' for bak/ap) → {type}_amt 산출
//   5) calcuEstimate() 합산 → pay_amt
//   6) 측정: {type}_amt(도매 surcharge) + pay_amt 델타
//
// ⚠️ 최종 제출/파일업로드 없음 (실주문 미발생).
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
if (!USER || !PW) { console.error('NO CREDS'); process.exit(2) }

const FIN = {
  drilled_hole: { ppType: 'tagong', amt: 'tagong_amt', fields: { tagong_num: '1', tagong_size: '4' } },
  foil_stamp:   { ppType: 'bak', amt: 'bak_amt', fields: { bak_section_1: 'BKS10', bak_side_1: 'BKD10', bak_type_1: 'BKT02', bak_compare_1: 'BAC10' } },
  deboss_emboss:{ ppType: 'ap', amt: 'ap_amt', fields: { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10' } },
  die_cut:      { ppType: 'domusong', amt: 'domusong_amt', fields: { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '1' } },
  numbering:    { ppType: 'numbering', amt: 'numbering_amt', kindField: 'numbering_kind', fields: { numbering_type: 'NBT10' } },
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1200 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
const loggedIn = !page.url().includes('/member/login')

const readState = () => page.evaluate(() => ({
  pay: parseInt(($('pay_amt')?.value) || '0', 10),
  total: parseInt(($('total_price')?.value) || '0', 10),
  pp: parseInt(($('postpress_amt')?.value) || '0', 10),
  label: (document.querySelector('#lbl_pay_amt')?.textContent || '').trim(),
}))

// 후가공 적용: 필드설정 → 체크 → 패널노출 → (넘버링은 kind populate) → setIsPostpress → calcuEstimate
const applyFinishing = (cfg) => page.evaluate(({ cfg }) => {
  const log = []
  const setF = (n, v) => {
    const e = document.querySelector(`select[name="${n}"]`)
    if (!e) return `ABSENT`
    if (!Array.from(e.options).some(o => o.value === v)) return `NO_OPT(${Array.from(e.options).map(o=>o.value).slice(0,4).join('|')})`
    e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); return 'SET'
  }
  const setRes = {}
  for (const [n, v] of Object.entries(cfg.fields)) setRes[n] = setF(n, v)
  // 활성화
  const chk = document.querySelector(`#chk_is_${cfg.ppType}`)
  if (chk) chk.checked = true
  const chk2 = document.querySelector(`#chk_is_${cfg.ppType}2`)
  if (chk2) chk2.checked = true
  try { window.$j && window.$j(`#pnl_${cfg.ppType}`).show() } catch { /* */ }
  // 넘버링: kind 옵션 동적 populate 시도 후 첫 옵션 선택
  if (cfg.kindField) {
    try { window.chgNumberingType && window.chgNumberingType() } catch { /* */ }
    const ke = document.querySelector(`select[name="${cfg.kindField}"]`)
    const opts = ke ? Array.from(ke.options).map(o => o.value).filter(Boolean) : []
    setRes[cfg.kindField] = opts.length ? setF(cfg.kindField, opts[0]) : `NO_OPT(empty)`
  }
  // 재계산 (canonical 경로: setIsPostpress 가 올바른 seq 로 pp 메서드 호출)
  try { window.setIsPostpress && window.setIsPostpress(cfg.ppType); log.push('setIsPostpress ok') } catch (e) { log.push('setIsPostpress ERR: ' + e.message) }
  try { window.product1 && window.product1.calcuEstimate(); log.push('calcuEstimate ok') } catch (e) { log.push('calcuEstimate ERR: ' + e.message) }
  return { setRes, log, chkExists: !!chk }
}, { cfg })

await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
const baseline = await readState()

const results = {}
for (const [finValue, cfg] of Object.entries(FIN)) {
  await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const before = await readState()
  const ap = await applyFinishing(cfg)
  await page.waitForTimeout(1200)
  // 재계산 한번 더 (AJAX populate 후 반영 보장)
  await page.evaluate(() => { try { window.product1 && window.product1.calcuEstimate() } catch { /* */ } })
  await page.waitForTimeout(400)
  const after = await readState()
  const amt = await page.evaluate((a) => parseInt(($(a)?.value) || '0', 10), cfg.amt)
  results[finValue] = {
    ppType: cfg.ppType, ...ap, amtField: cfg.amt, surcharge_wholesale: amt,
    payBefore: before.pay, payAfter: after.pay, payDelta: after.pay - before.pay, ppAmtAfter: after.pp, labelAfter: after.label,
  }
  console.log(`[${finValue}] ${cfg.ppType}: ${cfg.amt}=${amt}  payΔ=${after.pay - before.pay}  (${before.pay}→${after.pay})  log=${ap.log.join('; ')}`)
}

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo2647', { recursive: true })
fs.writeFileSync('scripts/test-artifacts/omo2647/surcharge.json', JSON.stringify({ code: CODE, goods: GOODS, loggedIn, baseline, results }, null, 2))
console.log('\nSAVED scripts/test-artifacts/omo2647/surcharge.json  loggedIn=' + loggedIn)
