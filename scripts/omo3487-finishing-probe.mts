/**
 * OMO-3487: 성원 전용·미매핑 후가공 13종 라이브 필드 추출. READ-ONLY (주문/결제 없음).
 *
 * 부모 OMO-3483 전수검사(scripts/test-artifacts/omo2961/allcat-audit.json, 2026-06-12)에서
 * 발견된 "성원 폼에 노출되나 우리 자동발주/카탈로그 미대응" 후가공 13종을, 각 토큰을 노출하는
 * 대표 카테고리 goods_view 폼에서 chk_is_<token> 를 토글했을 때 나타나는
 * select[name]/input[name] · 옵션값 · required 를 추출한다.
 *
 * 방법(결정론): 토글 전/후 폼 필드 name 집합을 diff → 그 토큰이 "드러내는" 필드만 격리.
 * omo2961-allcat-audit.mts / omo2961-runtime-probe.mts 의 확장.
 *
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo3487-finishing-probe.mts
 *   필요 env: SWADPIA_USERNAME, SWADPIA_PASSWORD  (현재 .env.local 미보유 → 보드 발급 대기)
 */
import * as fs from 'fs'
import type { Page } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const OUT = 'scripts/test-artifacts/omo3487'

// 13종 타깃 토큰(부모 OMO-3483 갭). 각 토큰을 노출하는 대표 카테고리에서 1회 이상 프로빙.
//   needs_audit 3종: coating, binding, window
//   성원전용 8종: cutting, add_cutting, partial_coating, bonding, folding, laminex, stitching, tape
//   불확실 2종: dbak, depoxy
const PROBE_PLAN: { code: string; label: string; tokens: string[] }[] = [
  // 홀로그램스티커: 가장 많은 성원전용 토큰을 한 폼에서 노출
  { code: 'CST5000', label: '홀로그램스티커', tokens: ['coating', 'cutting', 'binding', 'bonding', 'laminex', 'stitching', 'folding'] },
  // 도무송스티커: add_cutting 유일 노출처
  { code: 'CST2000', label: '도무송스티커', tokens: ['add_cutting', 'cutting', 'coating'] },
  // 책자: binding/partial_coating 의 표준 노출처
  { code: 'CPR4000', label: '책자', tokens: ['binding', 'partial_coating', 'coating'] },
  // 배너: tape/partial_coating/bonding
  { code: 'CPR5000', label: '배너', tokens: ['tape', 'partial_coating', 'bonding'] },
  // 봉투: window/tape 노출처
  { code: 'CEV1000', label: '봉투', tokens: ['window', 'tape'] },
  // 엽서: depoxy 유일 노출처 + dbak/bonding/folding 교차확인
  { code: 'CDP3000', label: '엽서', tokens: ['depoxy', 'dbak', 'bonding', 'folding'] },
  // 명함: dbak 표준 노출처
  { code: 'CNC1000', label: '명함', tokens: ['dbak'] },
]

interface FieldSnap { tag: string; name: string; type?: string; required: boolean; disabled: boolean; options?: { value: string; label: string }[] }

/** 현재 폼에 보이는(가시) select/input/radio 의 name→스냅샷. visible 만 집계해 토글 효과 격리. */
function snapFields(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, { tag: string; name: string; type?: string; required: boolean; disabled: boolean; options?: { value: string; label: string }[] }> = {}
    const isVisible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const st = getComputedStyle(el as HTMLElement)
      return st.display !== 'none' && st.visibility !== 'hidden' && (r.width > 0 || r.height > 0)
    }
    document.querySelectorAll('select[name], input[name], textarea[name]').forEach((el) => {
      const name = el.getAttribute('name') || ''
      if (!name || name.startsWith('chk_is_')) return
      if (!isVisible(el)) return
      const tag = el.tagName.toLowerCase()
      const type = el.getAttribute('type') || undefined
      const required = el.hasAttribute('required') || (el as HTMLInputElement).required === true
      const disabled = (el as HTMLInputElement).disabled === true
      let options: { value: string; label: string }[] | undefined
      if (tag === 'select') {
        options = Array.from((el as HTMLSelectElement).options).map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
      }
      // 같은 name 의 select 가 1순위(옵션 보유)
      if (!out[name] || (tag === 'select' && out[name].tag !== 'select')) out[name] = { tag, name, type, required, disabled, options }
    })
    return out
  })
}

async function selectFirstPaper(page: Page) {
  const pc = (await page.$('select[name="paper_code"]')) || (await page.$('select[name="cover_paper_code"]'))
  if (pc) {
    await pc.evaluate((el: Element) => {
      const s = el as HTMLSelectElement
      const o = Array.from(s.options).find((x) => x.value)
      if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) }
    })
    await page.waitForTimeout(800)
  }
}

/** chk_is_<token> 를 켜고(또는 라디오/체크) 그 효과로 새로 나타난 필드만 반환. */
async function probeToken(page: Page, token: string, before: Record<string, FieldSnap>) {
  const sel = `#chk_is_${token}`
  const exists = await page.$(sel)
  if (!exists) return { present: false as const }
  // 체크 + change/click 양쪽 디스패치(성원 onclick 핸들러 호환)
  await page.evaluate((s: string) => {
    const el = document.querySelector(s) as HTMLInputElement | null
    if (!el) return
    if (!el.checked) el.checked = true
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('click', { bubbles: true }))
    if (typeof (el as unknown as { onclick?: () => void }).onclick === 'function') (el as unknown as { onclick: () => void }).onclick()
  }, sel)
  await page.waitForTimeout(700)
  const after = await snapFields(page)
  const revealed: FieldSnap[] = []
  for (const [name, f] of Object.entries(after)) {
    if (!before[name]) revealed.push(f)
  }
  // 토글 원복(다음 토큰 격리)
  await page.evaluate((s: string) => {
    const el = document.querySelector(s) as HTMLInputElement | null
    if (!el) return
    if (el.checked) el.checked = false
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('click', { bubbles: true }))
  }, sel)
  await page.waitForTimeout(400)
  return { present: true as const, revealedFields: revealed }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const result: Record<string, unknown> = { probedAt: process.env.PROBE_DATE || 'unset', base: BASE, cats: {} }
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
    if (!result.loggedIn) throw new Error('로그인 실패 — SWADPIA_USERNAME/PASSWORD 확인')

    const cats = result.cats as Record<string, unknown>
    for (const plan of PROBE_PLAN) {
      const catOut: Record<string, unknown> = { label: plan.label }
      try {
        const resp = await page.goto(`${BASE}/goods/goods_view/${plan.code}/1`, { waitUntil: 'networkidle', timeout: 30000 })
        if (!resp || resp.status() >= 400) { catOut.error = `HTTP ${resp?.status()}`; cats[plan.code] = catOut; continue }
        await selectFirstPaper(page)
        const before = await snapFields(page)
        const tokens: Record<string, unknown> = {}
        for (const t of plan.tokens) {
          tokens[t] = await probeToken(page, t, before)
        }
        catOut.tokens = tokens
      } catch (e) {
        catOut.error = String(e)
      }
      cats[plan.code] = catOut
    }
  } finally {
    fs.writeFileSync(`${OUT}/finishing-probe.json`, JSON.stringify(result, null, 2))
    await browser.close()
  }
  console.log('done →', `${OUT}/finishing-probe.json`)
}

main()
