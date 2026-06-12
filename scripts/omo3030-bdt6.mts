/** OMO-3030: 책자 BDT6 정밀 — cover_paper_code=ARE160W00(시드값) 설정 시 binding_type 에 BDT6 존재 여부. READ-ONLY. */
import * as fs from 'fs'
import type { Page } from 'playwright'
const BASE = 'https://www.swadpia.co.kr'
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
  const r = await page.evaluate(() => {
    const sel = (n: string) => document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null
    const opts = (n: string) => { const s = sel(n); return s ? Array.from(s.options).map((o) => [o.value, o.text]) : null }
    const bindingSnap = () => { const s = sel('binding_type'); return s ? Array.from(s.options).map((o) => o.value) : null }
    // 1) cover_paper_kind 별로 cover_paper_code 목록 + ARE160W00 소속 찾기
    const kindSel = sel('cover_paper_kind')
    const kinds = kindSel ? Array.from(kindSel.options).map((o) => o.value).filter(Boolean) : []
    const kindMap: Record<string, { codes: string[]; binding: string[] | null; hasARE160: boolean }> = {}
    for (const k of kinds) {
      if (kindSel) { kindSel.value = k; kindSel.dispatchEvent(new Event('change', { bubbles: true })) }
      const tSel = sel('cover_paper_type')
      if (tSel) { const o = Array.from(tSel.options).find((x) => x.value); if (o) { tSel.value = o.value; tSel.dispatchEvent(new Event('change', { bubbles: true })) } }
      const codes = (sel('cover_paper_code') ? Array.from(sel('cover_paper_code')!.options).map((o) => o.value).filter(Boolean) : [])
      // cover_paper_type 전체 순회해 code 수집
      const allCodes = new Set<string>()
      if (tSel) for (const to of Array.from(tSel.options).map((o) => o.value).filter(Boolean)) {
        tSel.value = to; tSel.dispatchEvent(new Event('change', { bubbles: true }))
        const cs = sel('cover_paper_code'); if (cs) for (const c of Array.from(cs.options).map((o) => o.value).filter(Boolean)) allCodes.add(c)
      }
      kindMap[k] = { codes: [...allCodes].slice(0, 30), binding: bindingSnap(), hasARE160: allCodes.has('ARE160W00') }
      void codes
    }
    // 2) ARE160W00 직접 설정 시 binding_type
    let directBinding: string[] | null = null
    const cc = sel('cover_paper_code')
    if (cc && Array.from(cc.options).some((o) => o.value === 'ARE160W00')) {
      cc.value = 'ARE160W00'; cc.dispatchEvent(new Event('change', { bubbles: true }))
      directBinding = bindingSnap()
    }
    return { cover_paper_kind: opts('cover_paper_kind'), kindMap, directBinding }
  })
  fs.writeFileSync('scripts/test-artifacts/omo3030/bdt6.json', JSON.stringify(r, null, 2))
  console.log('cover_paper_kind:', JSON.stringify(r.cover_paper_kind))
  for (const [k, v] of Object.entries(r.kindMap)) console.log(`${k}: binding=${JSON.stringify(v.binding)} hasARE160W00=${v.hasARE160} nCodes=${v.codes.length}`)
  console.log('directBinding(ARE160W00):', JSON.stringify(r.directBinding))
  await browser.close()
}
main()
