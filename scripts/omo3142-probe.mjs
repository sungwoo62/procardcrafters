// OMO-3142 재감사: matrix-default 카테고리가 generic endpoint 에서
// 결정적 매트릭스 기준단가를 주는지(=valid) garbage/non-matrix 인지 라이브 probe.
const BASE = 'https://www.swadpia.co.kr'

const parseNumber = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// slug → category_code (matrix-default 후보; quote-only/paper 는 제외)
const TARGETS = {
  'business-cards': 'CNC1000',
  'premium-business-cards': 'CNC2000',
  'premium-foil-cards': 'CNC3000',
  'letterpress-business-cards': 'CNC4000',
  'transparent-business-cards': 'CNC5000',
  'uv-business-cards': 'CNC6000',
  'pearl-business-cards': 'CNC2000',
  'transparent-stickers': 'CST1000',
  'kraft-stickers': 'CST1000',
  'eco-stickers': 'CST1000',
  'brochures': 'CLF2000',
  'leaflets': 'CPR3000',
  'saddle-stitch-booklet': 'CPR4000',
  'invitation-cards': 'CVS1000',
  'wedding-cards': 'CDP2000',
  'greeting-cards-general': 'CCM2000',
  'memo-pads-general': 'CNR3000',
  'sticky-notes': 'CPS7000',
  'posters': 'CPR2000',
  'wall-calendars': 'CCD1000',
  'desk-calendars': 'CCD2000',
  'general-boxes': 'CHI3000',
  'paper-shopping-bags': 'CPK4000',
  'kraft-bags': 'CPK3000',
  'gift-bags': 'CPK2000',
}

async function probe(code) {
  const body = new URLSearchParams({
    t: String(Math.floor(Date.now() / 1000)),
    product: 'name',
    category_code: code,
  })
  const res = await fetch(`${BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/goods/goods_view/${code}`,
      'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersPriceBot/1.0)',
    },
    body: body.toString(),
  })
  if (!res.ok) return { ok: false, status: res.status }
  const raw = await res.json()
  const entries = []
  for (const e of raw.print_info1 ?? []) {
    const qty = parseInt(String(e.unit_key), 10)
    if (isNaN(qty)) continue
    const info = e['0']
    if (!info) continue
    entries.push({ qty, pu2: parseNumber(info.print_unit2), paper: String(info.paper_code ?? '') })
  }
  // extractMatrixBasePriceKrw 재현
  let derived = null
  if (entries.length) {
    const minQty = Math.min(...entries.map((e) => e.qty))
    const atMin = entries
      .filter((e) => e.qty === minQty)
      .sort((a, b) => a.pu2 - b.pu2 || a.paper.localeCompare(b.paper))
    const chosen = atMin[0]
    if (chosen && chosen.pu2 > 0) derived = Math.round(chosen.pu2)
  }
  return {
    ok: true,
    papers: (raw.paper_info ?? []).length,
    matrixRows: entries.length,
    minQty: entries.length ? Math.min(...entries.map((e) => e.qty)) : null,
    derived,
  }
}

const seen = new Set()
for (const [slug, code] of Object.entries(TARGETS)) {
  const key = code
  let r
  try {
    r = await probe(code)
  } catch (err) {
    r = { ok: false, err: String(err) }
  }
  const dup = seen.has(key) ? ' (dup code)' : ''
  seen.add(key)
  console.log(
    `${slug.padEnd(26)} ${code.padEnd(8)} ` +
      (r.ok
        ? `papers=${String(r.papers).padStart(3)} matrixRows=${String(r.matrixRows).padStart(3)} minQty=${String(r.minQty).padStart(5)} derived=${r.derived}`
        : `FETCH_FAIL ${r.status ?? r.err}`) +
      dup,
  )
  await new Promise((res) => setTimeout(res, 400)) // rate-limit 예의
}
