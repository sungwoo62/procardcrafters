/**
 * OMO-3022: 전 카테고리 (1) 인쇄색 필드/옵션값 + (2) 추가 후가공 11종 필드구조 라이브 추출.
 * READ-ONLY — 주문/결제 없음. 폼 옵션 populate 만 유발해 select 옵션값을 읽는다.
 *
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3022-probe.mts
 */
import * as fs from 'fs'
import type { Page } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3022'

// 비카드(+카드 대조용 CNC1000) 카테고리. 우리 DB가 print_color 값을 보내는 것 위주.
const CATS: [string, string][] = [
  ['CNC1000', '명함(대조)'],
  ['CST1000', '스티커'], ['CST2000', '도무송스티커'], ['CST5000', '홀로그램스티커'], ['CST7000', '롤스티커'],
  ['CLP1000', '라벨'], ['CDP3000', '엽서'],
  ['CEV1000', '봉투'], ['CNR2000', '양식/명세서'],
  ['CCD1000', '벽걸이캘린더'], ['CCD2000', '탁상캘린더'],
  ['CPR3000', '리플렛'], ['CLF2000', '브로슈어/메뉴'], ['CPR4000', '책자'],
  ['CLF1000', '전단'], ['CPR2000', '포스터'], ['CPR5000', '배너'],
]

// 인쇄색 후보 필드명(폼마다 다름) — 우리 print_color_type 가 매핑돼야 하는 select.
const COLOR_FIELD_CANDIDATES = [
  'print_color_type', 'print_method', 'binding_type',
  'fside_color_amount', 'fside_color_amount1', 'bside_color_amount', 'bside_color_amount1',
  'color_type', 'print_type', 'paper_print',
]

// Part 2: 추가 후가공 11종 → 성원 chk_is_{type} 후보. 성원 실제 type 명은 폼마다
// 다를 수 있어 추정 후보를 넓게 둔다(존재하는 것만 캡처).
const EXTRA_FINISHINGS: Record<string, string[]> = {
  coating: ['coting', 'coating', 'lami', 'laminating'],
  cutting: ['cutting', 'jaedan', 'jdan'],
  add_cutting: ['add_cutting', 'addcutting', 'cutting2'],
  binding: ['binding', 'jebon', 'binder'],
  folding: ['folding', 'jeobji', 'jubji'],
  bonding: ['bonding', 'jeopchak', 'gluing', 'jubchak'],
  laminex: ['laminex', 'lamine', 'laminae'],
  stitching: ['stitching', 'jungchul', 'jcheol'],
  window: ['window', 'changmun', 'changho'],
  tape: ['tape', 'tap', 'jumchak_tape'],
  partial_coating: ['partial_coating', 'bubun_coting', 'part_coting', 'spot_coating'],
}

function readOptsBy(page: Page, name: string) {
  return page.evaluate((n: string) => {
    const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
    if (!el) return null
    return Array.from(el.options)
      .map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
      .filter((o) => o.value !== '')
  }, name)
}

async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('#icon_member_login'),
  ])
  await page.waitForTimeout(1500)
  return !page.url().includes('/member/login')
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  const out: Record<string, unknown> = { probedAt: '2026-06-13', cats: {} }
  const cats = out.cats as Record<string, unknown>
  try {
    const loggedIn = await login(page)
    out.loggedIn = loggedIn
    if (!loggedIn) throw new Error('login failed')

    for (const [code, label] of CATS) {
      const row: Record<string, unknown> = { label }
      try {
        const resp = await page.goto(`${BASE}/goods/goods_view/${code}/1`, { waitUntil: 'networkidle', timeout: 30000 })
        if (!resp || resp.status() >= 400) { row.error = `HTTP ${resp?.status()}`; cats[code] = row; continue }
        // 용지 선택해 종속필드 populate
        const pc = await page.$('select[name="paper_code"]') || await page.$('select[name="cover_paper_code"]')
        if (pc) {
          await pc.evaluate((el: Element) => {
            const s = el as HTMLSelectElement
            const o = Array.from(s.options).find((x) => x.value)
            if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) }
          })
          await page.waitForTimeout(1000)
        }

        // (1) 인쇄색 후보 필드들 + 옵션값
        const colorFields: Record<string, unknown> = {}
        for (const f of COLOR_FIELD_CANDIDATES) {
          const opts = await readOptsBy(page, f)
          if (opts && opts.length) colorFields[f] = opts
        }
        // 폼에 존재하는 모든 select name (디버그용)
        const allSelects = await page.evaluate(() =>
          Array.from(document.querySelectorAll('select[name]')).map((e) => (e as HTMLSelectElement).name),
        )
        row.colorFields = colorFields
        row.allSelects = allSelects

        // 폼에 존재하는 chk_is_* 전체
        const chks: string[] = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[id^="chk_is_"]')).map((e) => e.id.replace('chk_is_', '')),
        )
        row.chks = chks

        // (2) 추가 후가공: 후보 chk 중 존재하는 것을 클릭→옵션 populate→관련 select 캡처
        const finStruct: Record<string, unknown> = {}
        for (const [canonical, candidates] of Object.entries(EXTRA_FINISHINGS)) {
          const hit = candidates.find((c) => chks.includes(c))
          if (!hit) continue
          // chk 클릭으로 패널/옵션 populate
          await page.evaluate((t: string) => {
            const chk = document.getElementById(`chk_is_${t}`) as HTMLInputElement | null
            if (chk) {
              chk.checked = true
              chk.dispatchEvent(new Event('click', { bubbles: true }))
              chk.dispatchEvent(new Event('change', { bubbles: true }))
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = window as any
            try { w.$j && w.$j(`#pnl_${t}`).show() } catch { /* */ }
            try { w.setIsPostpress && w.setIsPostpress(t) } catch { /* */ }
          }, hit)
          await page.waitForTimeout(700)
          // 패널(pnl_{hit}) 내부 select 들 캡처
          const selects = await page.evaluate((t: string) => {
            const pnl = document.getElementById(`pnl_${t}`)
            const scope: ParentNode = pnl || document
            const res: Record<string, { value: string; label: string }[]> = {}
            for (const el of Array.from(scope.querySelectorAll('select[name]'))) {
              const s = el as HTMLSelectElement
              res[s.name] = Array.from(s.options)
                .map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
                .filter((o) => o.value !== '')
            }
            // 패널 내 input(체크박스/숫자)도 이름만
            const inputs = pnl
              ? Array.from(pnl.querySelectorAll('input[name]')).map((e) => (e as HTMLInputElement).name)
              : []
            return { selects: res, inputs }
          }, hit)
          finStruct[canonical] = { swadpiaType: hit, ...selects }
        }
        row.extraFinishings = finStruct
      } catch (e) {
        row.error = String(e)
      }
      cats[code] = row
      console.log(`[probe] ${code} ${label} done`)
    }
  } finally {
    fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(out, null, 2))
    await browser.close()
  }
  console.log('done →', `${OUT}/probe.json`)
}
main()
