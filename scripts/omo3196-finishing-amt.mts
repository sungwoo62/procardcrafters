/**
 * OMO-3196: 명함(CNC1000) 후가공별 성원 surcharge(*_amt) 라이브 추출.
 * READ-ONLY — 주문/결제 없음. chk_is 활성화 + 필드세팅 + calcuEstimate 후 *_amt 읽기.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3196-finishing-amt.mts [CATEGORY]
 */
import * as fs from 'fs'
import type { Page } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3196'
const CATEGORY = process.argv[2] || 'CNC1000'

// finishingValue → { swadpia type, fields to set }
const FIN: { key: string; type: string; fields: Record<string, string> }[] = [
  { key: 'foil_stamp', type: 'bak', fields: { bak_section_1: 'BKS10', bak_side_1: 'BKD10', bak_type_1: 'BKT02', bak_compare_1: 'BAC10', bak_x_size_1: '50', bak_y_size_1: '30' } },
  { key: 'deboss_emboss', type: 'ap', fields: { ap_section_1: 'APS10', ap_type_1: 'APT10', ap_compare_1: 'BAC10', ap_x_size_1: '50', ap_y_size_1: '30' } },
  { key: 'die_cut', type: 'domusong', fields: { domusong_section: 'DMS20', domusong_type: 'DMT51', domusong_num: '1' } },
  { key: 'drilled_hole', type: 'tagong', fields: { tagong_num: '1', tagong_size: '4' } },
  { key: 'numbering', type: 'numbering', fields: { numbering_type: 'NBT10', numbering_kind: 'NBN11' } },
  { key: 'round_corner', type: 'guidori', fields: { guidori_type: 'GDR40' } },
  { key: 'epoxy', type: 'epoxy', fields: { epoxy_type: 'EPT10' } },
  { key: 'score_crease', type: 'osi', fields: { osi_num: 'OSN01', osi_direction: 'OMD10' } },
  { key: 'perforation', type: 'missing', fields: { missing_num: 'MSN01', missing_direction: 'OMD10' } },
]

function readAmt(page: Page, type: string) {
  return page.evaluate((t: string) => {
    const names = [`${t}_amt`, `${t}_amount`, `${t}_price`]
    for (const n of names) {
      const byName = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null
      if (byName && byName.value) return byName.value
      const byId = document.getElementById(n)
      if (byId) {
        const v = (byId as HTMLInputElement).value || byId.textContent || ''
        if (v.trim()) return v.trim()
      }
    }
    return null
  }, type)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const result: Record<string, unknown> = { category: CATEGORY }
  const amounts: Record<string, string | null> = {}
  try {
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('#icon_member_login'),
    ])
    await page.waitForTimeout(2000)
    result.loggedIn = !page.url().includes('/member/login')

    await page.goto(`${BASE}/goods/goods_view/${CATEGORY}/1`, { waitUntil: 'networkidle', timeout: 30000 })

    // 용지/사이즈 첫 옵션 선택
    for (const f of ['paper_code', 'paper_size']) {
      const sel = await page.$(`select[name="${f}"]`)
      if (sel) {
        await sel.evaluate((el: Element) => {
          const s = el as HTMLSelectElement
          const o = Array.from(s.options).find((x) => x.value && x.value !== '')
          if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) }
        })
        await page.waitForTimeout(600)
      }
    }

    // 수량 옵션 목록 추출 → 수량별로 후가공 surcharge 가 변하는지 확인
    const qtyOptions: string[] = await page.evaluate(() => {
      const s = document.querySelector('select[name="paper_qty"]') as HTMLSelectElement | null
      if (!s) return []
      return Array.from(s.options).map((o) => o.value).filter((v) => v && v !== '')
    })
    result.qtyOptions = qtyOptions
    // 컨피규레이터 수량범위만(MAXQTY 이하 + 바로 위 1개). 기본 14000.
    const MAXQTY = parseInt(process.env.MAXQTY || '14000', 10)
    const probeQtys = !qtyOptions.length
      ? ['']
      : (() => {
          const sorted = [...qtyOptions].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
          const out: string[] = []
          for (const q of sorted) { out.push(q); if (parseInt(q, 10) > MAXQTY) break }
          return out
        })()
    const byQty: Record<string, Record<string, string | null>> = {}

    for (const qty of probeQtys) {
      if (qty) {
        await page.evaluate((q: string) => {
          const s = document.querySelector('select[name="paper_qty"]') as HTMLSelectElement | null
          if (s) { s.value = q; s.dispatchEvent(new Event('change', { bubbles: true })) }
        }, qty)
        await page.waitForTimeout(700)
      }
      const perFin: Record<string, string | null> = {}
      for (const f of FIN) {
        await page.evaluate(({ type, fields }: { type: string; fields: Record<string, string> }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any
          const chk = document.getElementById(`chk_is_${type}`) as HTMLInputElement | null
          if (chk) { chk.checked = true; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
          for (const fn of [`chg${type[0].toUpperCase()}${type.slice(1)}`, `set${type[0].toUpperCase()}${type.slice(1)}`, 'setIsPostpress']) {
            try { if (typeof w[fn] === 'function') w[fn](type) } catch { /* */ }
          }
          for (const [name, value] of Object.entries(fields)) {
            const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null
            if (el) { (el as HTMLInputElement).value = value; el.dispatchEvent(new Event('change', { bubbles: true })) }
          }
          if (type === 'guidori') {
            for (let i = 1; i <= 4; i++) {
              const p = document.querySelector(`[name="guidori_position${i}"]`) as HTMLInputElement | null
              if (p) { p.checked = true; p.dispatchEvent(new Event('change', { bubbles: true })) }
            }
          }
          try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
        }, { type: f.type, fields: f.fields })
        await page.waitForTimeout(700)
        perFin[f.key] = await readAmt(page, f.type)
        await page.evaluate((type: string) => {
          const chk = document.getElementById(`chk_is_${type}`) as HTMLInputElement | null
          if (chk && chk.checked) { chk.checked = false; chk.dispatchEvent(new Event('click', { bubbles: true })); chk.dispatchEvent(new Event('change', { bubbles: true })) }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any
          try { w.product1 && w.product1.calcuEstimate() } catch { /* */ }
        }, f.type)
        await page.waitForTimeout(300)
      }
      byQty[qty || 'default'] = perFin
    }
    result.byQty = byQty
    result.amounts = byQty[probeQtys[0] || 'default']
  } catch (e) {
    result.error = String(e)
  } finally {
    fs.writeFileSync(`${OUT}/amt-${CATEGORY}.json`, JSON.stringify(result, null, 2))
    await browser.close()
  }
  console.log(JSON.stringify(result, null, 2))
}

main()
