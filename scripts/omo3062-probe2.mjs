/**
 * OMO-3062 probe2 — 후보쌍 print_info1 매트릭스가 size 디폴트에 잠겨있는지 확정.
 * size_info 개수를 세고, 동일 코드의 명함(검증된) 매트릭스와 값이 다른지 대조한다.
 */
const BASE = 'https://www.swadpia.co.kr'
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [])

async function fetchRaw(code) {
  const body = new URLSearchParams({ t: String(Math.floor(Date.now() / 1000)), product: 'name', category_code: code })
  const r = await fetch(`${BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/goods/goods_view/${code}`, 'User-Agent': 'Mozilla/5.0' },
    body: body.toString(),
  })
  return r.json()
}

function q1price(j) {
  for (const k of ['print_info1', 'print_info3']) {
    const f = arr(j[k]).map((e) => ({ q: parseInt(e.unit_key, 10), p: Number(e['0']?.print_unit2) || 0 })).filter((e) => e.p > 0)
    if (f.length) return f[0]
  }
  return null
}

const CODES = ['CNC1000', 'CDP1000', 'CPR2000', 'CDP4000', 'CPR3000', 'CDP7000', 'CLF2000', 'CDP8000', 'CPR4000', 'CDP5000']
for (const code of CODES) {
  const j = await fetchRaw(code)
  const sizes = arr(j.size_info)
  const q1 = q1price(j)
  // size_info 엔트리 라벨 샘플
  const labels = sizes.slice(0, 6).map((s) => s.size_name || s.name || s.cut_norm_x + 'x' + s.cut_norm_y || JSON.stringify(s).slice(0, 24))
  console.log(`${code.padEnd(8)} sizes=${String(sizes.length).padStart(3)} q1=${q1 ? q1.p + '원' : 'none'}  [${labels.join(' | ')}]`)
}
