// OMO-2647: 후가공 인터랙티브 발주 플로우 리버스 엔지니어링 (로그인 라이브).
//   목표: goods_view(CNC1000/GNC1001)에서 후가공 활성화→사이즈 의존 런타임 옵션
//   populate→필드 설정→가격 계산 트리거 시퀀스를 확정한다.
//   ⚠️ 최종 제출/파일업로드 없음 (실주문 미발생).
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const CODE = process.argv[2] || 'CNC1000'
const GOODS = process.argv[3] || 'GNC1001'
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS'); process.exit(2) }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1200 } })
const page = await ctx.newPage()
page.on('dialog', d => d.accept().catch(() => {}))

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER)
await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => page.keyboard.press('Enter'))])
const loggedIn = !page.url().includes('/member/login')

await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

const out = await page.evaluate(() => {
  const res = {}
  // 1. 가격 관련/후가공 관련 전역 함수 목록
  const fnNames = []
  for (const k of Object.keys(window)) {
    try {
      if (typeof window[k] === 'function' && /bak|ap_|tagong|domusong|numbering|guidori|epoxy|osi|missing|price|estimate|calc|sum|total|option|chg|add|finish|gagong/i.test(k)) {
        fnNames.push(k)
      }
    } catch { /* */ }
  }
  res.fns = fnNames.sort()

  // 2. 후가공 섹션 활성화 메커니즘: 체크박스/토글/탭
  const toggles = []
  for (const el of Array.from(document.querySelectorAll('input[type=checkbox],input[type=radio],a,button,span,li,dt,dd'))) {
    const oc = el.getAttribute('onclick') || ''
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (/후가공|박|형압|도무송|타공|넘버링|gagong|bak|tagong/i.test(oc + ' ' + txt) && (oc || el.type === 'checkbox' || el.type === 'radio')) {
      toggles.push({ tag: el.tagName, type: el.type || '', name: el.name || '', id: el.id || '', onclick: oc.slice(0, 80), txt: txt.slice(0, 30) })
    }
  }
  res.toggles = toggles.slice(0, 40)

  // 3. 사이즈 select 후보
  const sizes = []
  for (const s of Array.from(document.querySelectorAll('select'))) {
    if (/size|sajize|gyugyeok|kyu/i.test(s.name)) {
      sizes.push({ name: s.name, id: s.id, optCount: s.options.length, opts: Array.from(s.options).slice(0, 6).map(o => `${o.value}=${o.text.trim().slice(0,12)}`), onchange: (s.getAttribute('onchange') || '').slice(0, 60) })
    }
  }
  res.sizeSelects = sizes

  // 4. 후가공 select 들의 현재 상태 + 부모 컨테이너 가시성
  const finNames = ['bak_section_1', 'bak_type_1', 'ap_section_1', 'ap_type_1', 'domusong_section', 'domusong_type', 'tagong_num', 'tagong_size', 'numbering_type', 'numbering_kind', 'guidori_type', 'epoxy_type', 'osi_num', 'missing_num']
  const fins = {}
  for (const n of finNames) {
    const el = document.querySelector(`select[name="${n}"]`)
    if (!el) { fins[n] = 'ABSENT'; continue }
    const cs = getComputedStyle(el)
    // 가장 가까운 후가공 컨테이너의 가시성/체크상태 추적
    let p = el.parentElement, container = null
    for (let i = 0; i < 8 && p; i++) { if (/gagong|finish|option|sub_/.test((p.id || '') + (p.className || ''))) { container = p; break } p = p.parentElement }
    fins[n] = {
      optCount: el.options.length,
      visible: cs.display !== 'none' && el.offsetParent !== null,
      onchange: (el.getAttribute('onchange') || '').slice(0, 50),
      container: container ? { id: container.id, cls: (container.className || '').slice(0, 40), display: getComputedStyle(container).display } : null,
    }
  }
  res.finSelects = fins
  return res
})

// 5. 페이지 인라인 <script> 에서 후가공/가격 함수 본문 추출 (이름→소스 일부)
const scriptBodies = await page.evaluate(() => {
  const wanted = ['chgBakType', 'chgTagongNum', 'chgTagongSize', 'addBak', 'addTagong', 'addAP', 'addDomusong', 'addNumbering', 'goPriceView', 'fn_price', 'priceView', 'getEstimate', 'estimateView', 'sumPrice', 'totalPrice', 'optionPrice']
  const found = {}
  for (const name of wanted) {
    try { if (typeof window[name] === 'function') found[name] = window[name].toString().slice(0, 600) } catch { /* */ }
  }
  return found
})

await browser.close()
fs.mkdirSync('scripts/test-artifacts/omo2647', { recursive: true })
const report = { code: CODE, goods: GOODS, loggedIn, ...out, scriptBodies }
fs.writeFileSync('scripts/test-artifacts/omo2647/re-flow.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ loggedIn, fns: out.fns, sizeSelects: out.sizeSelects, toggleCount: out.toggles.length, finSummary: Object.fromEntries(Object.entries(out.finSelects).map(([k, v]) => [k, v === 'ABSENT' ? 'ABSENT' : `opt=${v.optCount} vis=${v.visible} oc=${v.onchange}`])), scriptFns: Object.keys(scriptBodies) }, null, 2))
