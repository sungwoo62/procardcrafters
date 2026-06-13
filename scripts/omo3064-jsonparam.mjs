/**
 * OMO-3064 — bare json_data POST 가 size 파라미터를 받아 size별 매트릭스를 반환하는지 검증.
 * 받으면 → 저렴한 lookupPressCost 경로로 size-키 라우팅 확장 가능(브라우저 불필요).
 * 못 받으면 → 멀티사이즈 라우팅은 product1 인터랙티브(Playwright) 경로만 가능.
 * 실행: node scripts/omo3064-jsonparam.mjs
 */
const BASE = 'https://www.swadpia.co.kr'
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [])

async function fetchWith(code, extra = {}) {
  const body = new URLSearchParams({ t: String(Math.floor(Date.now() / 1000)), product: 'name', category_code: code, ...extra })
  const r = await fetch(`${BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/goods/goods_view/${code}`, 'User-Agent': 'Mozilla/5.0' },
    body: body.toString(),
  })
  return r.json()
}
// 매트릭스 q1 가격 시그니처(첫 유효 print_unit2)
function sig(j) {
  for (const k of ['print_info1', 'print_info3', 'print_info2']) {
    const f = arr(j[k]).map((e) => ({ q: parseInt(e.unit_key, 10), p: Number(e['0']?.print_unit2) || 0 })).filter((e) => e.p > 0)
    if (f.length) return { key: k, n: f.length, q1: f[0] }
  }
  return null
}

const CODE = 'CPR2000'
const SIZES = ['A0100', 'A0200', 'A0300', 'B0200', 'B0300', 'B0400'] // discover 에서 확인된 paper_size 값
// size 를 표현할 수 있는 파라미터명 후보 — 어느 것이든 매트릭스가 갈라지면 채택
const PARAM_NAMES = ['paper_size', 'size', 'paper_size_code', 'print_size', 'size_code']

console.log(`=== ${CODE}: bare json_data 기준선 ===`)
const base = sig(await fetchWith(CODE))
console.log(`  base: ${base ? `${base.key} n=${base.n} q1=${base.q1.q}부→${base.q1.p}원` : 'none'}`)

for (const pname of PARAM_NAMES) {
  console.log(`\n--- 파라미터 '${pname}' 로 size 분기 시도 ---`)
  const seen = new Set()
  for (const sz of SIZES) {
    const s = sig(await fetchWith(CODE, { [pname]: sz }))
    const key = s ? `${s.q1.q}:${s.q1.p}` : 'none'
    seen.add(key)
    console.log(`  ${pname}=${sz.padEnd(7)} → ${s ? `n=${s.n} q1=${s.q1.q}부→${s.q1.p}원` : 'none'}`)
  }
  console.log(seen.size > 1 ? `  ✅ '${pname}' 가 size별 매트릭스를 분기시킴 → 저렴경로 가능` : `  ⛔ '${pname}' 무시됨(전 size 동일/none)`)
}
