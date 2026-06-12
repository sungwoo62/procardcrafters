/**
 * OMO-2961: 전 카테고리 옵션 매핑 자동 감사. READ-ONLY (주문/결제 없음).
 * 각 categoryCode goods_view 폼을 열어 핵심옵션 4종 필드 존재 + 후가공 chk_is_* 목록을
 * 우리 config(canonical + alias)와 대조한다.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2961-allcat-audit.mts
 */
import * as fs from 'fs'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo2961'

// swadpia-order.ts SWADPIA_FIELD_ALIAS 복사(단일소스 — 변경시 동기화)
const ALIAS: Record<string, Record<string, string>> = {
  CEV1000: { paper_size: 'bongto_type', print_color_type: 'fside_color_amount' },
  CLP1000: { print_color_type: 'fside_color_amount1', paper_size: 'small_size_type', paper_qty: 'paper_qty_select' },
  CPR4000: { paper_code: 'cover_paper_code', print_color_type: 'binding_type', paper_qty: 'bundle_qty' },
  CCD1000: { print_color_type: 'print_method', paper_qty: 'paper_qty_select' },
  CCD2000: { print_color_type: 'print_method', paper_qty: 'paper_qty_select' },
  CNR2000: { print_color_type: 'fside_color_amount', paper_size: 'code_size_type' },
  CPR3000: { print_color_type: 'print_method' },
  CLF2000: { print_color_type: 'print_method' },
}
// 감사할 distinct categoryCode (CATEGORY_MAP 에서 dedupe) + 대표 라벨
const CATS: [string, string][] = [
  ['CNC1000', '명함'], ['CNC2000', '고급명함'], ['CNC3000', '메탈/포일명함'], ['CNC4000', '레터프레스명함'],
  ['CNC5000', '투명명함'], ['CNC6000', 'UV명함'], ['CNC8000', '펄명함'],
  ['CST1000', '스티커'], ['CST2000', '도무송스티커'], ['CST5000', '홀로그램스티커'], ['CST7000', '롤스티커'],
  ['CLP1000', '라벨'], ['CLF1000', '전단'], ['CLF2000', '브로슈어/메뉴'], ['CPR3000', '리플렛'],
  ['CPR4000', '책자'], ['CDP3000', '엽서'], ['CPR2000', '포스터'], ['CPR5000', '배너'],
  ['CEV1000', '봉투'], ['CNR2000', '양식/명세서'], ['CCD1000', '벽걸이캘린더'], ['CCD2000', '탁상캘린더'],
]
const CANON = ['paper_code', 'paper_size', 'paper_qty', 'print_color_type']

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const rows: Record<string, unknown>[] = []
  try {
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
    await page.waitForTimeout(2000)

    for (const [code, label] of CATS) {
      const row: Record<string, unknown> = { code, label }
      try {
        const resp = await page.goto(`${BASE}/goods/goods_view/${code}/1`, { waitUntil: 'networkidle', timeout: 30000 })
        if (!resp || resp.status() >= 400) { row.error = `HTTP ${resp?.status()}`; rows.push(row); continue }
        // 용지 선택해 종속필드 populate
        const pc = await page.$('select[name="paper_code"]') || await page.$('select[name="cover_paper_code"]')
        if (pc) { await pc.evaluate((el: Element) => { const s = el as HTMLSelectElement; const o = Array.from(s.options).find(x => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) } }); await page.waitForTimeout(800) }
        const audit = await page.evaluate((params: { canon: string[]; alias: Record<string, string> }) => {
          const has = (n: string) => !!document.querySelector(`select[name="${n}"], input[name="${n}"]`)
          const core: Record<string, { field: string; present: boolean }> = {}
          for (const o of params.canon) { const f = params.alias[o] ?? o; core[o] = { field: f, present: has(f) } }
          const chks = Array.from(document.querySelectorAll('[id^="chk_is_"]')).map(e => e.id.replace('chk_is_', ''))
          return { core, finishings: chks }
        }, { canon: CANON, alias: ALIAS[code] ?? {} })
        row.core = audit.core
        row.finishings = audit.finishings
        row.coreOk = Object.values(audit.core).every((c) => c.present)
      } catch (e) { row.error = String(e) }
      rows.push(row)
    }
  } finally {
    fs.writeFileSync(`${OUT}/allcat-audit.json`, JSON.stringify({ rows }, null, 2))
    await browser.close()
  }
  console.log('done', rows.length)
}
main()
