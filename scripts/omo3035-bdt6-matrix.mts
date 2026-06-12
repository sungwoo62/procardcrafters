/**
 * OMO-3035: 책자 PUR무선(BDT6) 호환 표지/페이지 매트릭스 — 라이브 READ-ONLY probe.
 * PKD30(특수지) cover_paper_code 단위로 3단 cascade(kind→type→code) 정확 설정 후
 * binding_type 에 BDT6 가 실제 노출되는 코드 확정 + 해당 표지에서 BDT6 노출 in_page_qty 범위 확정.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3035-bdt6-matrix.mts
 * 주문/결제 없음.
 */
import * as fs from 'fs'
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3035'

async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
  await page.waitForTimeout(1500)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  await login(page)
  await page.goto(`${BASE}/goods/goods_view/CPR4000/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)

  // ── A. PKD30(특수지) 3단 cascade 정밀: type별 code별 binding_type 스냅 ──
  const matrix = await page.evaluate(() => {
    const sel = (n: string) => document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
    const fire = (s: HTMLSelectElement, v: string) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })) }
    const bindSnap = () => { const s = sel('binding_type'); return s ? Array.from(s.options).map((o) => o.value).filter(Boolean) : null }
    const kind = sel('cover_paper_kind')
    if (!kind) return { err: 'no cover_paper_kind' }
    fire(kind, 'PKD30')
    const tSel = sel('cover_paper_type')
    const types = tSel ? Array.from(tSel.options).map((o) => [o.value, o.text]).filter((x) => x[0]) : []
    const rows: { type: string; typeLabel: string; code: string; codeLabel: string; binding: string[] | null; hasBDT6: boolean }[] = []
    for (const [tv, tl] of types) {
      if (tSel) fire(tSel, tv)
      const cSel = sel('cover_paper_code')
      const codes = cSel ? Array.from(cSel.options).map((o) => [o.value, o.text]).filter((x) => x[0]) : []
      for (const [cv, cl] of codes) {
        if (cSel) fire(cSel, cv)
        const b = bindSnap()
        rows.push({ type: tv, typeLabel: tl, code: cv, codeLabel: cl, binding: b, hasBDT6: !!b && b.includes('BDT6') })
      }
    }
    return { kind: 'PKD30', nTypes: types.length, rows }
  })

  // ── B. BDT6 노출 표지 후보 상위 2개에서 in_page_qty 전수 스윕 ──
  const rows = (matrix as { rows?: { type: string; code: string; hasBDT6: boolean; codeLabel: string }[] }).rows || []
  const bdt6Codes = rows.filter((r) => r.hasBDT6).slice(0, 2)
  const pageSweeps: Record<string, unknown>[] = []
  for (const cand of bdt6Codes) {
    // 표지 재설정 (PKD30 → type → code)
    await page.evaluate((c: { type: string; code: string }) => {
      const sel = (n: string) => document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
      const fire = (s: HTMLSelectElement | null, v: string) => { if (s) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })) } }
      fire(sel('cover_paper_kind'), 'PKD30')
      fire(sel('cover_paper_type'), c.type)
      fire(sel('cover_paper_code'), c.code)
      // 내지 용지도 첫 유효옵션으로 설정 (in_page_qty 가 내지 종속일 수 있음)
      for (const f of ['in_paper_kind', 'in_paper_type', 'in_paper_code']) {
        const s = sel(f); if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) fire(s, o.value) }
      }
    }, cand)
    await page.waitForTimeout(400)
    const sweep = await page.evaluate(() => {
      const sel = (n: string) => document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
      const bindSnap = () => { const s = sel('binding_type'); return s ? Array.from(s.options).map((o) => o.value).filter(Boolean) : null }
      const pq = sel('in_page_qty')
      const opts = pq ? Array.from(pq.options).map((o) => o.value).filter(Boolean) : []
      const results: { in_page_qty: string; binding: string[] | null; hasBDT6: boolean }[] = []
      for (const v of opts) {
        if (pq) { pq.value = v; pq.dispatchEvent(new Event('change', { bubbles: true })) }
        const b = bindSnap()
        results.push({ in_page_qty: v, binding: b, hasBDT6: !!b && b.includes('BDT6') })
      }
      // 표지 재확인 (sweep 후 binding 이 표지 기준으로 남는지)
      return { nOpts: opts.length, results }
    })
    const bdt6Pages = sweep.results.filter((r) => r.hasBDT6).map((r) => r.in_page_qty)
    pageSweeps.push({ type: cand.type, code: cand.code, codeLabel: cand.codeLabel, nOpts: sweep.nOpts, bdt6PageCount: bdt6Pages.length, bdt6PageRange: bdt6Pages.length ? [bdt6Pages[0], bdt6Pages[bdt6Pages.length - 1]] : null, bdt6Pages, allResults: sweep.results })
  }

  const result = { matrix, bdt6Codes, pageSweeps }
  fs.writeFileSync(`${OUT}/bdt6-matrix.json`, JSON.stringify(result, null, 2))
  console.log('=== PKD30 BDT6 노출 표지 코드 ===')
  for (const r of rows.filter((x) => x.hasBDT6)) console.log(`  type=${r.type} code=${r.code} (${r.codeLabel})`)
  console.log(`  총 ${rows.length}개 코드 중 BDT6 노출 ${rows.filter((x) => x.hasBDT6).length}개`)
  console.log('\n=== in_page_qty 스윕 ===')
  for (const ps of pageSweeps) console.log(`  ${ps.code}: ${ps.bdt6PageCount}/${ps.nOpts} 페이지옵션에서 BDT6 노출, range=${JSON.stringify(ps.bdt6PageRange)}`)
  await browser.close()
}
main()
