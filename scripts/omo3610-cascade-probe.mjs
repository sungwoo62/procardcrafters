#!/usr/bin/env node
/**
 * OMO-3610 — 성원 goods_view 인쇄단가 cascade RE 하니스 (READ-ONLY)
 *
 * 배경: 전단/포스터/브로셔/캘린더/책자 10종은 generic JSON endpoint
 * (/estimate/estimate_goods/json_data) 가 "사이즈가격 그리드 garbage"
 * (unit_key=1 → print_unit=64000, 빈 paper_code)를 반환해 결정적 기준단가를
 * 못 뽑는다(OMO-3142). 그러나 goods_view(실주문폼)는 동일 json_data 를
 * 클라이언트 측 print_class_{CODE}.min.js 의 cascade 로 조합해 실가를 산출한다.
 *
 * 이 스크립트는 후가공 RE(OMO-3511) 와 동일하게 READ-ONLY 로:
 *   1) json_data(paper_info/size_info/print_info1..4) 표집
 *   2) goods_view HTML 에서 print_class/postpress_class/product_class JS 추출
 *   3) Dean Edwards packer 로 패킹된 JS 를 언팩해 cascade 공식 노출
 * 까지 수행한다. 실주문/결제/로그인 불필요(견적 데이터는 공개).
 *
 * 사용: node scripts/omo3610-cascade-probe.mjs CPR3000 [outDir]
 */
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

const code = process.argv[2] || 'CPR3000'
const outDir = process.argv[3] || `/tmp/omo3610-${code}`
fs.mkdirSync(outDir, { recursive: true })

async function fetchJsonData(categoryCode) {
  const body = new URLSearchParams({
    t: String(Math.floor(Date.now() / 1000)),
    product: 'name',
    category_code: categoryCode,
  })
  const res = await fetch(`${BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/goods/goods_view/${categoryCode}`,
      'User-Agent': UA,
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`json_data ${res.status}`)
  return res.json()
}

async function fetchGoodsViewScripts(categoryCode) {
  const res = await fetch(`${BASE}/goods/goods_view/${categoryCode}`, {
    headers: { 'User-Agent': UA },
  })
  const html = await res.text()
  const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1])
  // estimate engine 3종 + orchestrator
  return srcs.filter(
    (s) =>
      /(?:print_class|postpress_class|product_class)_/.test(s) ||
      /estimate\/views\/js\/common\.js/.test(s),
  )
}

/** Dean Edwards packer 언팩: eval 을 capture 로 치환해 원본 문자열 회수 */
function unpack(src) {
  if (!/^\s*eval\(function\(p,a,c,k,e,/.test(src)) return src // 이미 평문
  let captured = null
  const fn = new Function('eval', src.replace(/^\s*eval/, '(eval)'))
  fn((s) => {
    captured = s
    return s
  })
  return captured ?? src
}

async function fetchAndUnpack(relUrl) {
  const url = relUrl.startsWith('http') ? relUrl : `${BASE}${relUrl}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const raw = await res.text()
  return { name: path.basename(relUrl.split('?')[0]), raw, unpacked: unpack(raw) }
}

// ── 실행 ──────────────────────────────────────────────────────────
const json = await fetchJsonData(code)
fs.writeFileSync(path.join(outDir, 'json_data.json'), JSON.stringify(json, null, 2))

// garbage 진단: print_info1 unit_key=1 의 print_unit
const pi1 = json.print_info1 ?? []
const u1 = pi1.find((e) => String(e.unit_key) === '1')?.['0']
const summary = {
  category_code: code,
  paper_info_count: (json.paper_info ?? []).length,
  size_info_count: (json.size_info ?? []).length,
  print_info1_rows: pi1.length,
  print_info2_rows: (json.print_info2 ?? []).length,
  print_info4_present: Array.isArray(json.print_info4) && json.print_info4.length > 0,
  garbage_unit1_print_unit: u1 ? Number(u1.print_unit2) : null,
  note:
    'print_info1/2 는 unit_key(=연/수량 tier)별 인쇄단가 매트릭스. paper_code 비고 → ' +
    'paper 단가는 paper_info.price_unit1/2, size 는 size_info.cut_num/paper_size_rate 로 cascade.',
}

const scripts = await fetchGoodsViewScripts(code)
const scriptReport = []
for (const s of scripts) {
  try {
    const { name, raw, unpacked } = await fetchAndUnpack(s)
    fs.writeFileSync(path.join(outDir, name), unpacked)
    const methods = [...unpacked.matchAll(/([a-zA-Z_]+):function\(/g)].map((m) => m[1])
    scriptReport.push({ name, packed: raw.length, unpacked: unpacked.length, methods: methods.length })
  } catch (e) {
    scriptReport.push({ src: s, error: String(e) })
  }
  await new Promise((r) => setTimeout(r, 300)) // rate-limit 예의
}

fs.writeFileSync(
  path.join(outDir, 'SUMMARY.json'),
  JSON.stringify({ summary, scripts: scriptReport }, null, 2),
)
console.log(JSON.stringify({ outDir, summary, scripts: scriptReport }, null, 2))
