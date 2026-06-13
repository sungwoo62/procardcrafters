/**
 * OMO-3062 — 추가 듀얼 프레스 쌍 옵션단위 가격정합 검증 + 토너(COD) 견적경로 조사
 *
 * 목적: posters/booklets/leaflets/brochures 후보쌍이 lookupPressCost 의
 *   "수량→단일 print_unit2" 가정에 맞는지 확인한다. 대형판(size)·페이지수
 *   (in_page_qty)로 가격이 갈라지면 PRESS_ROUTES 등록 시 고객 오가격 위험.
 *
 * 또한 COD#### 토너 코드의 json_data 응답 구조를 덤프해 견적경로 유무를 본다.
 *
 * 실행: node scripts/omo3062-probe.mjs
 */
const BASE = 'https://www.swadpia.co.kr'
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [])

async function fetchRaw(code) {
  const body = new URLSearchParams({
    t: String(Math.floor(Date.now() / 1000)),
    product: 'name',
    category_code: code,
  })
  const r = await fetch(`${BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/goods/goods_view/${code}`,
      'User-Agent': 'Mozilla/5.0',
    },
    body: body.toString(),
  })
  return r.json()
}

// print_info* 의 raw 엔트리를 (quantity, paper_code, print_unit2, size_info) 로 평탄화
function flatten(src) {
  return arr(src)
    .map((e) => {
      const inner = e['0'] || {}
      return {
        quantity: parseInt(e.unit_key, 10),
        in_page_qty: e.in_page_qty ?? inner.in_page_qty,
        paper_code: inner.paper_code,
        print_unit2: Number(inner.print_unit2) || 0,
        size: inner.cut_norm_x && inner.cut_norm_y ? `${inner.cut_norm_x}x${inner.cut_norm_y}` : undefined,
      }
    })
    .filter((e) => !isNaN(e.quantity))
}

// 한 코드의 매트릭스 구조를 요약: 수량 단계별로 print_unit2 가 단일값인지(=라우팅 안전)
function analyze(label, j) {
  const keys = Object.keys(j).filter((k) => /^print_info\d/.test(k))
  const populated = keys.filter((k) => arr(j[k]).length > 0)
  // print_unit2 가 실린 매트릭스 우선 선택
  let chosen = null
  for (const k of populated) {
    const f = flatten(j[k])
    if (f.some((e) => e.print_unit2 > 0)) {
      chosen = { key: k, entries: f }
      break
    }
  }
  console.log(`\n── ${label} ──`)
  console.log(`  print_info 키: ${keys.join(',') || '(없음)'} | 데이터있음: ${populated.join(',') || '(없음)'}`)
  if (!chosen) {
    console.log('  ⚠️  print_unit2 가격 매트릭스 없음 → json_data 견적경로 불가')
    // size_info / paper 만 있는지
    const paperKeys = Object.keys(j).filter((k) => /paper|size|in_page/.test(k))
    console.log(`  보조키: ${paperKeys.join(',') || '(없음)'}`)
    return { routable: false }
  }
  const valid = chosen.entries.filter((e) => e.print_unit2 > 0)
  const qSteps = [...new Set(valid.map((e) => e.quantity))].sort((a, b) => a - b)
  // 수량단계별 print_unit2 의 분산(여러 값이면 옵션이 가격을 가른다 → 위험)
  let multi = 0
  const sample = []
  for (const q of qSteps) {
    const prices = [...new Set(valid.filter((e) => e.quantity === q).map((e) => e.print_unit2))]
    const dims = [...new Set(valid.filter((e) => e.quantity === q).map((e) => e.in_page_qty ?? e.size ?? e.paper_code))]
    if (prices.length > 1) multi++
    if (sample.length < 4) sample.push(`q${q}:{${prices.length}가격/${dims.length}옵션 ${prices.slice(0, 3).join(',')}}`)
  }
  console.log(`  매트릭스=${chosen.key} 엔트리=${valid.length} 수량단계=${qSteps.length}[${qSteps.slice(0, 3).join(',')}…${qSteps.slice(-1)}]`)
  console.log(`  샘플: ${sample.join(' | ')}`)
  if (multi > 0) {
    console.log(`  ⚠️  ${multi}/${qSteps.length} 수량단계에서 옵션별 가격분산 → 단순 수량라우팅 위험(옵션 고정 필요)`)
  } else {
    console.log(`  ✅ 모든 수량단계 단일가격 → lookupPressCost 안전`)
  }
  return { routable: true, multi, qSteps: qSteps.length, key: chosen.key }
}

const PAIRS = {
  posters: { offset: 'CPR2000', digital: 'CDP4000' },
  'saddle-stitch-booklet': { offset: 'CPR4000', digital: 'CDP5000' },
  leaflets: { offset: 'CPR3000', digital: 'CDP7000' },
  brochures: { offset: 'CLF2000', digital: 'CDP8000' },
}
const TONER = ['COD1000', 'COD1100']

console.log('=== 듀얼 프레스 후보쌍 옵션단위 검증 ===')
for (const [slug, { offset, digital }] of Object.entries(PAIRS)) {
  console.log(`\n### ${slug}  (offset ${offset} / digital ${digital})`)
  const [jo, jd] = await Promise.all([fetchRaw(offset), fetchRaw(digital)])
  const ao = analyze(`offset ${offset}`, jo)
  const ad = analyze(`digital ${digital}`, jd)
  const safe = ao.routable && ad.routable && !ao.multi && !ad.multi
  console.log(`  → 판정: ${safe ? '✅ 등록가능' : '⛔ 보류(옵션고정/구조차이)'}`)
}

console.log('\n\n=== 토너(COD) 견적경로 조사 ===')
for (const code of TONER) {
  const j = await fetchRaw(code)
  analyze(`toner ${code}`, j)
  // 토너는 print_info 가 비었다면 어떤 키가 채워지나 전수 덤프
  const nonEmpty = Object.keys(j).filter((k) => arr(j[k]).length > 0 || (j[k] && typeof j[k] !== 'object'))
  console.log(`  비어있지않은 키: ${nonEmpty.join(',')}`)
}
