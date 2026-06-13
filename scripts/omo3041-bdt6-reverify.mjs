/**
 * OMO-3041 재검증 (READ-ONLY, 로그인 없음, 주문/결제 없음)
 * 새 기본 표지 MGM200W01(PKD30/MGM) + in_page_qty 28/32/64 에서 binding_type 의 BDT6 노출 확인.
 * 실행: node --experimental-strip-types scripts/omo3041-bdt6-reverify.mjs
 */
import { chromium } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const TARGET_COVER = 'MGM200W01'
const PAGE_TESTS = ['28', '32', '64'] // 28=게이트 미달(BDT6 없음 기대), 32=최소, 64=권장 기본

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  viewport: { width: 1280, height: 900 },
})
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept().catch(() => {}))

const result = { target_cover: TARGET_COVER, ts: new Date().toISOString(), page_results: {} }
try {
  await page.goto(`${BASE}/goods/goods_view/CPR4000/1`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(2500)

  // 1) cover cascade: PKD30 -> (find type holding MGM200W01) -> set code
  const cascade = await page.evaluate((targetCode) => {
    const sel = (n) => document.querySelector(`select[name="${n}"]`)
    const fire = (s, v) => { if (s) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })) } }
    const kindSel = sel('cover_paper_kind')
    if (!kindSel) return { ok: false, why: 'cover_paper_kind select 없음(로그인 필요 가능성)' }
    fire(kindSel, 'PKD30')
    const tSel = sel('cover_paper_type')
    let foundType = null, typeLabel = ''
    if (tSel) for (const o of Array.from(tSel.options)) {
      if (!o.value) continue
      fire(tSel, o.value)
      const cSel = sel('cover_paper_code')
      if (cSel && Array.from(cSel.options).some((x) => x.value === targetCode)) { foundType = o.value; typeLabel = o.text.trim(); break }
    }
    if (!foundType) return { ok: false, why: 'MGM200W01 담은 cover_paper_type 못 찾음', kindOpts: kindSel ? Array.from(kindSel.options).map(o=>o.value).filter(Boolean) : [] }
    const cSel = sel('cover_paper_code')
    const codeLabel = cSel ? (Array.from(cSel.options).find((o) => o.value === targetCode)?.text || '').trim() : ''
    fire(cSel, targetCode)
    // 내지 첫 유효옵션
    for (const f of ['in_paper_kind', 'in_paper_type', 'in_paper_code']) {
      const s = sel(f); if (s) { const o = Array.from(s.options).find((x) => x.value); if (o) fire(s, o.value) }
    }
    return { ok: true, cover_paper_kind: 'PKD30', cover_paper_type: foundType, typeLabel, cover_paper_code: targetCode, codeLabel,
      in_paper: { kind: sel('in_paper_kind')?.value, type: sel('in_paper_type')?.value, code: sel('in_paper_code')?.value } }
  }, TARGET_COVER)
  result.cascade = cascade

  if (cascade.ok) {
    // 2) page sweep: 각 in_page_qty 에서 binding_type 옵션 스냅
    for (const pageVal of PAGE_TESTS) {
      const snap = await page.evaluate((pv) => {
        const sel = (n) => document.querySelector(`select[name="${n}"]`)
        const pq = sel('in_page_qty')
        const avail = pq ? Array.from(pq.options).map((o) => o.value).filter(Boolean) : []
        if (!pq || !avail.includes(pv)) return { applied: null, available_in_select: avail.includes(pv), binding: null, nPageOpts: avail.length }
        pq.value = pv; pq.dispatchEvent(new Event('change', { bubbles: true }))
        const bs = sel('binding_type')
        const binding = bs ? Array.from(bs.options).filter((o) => o.value).map((o) => [o.value, o.text.replace(/\s+/g, ' ').trim()]) : null
        const def = bs ? bs.value : null
        return { applied: pv, available_in_select: true, nPageOpts: avail.length, binding_default: def, binding, has_BDT6: binding ? binding.some((b) => b[0] === 'BDT6') : false }
      }, pageVal)
      result.page_results[pageVal] = snap
      console.error(`in_page_qty=${pageVal}: BDT6=${snap.has_BDT6} binding=${JSON.stringify(snap.binding)}`)
      await page.waitForTimeout(400)
    }
    // 증빙 스크린샷 (64p 상태)
    await page.screenshot({ path: '/tmp/omo3041-bdt6-64p.png', fullPage: false }).catch(() => {})
  } else {
    console.error('CASCADE FAIL:', cascade.why)
  }
} catch (e) {
  result.error = e.message
  console.error('ERR', e.message)
} finally {
  await browser.close()
}
console.log(JSON.stringify(result, null, 2))
