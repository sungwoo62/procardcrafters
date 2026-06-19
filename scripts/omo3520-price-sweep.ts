/**
 * OMO-3520: 수량/옵션 변동 가격·parity 스윕 (보드 요청 — "수량 변동이랑 여러가지 테스트").
 *
 * READ-ONLY: 로그인 1회 → CNC1000 명함 폼을 케이스별로 새로고침·옵션적용·calcuEstimate 후
 *   hidden total_price/pay_amt + {type}_amt 직독. **발주/제출/파일업로드 없음(실비 0)**.
 * 대표 E2E(파일 업로드+제출)는 이미 OSA260619512225 로 실증 — 본 스윕은 가격/옵션 커버리지 확장.
 *
 * 실행: node --experimental-strip-types --import ./scripts/_ts-alias-register.mjs --env-file=.env.local scripts/omo3520-price-sweep.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { chromium } from 'playwright'
import { selectOrderOptions } from '../src/lib/swadpia-order'
import { expandFinishingToSwadpiaFields } from '../src/config/swadpia-finishing-fields'

const BASE = 'https://www.swadpia.co.kr'
const ART = path.join(import.meta.dirname ?? __dirname, 'test-artifacts', 'omo3520')
const OUT = path.join(ART, 'price-sweep.json')

const COMMON = { paper_code: 'SNW300W00', print_color_type: 'CTN40', paper_size: 'N0100' }
const FOIL = { finishing: 'foil_stamp', bak_x_size_1: '50', bak_y_size_1: '30' }

interface SweepCase { id: string; label: string; qty: number; opts: Record<string, string> }
const CASES: SweepCase[] = [
  // ① 수량 변동(박 50×30 고정) — 본가·박이 수량따라 어떻게 스케일하는지
  { id: 'q200-foil', label: '200매 · 박', qty: 200, opts: { ...COMMON, ...FOIL } },
  { id: 'q400-foil', label: '400매 · 박', qty: 400, opts: { ...COMMON, ...FOIL } },
  { id: 'q600-foil', label: '600매 · 박', qty: 600, opts: { ...COMMON, ...FOIL } },
  { id: 'q1000-foil', label: '1,000매 · 박', qty: 1000, opts: { ...COMMON, ...FOIL } },
  { id: 'q2000-foil', label: '2,000매 · 박', qty: 2000, opts: { ...COMMON, ...FOIL } },
  // ② 후가공 변동(200매 고정)
  { id: 'q200-none', label: '200매 · 후가공 없음', qty: 200, opts: { ...COMMON } },
  { id: 'q200-diecut', label: '200매 · 도무송', qty: 200, opts: { ...COMMON, finishing: 'die_cut' } },
  { id: 'q200-drill', label: '200매 · 타공', qty: 200, opts: { ...COMMON, finishing: 'drilled_hole' } },
  { id: 'q200-epoxy', label: '200매 · 에폭시', qty: 200, opts: { ...COMMON, finishing: 'epoxy' } },
  // ③ 단면 vs 양면(박 고정)
  { id: 'q200-1side', label: '200매 · 단면 · 박', qty: 200, opts: { ...COMMON, print_color_type: 'CTN10', ...FOIL } },
]

function log(m: string) { process.stdout.write(`[${new Date().toLocaleTimeString('ko-KR')}] ${m}\n`) }

async function main() {
  if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) { log('no creds'); process.exit(1) }
  fs.mkdirSync(ART, { recursive: true })
  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext({ locale: 'ko-KR', viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())

  // 로그인 1회
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
  await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => {}), page.click('#icon_member_login')])
  await page.waitForTimeout(1500)

  const results = []
  for (const c of CASES) {
    try {
      await page.goto(`${BASE}/goods/goods_view/CNC1000/1`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      const expanded = expandFinishingToSwadpiaFields(c.opts) // finishing → 성원 필드코드
      await selectOrderOptions(page, expanded, c.qty, {})
      await page.waitForTimeout(800)
      const snap = await page.evaluate(() => {
        const readNum = (sel: string): number | null => {
          const el = document.querySelector(sel) as HTMLInputElement | null
          if (!el) return null
          const d = String(el.value ?? el.textContent ?? '').replace(/[^0-9]/g, '')
          const n = parseInt(d, 10); return Number.isFinite(n) && n > 0 ? n : null
        }
        const total = readNum('#total_price') ?? readNum('[name="total_price"]') ?? readNum('[name="pay_amt"]')
        const amts: Record<string, number> = {}
        for (const t of ['bak', 'ap', 'domusong', 'tagong', 'epoxy', 'osi', 'missing', 'guidori', 'numbering']) {
          const a = readNum(`[name="${t}_amt"]`); if (a) amts[t] = a
        }
        const applied: Record<string, string> = {}
        for (const n of ['paper_code', 'print_color_type', 'paper_size', 'paper_qty']) {
          const el = document.querySelector(`[name="${n}"]`) as HTMLInputElement | null
          if (el) applied[n] = el.value
        }
        return { total, amts, applied }
      })
      const finishingAmt = Object.values(snap.amts).reduce((s, v) => s + v, 0)
      const baseKrw = snap.total != null ? snap.total - finishingAmt : null
      results.push({ ...c, ok: true, payAmtKrw: snap.total, finishingAmt, baseKrw, amts: snap.amts, applied: snap.applied })
      log(`${c.label}: pay_amt=${snap.total} 후가공=${finishingAmt} base≈${baseKrw} qty적용=${snap.applied.paper_qty}`)
    } catch (e) {
      results.push({ ...c, ok: false, error: e instanceof Error ? e.message.split('\n')[0] : String(e) })
      log(`${c.label}: FAIL ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
  }
  await b.close()
  fs.writeFileSync(OUT, JSON.stringify({ ranAt: new Date().toISOString(), cases: results }, null, 2))
  log(`적재: ${OUT} (${results.filter((r) => r.ok).length}/${results.length} ok)`)
}
main().catch((e) => { log('예외 ' + (e instanceof Error ? e.message : e)); process.exit(1) })
