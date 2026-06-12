/**
 * OMO-2485: 미해결 2건 라이브 구조 조사
 *  - CNC5000 투명명함(transparent): qty selectOption 실패 → 실제 수량 select name/value 확인
 *  - CNC6000/8000 ARM230W00(아르미230g): paper_code 값 불일치 → 실제 옵션 value 확인
 *
 * 각 goods_view 페이지의 모든 select(name + option value/label)와
 * paper_qty 류 후보, 그리고 ARM/PET 종이 옵션을 덤프한다.
 *
 * 실행: node --env-file=.env.local scripts/omo2485-probe-selects.mjs
 */
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const SWADPIA_BASE = 'https://www.swadpia.co.kr'
const TARGETS = [
  { label: 'CNC5000 투명명함(transparent)', category: 'CNC5000', goods: '1' },
  { label: 'CNC6000 UV명함', category: 'CNC6000', goods: '1' },
  { label: 'CNC8000 펄명함', category: 'CNC8000', goods: '1' },
  { label: 'CNC4000 레터프레스(정상 비교군)', category: 'CNC4000', goods: '1' },
]

async function login(page) {
  await page.goto(`${SWADPIA_BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('#icon_member_login'),
  ])
  await page.waitForTimeout(2000)
  if (page.url().includes('/member/login')) throw new Error('로그인 실패')
}

async function dumpSelects(page) {
  return page.evaluate(() => {
    const out = []
    document.querySelectorAll('select').forEach((sel) => {
      const opts = Array.from(sel.options).map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
      out.push({ name: sel.name || sel.id || '(noname)', id: sel.id || '', count: opts.length, options: opts })
    })
    return out
  })
}

async function main() {
  if (!process.env.SWADPIA_USERNAME) { console.error('SWADPIA creds 없음'); process.exit(1) }
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const report = {}
  try {
    await login(page)
    console.log('로그인 OK\n')
    for (const t of TARGETS) {
      const url = `${SWADPIA_BASE}/goods/goods_view/${t.category}/${t.goods}`
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(1500)
      } catch (e) {
        console.log(`[${t.category}] goto 경고: ${e.message}`)
      }
      const selects = await dumpSelects(page)
      report[t.category] = { label: t.label, url, finalUrl: page.url(), selects }
      console.log(`\n${'='.repeat(70)}\n${t.label}  (${t.category})  -> ${page.url()}`)
      for (const s of selects) {
        // 수량/종이/색상 관련 select만 상세 출력
        const isQty = /qty|quant|수량/i.test(s.name)
        const isPaper = /paper_code|paper|종이/i.test(s.name)
        const head = `  • select[name="${s.name}"] (${s.count}개)`
        if (isQty || isPaper || s.count <= 30) {
          console.log(head)
          for (const o of s.options) console.log(`       ${o.value}  |  ${o.label}`)
        } else {
          console.log(`${head}  [생략: ${s.count}개]  샘플: ${s.options.slice(0, 5).map((o) => o.value).join(', ')}`)
        }
      }
    }
  } finally {
    const dir = path.join(import.meta.dirname, 'test-artifacts', 'omo2485')
    fs.mkdirSync(dir, { recursive: true })
    const f = path.join(dir, 'probe-selects.json')
    fs.writeFileSync(f, JSON.stringify(report, null, 2))
    console.log(`\n\n덤프 저장: ${f}`)
    await browser.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
