/**
 * OMO-2961: 런타임 추출 4종(귀도리/에폭시/오시/미싱) 성원 폼 옵션값 라이브 추출.
 * READ-ONLY — 주문 제출/결제 없음. 폼 옵션 populate 만 유발해 select 옵션값을 읽는다.
 *
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2961-runtime-probe.mts
 */
import * as fs from 'fs'
import type { Page } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo2961'

const TARGETS: { type: string; selects: string[] }[] = [
  { type: 'guidori', selects: ['guidori_type'] },
  { type: 'epoxy', selects: ['epoxy_type'] },
  { type: 'osi', selects: ['osi_num', 'osi_direction'] },
  { type: 'missing', selects: ['missing_num', 'missing_direction'] },
]

function readOpts(page: Page, name: string) {
  return page.evaluate((n: string) => {
    const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
    if (!el) return { present: false as const }
    return {
      present: true as const,
      options: Array.from(el.options).map((o) => ({ value: o.value, label: (o.textContent || '').trim() })),
    }
  }, name)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const result: Record<string, unknown> = {}
  try {
    // 1. 로그인
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('#icon_member_login'),
    ])
    await page.waitForTimeout(2000)
    result.loggedIn = !page.url().includes('/member/login')

    // 2. 명함(CNC1000) goods 페이지
    await page.goto(`${BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 30000 })

    // 3. 폼에 존재하는 chk_is_* + 후가공 관련 전역 함수 발견
    result.discovery = await page.evaluate(() => {
      const chks = Array.from(document.querySelectorAll('[id^="chk_is_"]')).map((e) => e.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const fnNames = Object.getOwnPropertyNames(w).filter((k) =>
        /guidori|epoxy|osi|missing|Postpress|chgNumber|calcu/i.test(k) && typeof w[k] === 'function',
      )
      const selNames = Array.from(document.querySelectorAll('select[name]')).map((e) => (e as HTMLSelectElement).name)
      return { chks, fnNames, selNames }
    })

    // 4. 용지/사이즈 첫 옵션 선택(size-dependent populate 유발)
    for (const f of ['paper_code', 'paper_size']) {
      const sel = await page.$(`select[name="${f}"]`)
      if (sel) {
        const v = await sel.evaluate((el: Element) => {
          const s = el as HTMLSelectElement
          const o = Array.from(s.options).find((x) => x.value && x.value !== '')
          if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) }
          return o?.value ?? null
        })
        result[`selected_${f}`] = v
        await page.waitForTimeout(800)
      }
    }

    // 5. 각 후가공: BEFORE(활성화 전) → 활성화 + populate → AFTER
    const fields: Record<string, unknown> = {}
    for (const t of TARGETS) {
      const before: Record<string, unknown> = {}
      for (const s of t.selects) before[s] = await readOpts(page, s)

      await page.evaluate((type: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        const chk = document.getElementById(`chk_is_${type}`) as HTMLInputElement | null
        if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
        try { w.$j && w.$j(`#pnl_${type}`).show() } catch { /* */ }
        // 흔한 populate 함수 후보 호출
        for (const fn of [`chg${type[0].toUpperCase()}${type.slice(1)}`, `set${type[0].toUpperCase()}${type.slice(1)}`, `setIsPostpress`]) {
          try { if (typeof w[fn] === 'function') w[fn](type) } catch { /* */ }
        }
        try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
      }, t.type)
      await page.waitForTimeout(1000)

      const after: Record<string, unknown> = {}
      for (const s of t.selects) after[s] = await readOpts(page, s)
      fields[t.type] = { before, after }
    }
    result.fields = fields
  } catch (e) {
    result.error = String(e)
  } finally {
    fs.writeFileSync(`${OUT}/runtime-probe.json`, JSON.stringify(result, null, 2))
    await browser.close()
  }
  console.log(JSON.stringify(result, null, 2))
}

main()
