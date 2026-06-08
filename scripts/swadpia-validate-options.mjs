// OMO-2634: print_product_options(DB) ↔ 성원애드피아 라이브 옵션값 검증.
//
// 목적: 자동발주(swadpia-order.ts selectOrderOptions)는 selectedOptions 의
//   key/value 를 성원 폼 select[name]/value 에 그대로 적용한다. 따라서 DB 에
//   시드된 옵션 value 가 성원 실제 코드와 다르면 발주 시 옵션이 적용되지 않거나
//   잘못된 사양으로 주문된다. 이 스크립트는 DB 옵션값을 성원 estimate JSON 의
//   실제 코드와 대조해 일치/불일치를 리포트한다.
//
// 한계(중요): estimate JSON 의 `product=name` 쿼리는 카테고리의 "대표 goods"
//   데이터를 반환한다. 한 카테고리코드에 여러 제품(예: CPR5000=미니/롤업/X배너,
//   CNR2000=영수증/견적서/거래명세서/NCR)이 매핑된 경우, 대표 goods 데이터가
//   특정 제품과 다를 수 있어 "불일치"가 곧 "DB가 틀림"을 의미하지는 않는다.
//   확정 검증은 제품별 goods_code 단위 데이터(런타임/goods 별 파라미터)가 필요하다.
//   CEV1000(봉투)은 이 JSON 쿼리가 빈 응답 → 'json_empty'.
//
// 실행: node --env-file=.env.local scripts/swadpia-validate-options.mjs
//   (DB 비교까지 하려면 SUPABASE_DB_URL 필요. 미설정 시 라이브 코드 덤프만.)

import { execFileSync } from 'node:child_process'

const SWADPIA_BASE = 'https://www.swadpia.co.kr'

// swadpia.ts CATEGORY_MAP 중 자동발주 미검증 23종(부모: OMO-2634)
const TARGETS = {
  'admin-envelopes': 'CEV1000',
  'barcode-labels': 'CLP1000',
  'catalogs': 'CPR4000',
  'desk-calendars': 'CCD2000',
  'food-labels': 'CLP1000',
  'gusset-envelopes': 'CEV1000',
  'holographic-stickers': 'CST5000',
  'invoice-forms': 'CNR2000',
  'leaflets': 'CPR3000',
  'menus': 'CLF2000',
  'mini-banners': 'CPR5000',
  'mini-calendars': 'CCD2000',
  'ncr-forms': 'CNR2000',
  'perfect-bound-booklet': 'CPR4000',
  'price-labels': 'CLP1000',
  'quotation-forms': 'CNR2000',
  'receipts': 'CNR2000',
  'roll-stickers': 'CST7000',
  'rollup-banners': 'CPR5000',
  'saddle-stitch-booklet': 'CPR4000',
  'standard-envelopes': 'CEV1000',
  'wall-calendars': 'CCD1000',
  'x-banners': 'CPR5000',
}

async function fetchLive(categoryCode) {
  const body = new URLSearchParams({
    t: String(Math.floor(Date.now() / 1000)),
    product: 'name',
    category_code: categoryCode,
  })
  const res = await fetch(`${SWADPIA_BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${SWADPIA_BASE}/goods/goods_view/${categoryCode}`,
      'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersOptionAudit/1.0)',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const d = await res.json()
  return {
    paper_code: new Set((d.paper_info ?? []).map((p) => String(p.paper_code ?? ''))),
    paper_size: new Set((d.size_info ?? []).map((s) => String(s.size_type_code ?? ''))),
  }
}

function loadDbOptions() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) return null
  const slugs = Object.keys(TARGETS).map((s) => `'${s}'`).join(',')
  const sql = `SELECT p.slug, o.option_type, o.value FROM print_products p
    JOIN print_product_options o ON o.product_id=p.id
    WHERE p.slug IN (${slugs}) ORDER BY p.slug, o.option_type;`
  const out = execFileSync('psql', [dbUrl, '-t', '-A', '-F|', '-c', sql], { encoding: 'utf8' })
  const db = {}
  for (const ln of out.split('\n')) {
    const t = ln.trim()
    if (!t) continue
    const [slug, ot, val] = t.split('|')
    ;((db[slug] ??= {})[ot] ??= new Set()).add(val)
  }
  return db
}

const liveCache = {}
const db = loadDbOptions()
const report = []

for (const [slug, code] of Object.entries(TARGETS)) {
  let live
  try {
    live = liveCache[code] ??= await fetchLive(code)
  } catch (e) {
    report.push({ slug, code, status: 'fetch_fail', error: String(e) })
    continue
  }
  const jsonEmpty = live.paper_code.size === 0 && live.paper_size.size === 0
  const row = { slug, code, status: jsonEmpty ? 'json_empty' : 'ok' }
  if (db) {
    for (const ot of ['paper_code', 'paper_size']) {
      const dbv = db[slug]?.[ot] ?? new Set()
      if (jsonEmpty) {
        row[ot] = 'json_empty'
      } else if (dbv.size === 0) {
        row[ot] = 'no_db_opts'
        if (row.status === 'ok') row.status = 'audit'
      } else {
        const bad = [...dbv].filter((v) => !live[ot].has(v))
        row[ot] = bad.length === 0 ? `match(${dbv.size})` : `mismatch:${bad.slice(0, 3).join(',')}`
        if (bad.length) row.status = 'fix'
      }
    }
  } else {
    row.live_paper_codes = [...live.paper_code].slice(0, 8)
    row.live_sizes = [...live.paper_size].slice(0, 8)
  }
  report.push(row)
}

console.log(JSON.stringify(report, null, 2))
const counts = report.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {})
console.error('SUMMARY:', JSON.stringify(counts))
