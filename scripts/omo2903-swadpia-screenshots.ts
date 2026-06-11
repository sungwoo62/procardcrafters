// OMO-2903 ④ 성원 발주 폼 스크린샷 캡처 (dry-run, 결제 직전 정지)
//   비교 웹페이지(고객주문↔성원발주)용 성원측 증거. 로그인 후 카테고리별 goods_view
//   진입 → 옵션/가격 영역 + (명함은 후가공 적용 후 주문모달) 캡처.
//   ⚠️ 비용가드: 실주문 없음(모달/폼 캡처까지만). 결제 버튼 미클릭.
//
// 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2903-swadpia-screenshots.ts
import { chromium, type Page } from 'playwright'
import { expandFinishingToSwadpiaFields } from '../src/config/swadpia-finishing-fields.ts'

const BASE = 'https://www.swadpia.co.kr'
const USER = process.env.SWADPIA_USERNAME
const PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS'); process.exit(2) }
const OUT = 'scripts/test-artifacts/omo2903/screenshots'

// 명함 후가공 활성화 (omo2647 activateFinishings 와 동일 — 명함 전용)
const FINISHING_GROUPS = [
  { ppType: 'bak', prefix: 'bak_' }, { ppType: 'ap', prefix: 'ap_' },
  { ppType: 'domusong', prefix: 'domusong_' }, { ppType: 'tagong', prefix: 'tagong_' },
  { ppType: 'numbering', prefix: 'numbering_' },
]
async function activateFinishings(page: Page, opts: Record<string, string>) {
  const keys = Object.keys(opts)
  for (const g of FINISHING_GROUPS) {
    const gk = keys.filter((k) => k.startsWith(g.prefix))
    if (gk.length === 0) continue
    const fieldMap: Record<string, string> = {}
    for (const k of gk) fieldMap[k] = opts[k]
    await page.evaluate((p: { ppType: string; fieldMap: Record<string, string> }) => {
      const { ppType, fieldMap } = p
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const set = (n: string, v: string) => {
        const el = document.querySelector(`[name="${n}"]`) as HTMLSelectElement | HTMLInputElement | null
        if (!el) return
        if (el.tagName === 'SELECT' && !Array.from((el as HTMLSelectElement).options).some((o) => o.value === v)) return
        el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const chk = document.getElementById(`chk_is_${ppType}`) as HTMLInputElement | null
      if (chk) chk.checked = true
      try { w.$j && w.$j(`#pnl_${ppType}`).show() } catch { /* */ }
      for (const [n, v] of Object.entries(fieldMap)) { if (!n.endsWith('_kind')) set(n, v) }
      try { w.setIsPostpress && w.setIsPostpress(ppType) } catch { /* */ }
      try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
    }, { ppType: g.ppType, fieldMap })
    await page.waitForTimeout(800)
  }
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'ko-KR', viewport: { width: 1400, height: 1600 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER!)
await page.fill('input[name="member_pw"]', PW!)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
const loggedIn = !page.url().includes('/member/login')
console.log('loggedIn:', loggedIn)

const captures: { name: string; file: string; ok: boolean; note: string }[] = []

async function snap(name: string, file: string, note: string) {
  try {
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true })
    captures.push({ name, file, ok: true, note })
    console.log(`  ✅ ${file} — ${note}`)
  } catch (e) {
    captures.push({ name, file, ok: false, note: `${note} / 캡처실패 ${(e as Error).message}` })
    console.log(`  ❌ ${file} 실패`)
  }
}

// 캡처 대상: 카테고리별 goods_view (옵션/가격 폼). 명함은 추가로 후가공 적용 모달.
const TARGETS = [
  { name: '명함', url: `${BASE}/goods/goods_view/CNC1000/GNC1001`, file: 'sungwoo-01-business-cards.png', finishing: 'foil_stamp,drilled_hole' },
  { name: '포스터', url: `${BASE}/goods/goods_view/CPR2000`, file: 'sungwoo-02-posters.png', finishing: '' },
  { name: '책자', url: `${BASE}/goods/goods_view/CPR4000`, file: 'sungwoo-03-booklet.png', finishing: '' },
]

for (const t of TARGETS) {
  console.log(`[${t.name}] ${t.url}`)
  try {
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2000)
  } catch (e) {
    captures.push({ name: t.name, file: t.file, ok: false, note: `goto 실패 ${(e as Error).message}` })
    console.log(`  ❌ goto 실패: ${(e as Error).message}`)
    continue
  }
  const redirectedToLogin = page.url().includes('/member/login')
  if (redirectedToLogin) {
    captures.push({ name: t.name, file: t.file, ok: false, note: '로그인 리다이렉트(URL 패턴/상품코드 불일치)' })
    console.log('  ⚠️ 로그인 리다이렉트 — 스킵')
    continue
  }
  // 명함: 후가공 적용 후 주문모달 캡처
  if (t.finishing) {
    const expanded = expandFinishingToSwadpiaFields({ finishing: t.finishing })
    const fopts: Record<string, string> = {}
    for (const [k, v] of Object.entries(expanded)) if (FINISHING_GROUPS.some((g) => k.startsWith(g.prefix))) fopts[k] = v
    await activateFinishings(page, fopts)
    await page.waitForTimeout(500)
    try { await page.evaluate(() => { (document.querySelector('#btn_order3') as HTMLElement)?.click() }); await page.waitForTimeout(1800) } catch { /* */ }
  }
  await snap(t.name, t.file, t.finishing ? `${t.name} 옵션+후가공(${t.finishing}) 적용 발주폼` : `${t.name} 발주폼(옵션/가격)`)
}

await browser.close()
console.log('\n' + JSON.stringify({ loggedIn, capturedAt: new Date().toISOString(), captures }, null, 2))
