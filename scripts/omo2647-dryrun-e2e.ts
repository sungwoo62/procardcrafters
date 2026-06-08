// OMO-2647 E2E 드라이런: shipped 데이터(expandFinishingToSwadpiaFields)로 후가공 발주
//   플로우를 라이브 검증. 로그인 → goods_view(CNC1000) → expandFinishing → 활성화
//   시퀀스(swadpia-order.ts activateFinishings 와 동일) → 주문모달(btn_order3) 단가 반영
//   확인. ⚠️ 최종 제출/업로드 없음.
//
// 활성화 로직은 src/lib/swadpia-order.ts 의 activateFinishings 와 1:1 동일하게 유지한다
// (lib 는 './swadpia' 확장자없는 import 로 node strip-types 로딩 불가하여 config 만 import).
//
// 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2647-dryrun-e2e.ts
import { chromium, type Page } from 'playwright'
import { expandFinishingToSwadpiaFields } from '../src/config/swadpia-finishing-fields.ts'

const BASE = 'https://www.swadpia.co.kr'
const USER = process.env.SWADPIA_USERNAME
const PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS'); process.exit(2) }

const FINISHING_GROUPS: { ppType: string; prefix: string }[] = [
  { ppType: 'bak', prefix: 'bak_' },
  { ppType: 'ap', prefix: 'ap_' },
  { ppType: 'domusong', prefix: 'domusong_' },
  { ppType: 'tagong', prefix: 'tagong_' },
  { ppType: 'numbering', prefix: 'numbering_' },
]
const isFinishingKey = (k: string) => FINISHING_GROUPS.some((g) => k.startsWith(g.prefix))

// activateFinishings — swadpia-order.ts 와 동일
async function activateFinishings(page: Page, finishingOpts: Record<string, string>): Promise<void> {
  const keys = Object.keys(finishingOpts)
  for (const g of FINISHING_GROUPS) {
    const groupKeys = keys.filter((k) => k.startsWith(g.prefix))
    if (groupKeys.length === 0) continue
    const fieldMap: Record<string, string> = {}
    for (const k of groupKeys) fieldMap[k] = finishingOpts[k]
    await page.evaluate((params: { ppType: string; fieldMap: Record<string, string> }) => {
      const { ppType, fieldMap } = params
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const setField = (name: string, value: string) => {
        const el = document.querySelector(`[name="${name}"]`) as HTMLSelectElement | HTMLInputElement | null
        if (!el) return
        if (el.tagName === 'SELECT') {
          const sel = el as HTMLSelectElement
          if (!Array.from(sel.options).some((o) => o.value === value)) return
        }
        el.value = value
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const chk = document.getElementById(`chk_is_${ppType}`) as HTMLInputElement | null
      if (chk) chk.checked = true
      const chk2 = document.getElementById(`chk_is_${ppType}2`) as HTMLInputElement | null
      if (chk2) chk2.checked = true
      try { w.$j && w.$j(`#pnl_${ppType}`).show() } catch { /* */ }
      for (const [n, v] of Object.entries(fieldMap)) {
        if (n.endsWith('_kind')) continue
        setField(n, v)
      }
      if (ppType === 'numbering') {
        try { w.chgNumberingType && w.chgNumberingType() } catch { /* */ }
        const ke = document.querySelector('select[name="numbering_kind"]') as HTMLSelectElement | null
        if (ke) {
          const opts = Array.from(ke.options).map((o) => o.value).filter(Boolean)
          const want = fieldMap['numbering_kind']
          const chosen = want && opts.includes(want) ? want : opts[0] || ''
          if (chosen) { ke.value = chosen; ke.dispatchEvent(new Event('change', { bubbles: true })) }
        }
      }
      try { w.setIsPostpress && w.setIsPostpress(ppType) } catch { /* */ }
      try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
    }, { ppType: g.ppType, fieldMap })
    await page.waitForTimeout(900)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
    })
    await page.waitForTimeout(200)
  }
}

const CASES = [
  { name: '타공', finishing: 'drilled_hole' },
  { name: '도무송', finishing: 'die_cut' },
  { name: '박', finishing: 'foil_stamp' },
  { name: '형압', finishing: 'deboss_emboss' },
  { name: '넘버링', finishing: 'numbering' },
  { name: '복합(타공+박)', finishing: 'drilled_hole,foil_stamp' },
]

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1200 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER!)
await page.fill('input[name="member_pw"]', PW!)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
const loggedIn = !page.url().includes('/member/login')
console.log('loggedIn:', loggedIn)

const readPay = () => page.evaluate(() => {
  // @ts-expect-error Prototype $
  const v = (window.$ && window.$('pay_amt')) ? window.$('pay_amt').value : '0'
  return parseInt(v || '0', 10)
})

const out: Record<string, unknown>[] = []
for (const c of CASES) {
  await page.goto(`${BASE}/goods/goods_view/CNC1000/GNC1001`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const before = await readPay()
  const expanded = expandFinishingToSwadpiaFields({ finishing: c.finishing })
  const finishingOpts: Record<string, string> = {}
  for (const [k, v] of Object.entries(expanded)) if (isFinishingKey(k)) finishingOpts[k] = v
  await activateFinishings(page, finishingOpts)
  await page.waitForTimeout(400)
  const after = await readPay()
  let modalProc: string[] = []
  try {
    await page.evaluate(() => { (document.querySelector('#btn_order3') as HTMLElement)?.click() })
    await page.waitForTimeout(1800)
    modalProc = await page.evaluate(() => (document.body.innerText || '').match(/(박|형압|도무송|타공|넘버링)[^\n]{0,24}/g)?.slice(0, 4) || [])
  } catch { /* */ }
  const rec = { case: c.name, finishing: c.finishing, payBefore: before, payAfter: after, surchargeWithTax: after - before, expandedKeys: Object.keys(finishingOpts) }
  out.push(rec)
  console.log(`[${c.name}] payΔ=${after - before} (${before}→${after})  keys=${Object.keys(finishingOpts).join(',')}`)
}

await browser.close()
console.log('\n' + JSON.stringify({ loggedIn, results: out }, null, 2))
console.log('DONE — ⚠️ 실주문 미발생 (모달까지만)')
