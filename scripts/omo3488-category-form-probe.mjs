// OMO-3488: 비명함 카테고리 후가공 폼 구조 진단(READ-ONLY).
// 목적: 명함 하니스가 비명함에서 amt=0/payΔ=0 인 원인(토글 id/패널/재계산/amt필드/수량 상이)을
//       카테고리별로 인벤토리해 후속 카테고리-전용 하니스 작업을 actionable 하게 만든다.
// 실주문 없음. hidden 필드/요소 존재여부만 직독.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = 'https://www.swadpia.co.kr'
const goodsCode = (c) => 'G' + c.slice(1, -1) + '1'
const CODES = process.argv.slice(2).filter((a) => /^C[A-Z]{2}\d{4}$/.test(a))
const TARGETS = CODES.length ? CODES : ['CST1000', 'CLF1000', 'CPR4000', 'CPR5000', 'CNC1000']
const PP_TYPES = ['bak', 'ap', 'domusong', 'tagong', 'guidori', 'epoxy', 'osi', 'missing', 'numbering']

const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS'); process.exit(2) }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1400, height: 1200 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))
await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
const loggedIn = !page.url().includes('/member/login')

const report = { ranAt: new Date().toISOString(), loggedIn, categories: [] }
for (const code of TARGETS) {
  const goods = goodsCode(code)
  await page.goto(`${BASE}/goods/goods_view/${code}/${goods}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const inv = await page.evaluate((ppTypes) => {
    const exists = (sel) => !!document.querySelector(sel)
    const toggles = {}
    for (const t of ppTypes) {
      toggles[t] = {
        chk: exists(`#chk_is_${t}`), chk2: exists(`#chk_is_${t}2`),
        pnl: exists(`#pnl_${t}`),
        amtField: exists(`[name="${t}_amt"]`) || exists(`#${t}_amt`),
      }
    }
    const amtFields = Array.from(document.querySelectorAll('input[name$="_amt"], input[id$="_amt"]'))
      .map((e) => e.name || e.id).filter(Boolean)
    // 수량 select 후보
    const qtySelects = Array.from(document.querySelectorAll('select'))
      .filter((s) => /qty|quan|amount|prt_num|print_num|su|매수|num/i.test((s.name || '') + (s.id || '')))
      .map((s) => ({ name: s.name || s.id, opts: Array.from(s.options).map((o) => o.value).slice(0, 8) }))
    // 후가공 관련 select name 목록(접두로 그룹)
    const finSelectNames = Array.from(document.querySelectorAll('select'))
      .map((s) => s.name || s.id).filter((n) => /^(bak|ap|domusong|tagong|guidori|epoxy|osi|missing|numbering|cut|coat|fold|bind)/.test(n))
    return { toggles, amtFields, qtySelects, finSelectNames }
  }, PP_TYPES)
  report.categories.push({ code, goods, ...inv })
  const active = Object.entries(inv.toggles).filter(([, v]) => v.chk).map(([k]) => k)
  console.log(`[${code}] toggles(chk): ${active.join(',') || '-'} | amtFields: ${inv.amtFields.join(',') || '-'}`)
}
await browser.close()
const outDir = 'scripts/test-artifacts/omo3488'
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'category-form-probe.json'), JSON.stringify(report, null, 2))
console.log(`\nSAVED ${outDir}/category-form-probe.json loggedIn=${loggedIn}`)
