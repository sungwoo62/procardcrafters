/**
 * OMO-3035 verify: 권고 시드 표지 후보(백색 특수지)의 3단 cascade + BDT6 노출 + page 범위 확정. READ-ONLY.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3035-verify-white.mts
 */
import * as fs from 'fs'
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3035'
const CANDIDATES = ['MGM200W01', 'MGM250W01', 'MGM200OW0'] // 백색/연미색 특수지 200~250g

async function login(page: Page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
  await page.waitForTimeout(1500)
}

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept().catch(() => {}))
  await login(page)
  await page.goto(`${BASE}/goods/goods_view/CPR4000/1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)

  const out: Record<string, unknown>[] = []
  for (const code of CANDIDATES) {
    const r = await page.evaluate((targetCode: string) => {
      const sel = (n: string) => document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
      const fire = (s: HTMLSelectElement | null, v: string) => { if (s) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })) } }
      fire(sel('cover_paper_kind'), 'PKD30')
      // 코드가 속한 type 찾기
      const tSel = sel('cover_paper_type')
      let foundType: string | null = null
      let typeLabel = ''
      if (tSel) for (const to of Array.from(tSel.options).map((o) => [o.value, o.text]).filter((x) => x[0])) {
        fire(tSel, to[0])
        const cSel = sel('cover_paper_code')
        if (cSel && Array.from(cSel.options).some((o) => o.value === targetCode)) { foundType = to[0]; typeLabel = to[1]; break }
      }
      if (!foundType) return { code: targetCode, found: false }
      const cSel = sel('cover_paper_code')
      const codeLabel = cSel ? (Array.from(cSel.options).find((o) => o.value === targetCode)?.text || '') : ''
      fire(cSel, targetCode)
      // 내지 첫 유효옵션
      for (const f of ['in_paper_kind', 'in_paper_type', 'in_paper_code']) {
        const s = sel(f); if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) fire(s, o.value) }
      }
      const inPaper = { kind: sel('in_paper_kind')?.value, type: sel('in_paper_type')?.value, code: sel('in_paper_code')?.value }
      // page sweep
      const pq = sel('in_page_qty')
      const opts = pq ? Array.from(pq.options).map((o) => o.value).filter(Boolean) : []
      const bindSnap = () => { const s = sel('binding_type'); return s ? Array.from(s.options).map((o) => o.value).filter(Boolean) : null }
      const withB: string[] = []
      for (const v of opts) { if (pq) { pq.value = v; pq.dispatchEvent(new Event('change', { bubbles: true })) } const b = bindSnap(); if (b && b.includes('BDT6')) withB.push(v) }
      // 최소 BDT6 페이지에서 binding default 확인
      const minPage = withB[0]
      if (pq && minPage) { pq.value = minPage; pq.dispatchEvent(new Event('change', { bubbles: true })) }
      const bindingAtMin = (() => { const s = sel('binding_type'); return s ? Array.from(s.options).map((o) => [o.value, o.text]) : null })()
      return { code: targetCode, found: true, cascade: { cover_paper_kind: 'PKD30', cover_paper_type: foundType, typeLabel, cover_paper_code: targetCode, codeLabel }, inPaper, nPageOpts: opts.length, bdt6PageCount: withB.length, bdt6PageMin: withB[0] || null, bdt6PageMax: withB[withB.length - 1] || null, bindingAtMinPage: bindingAtMin }
    }, code)
    out.push(r)
    console.log(JSON.stringify(r.cascade || { code, found: false }), '| BDT6 pages:', r.bdt6PageCount, `(${r.bdt6PageMin}~${r.bdt6PageMax})`)
  }
  fs.writeFileSync(`${OUT}/verify-white.json`, JSON.stringify(out, null, 2))
  await browser.close()
}
main()
