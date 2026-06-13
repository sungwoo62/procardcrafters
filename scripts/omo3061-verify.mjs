/**
 * OMO-3061 — 수량 기반 디지털/옵셋 자동 라우팅 라이브 검증
 *
 * src/lib/swadpia.ts 의 lookupPressCost/pickCheapestPress 와 동일한 로직을
 * 성원 라이브 가격에 적용해, PRESS_ROUTES 제품의 수량별 프레스 선택을 검증한다.
 *
 * 실행: node scripts/omo3061-verify.mjs
 */
const BASE = 'https://www.swadpia.co.kr'
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [])

// 검증 대상: 라이브 검증된 듀얼 프레스 쌍 (src/lib/swadpia.ts PRESS_ROUTES 와 일치)
const ROUTES = { 'business-cards': { offset: 'CNC1000', digital: 'CDP1000' } }

async function fetchEntries(code) {
  const body = new URLSearchParams({ t: String(Math.floor(Date.now() / 1000)), product: 'name', category_code: code })
  const r = await fetch(`${BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/goods/goods_view/${code}`, 'User-Agent': 'Mozilla/5.0' },
    body: body.toString(),
  })
  const j = await r.json()
  const src = arr(j.print_info1).length ? j.print_info1 : j.print_info3
  return arr(src)
    .map((e) => ({ quantity: parseInt(e.unit_key, 10), paper_code: e['0']?.paper_code, print_unit2: Number(e['0']?.print_unit2) || 0 }))
    .filter((e) => !isNaN(e.quantity))
}

// src/lib/swadpia.ts lookupPressCost 와 동일 로직
function lookupPressCost(entries, quantity, preferredPaper) {
  const valid = entries.filter((e) => e.print_unit2 > 0)
  if (!valid.length) return null
  const maxQ = valid.reduce((m, e) => Math.max(m, e.quantity), 0)
  if (quantity > maxQ) return null
  const steps = [...new Set(valid.map((e) => e.quantity))].sort((a, b) => a - b)
  const step = steps.find((s) => s >= quantity) ?? maxQ
  const atStep = valid.filter((e) => e.quantity === step)
  const pref = preferredPaper ? atStep.find((e) => e.paper_code === preferredPaper) : undefined
  const chosen = pref ?? atStep.reduce((m, e) => (e.print_unit2 < m.print_unit2 ? e : m), atStep[0])
  return { costKrw: chosen.print_unit2, effectiveQty: step, paperCode: chosen.paper_code }
}

function pickCheapestPress(quantity, presses) {
  let best = null
  for (const p of presses) {
    const c = lookupPressCost(p.entries, quantity)
    if (!c) continue
    if (!best || c.costKrw < best.costKrw) best = { press: p.press, categoryCode: p.categoryCode, ...c }
  }
  return best
}

let failures = 0
for (const [slug, route] of Object.entries(ROUTES)) {
  const [offset, digital] = await Promise.all([fetchEntries(route.offset), fetchEntries(route.digital)])
  const presses = [
    { press: 'offset', categoryCode: route.offset, entries: offset },
    { press: 'digital', categoryCode: route.digital, entries: digital },
  ]
  console.log(`\n### ${slug}  offset=${route.offset}(${offset.length}) digital=${route.digital}(${digital.length})`)
  // 기대: 초소량은 디지털, q10+ 는 옵셋, q>400 는 옵셋(디지털 불가)
  const expect = { 1: 'digital', 10: 'offset', 100: 'offset', 200: 'offset', 500: 'offset', 1000: 'offset' }
  for (const q of [1, 10, 100, 200, 500, 1000]) {
    const pick = pickCheapestPress(q, presses)
    const got = pick?.press ?? 'none'
    const ok = got === expect[q]
    if (!ok) failures++
    console.log(
      `  q${String(q).padStart(5)} → ${got.padEnd(8)} ${pick ? `${pick.costKrw}원@${pick.effectiveQty}(${pick.categoryCode})` : ''}  ${ok ? '✓' : `✗ expected ${expect[q]}`}`,
    )
  }
}
console.log(`\n${failures === 0 ? '✅ 모든 라우팅 기대치 일치' : `❌ ${failures}건 불일치`}`)
process.exit(failures === 0 ? 0 : 1)
