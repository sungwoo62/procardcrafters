// OMO-3557: 비명함 surcharge 수량스윕 raw(noncard-surcharge.json) → 공식 fit + parity 판정 + 카테고리 공식표.
//
// 재크롤 없음 — omo3557-noncard-surcharge-sweep.mjs 가 저장한 raw series 를 후처리한다.
//
// 결정론/parity 게이트(정정):
//   라이브 측정에서 payΔ/amt = 1.100(부가세 10%)로 일관 → hidden {type}_amt 는 결정론적 wholesale
//   surcharge 이며 화면가(공급가×1.1=결제가)에 정상 반영됨. 따라서 게이트는:
//     - COUPLED_OK   : amt>0 && payΔ/amt ∈ {≈1.00, ≈1.10}  → 적재 가능(parity 통과)
//     - UNCOUPLED    : amt>0 && payΔ=0  → amt 계산됐으나 pay 미반영(시퀀스/스테이징) → 적재 보류(재확인)
//     - NO_DATA      : amt=0  → 미계산(활성화 선행조건 미충족) → 적재 차단
//   (이전 게이트는 payΔ≈amt 만 통과시켜 VAT 포함 델타를 전부 오탐 → 본 스크립트가 정정.)
//
// CNC 기준선(OMO-3511 finishing-surcharge-matrix.ts, 명함 라이브)과 대비해 MATCH/DIVERGE 산출.
import fs from 'fs'
import path from 'path'

const OUT = 'scripts/test-artifacts/omo3488'
const raw = JSON.parse(fs.readFileSync(path.join(OUT, 'noncard-surcharge.json'), 'utf8'))

// CNC1000 기준선(매당 선형, OMO-3511). foil/ap 는 면적모델 → 별도.
const CNC_BASELINE = {
  die_cut: { base: 11533, rate: 18.87 },
  drilled_hole: { base: 2593, rate: 3.43 },
  round_corner: { base: 1246, rate: 4.6 },
  epoxy: { base: 0, rate: 45 },
  score_crease: { base: 4256, rate: 6.82 },
  perforation: { base: 4256, rate: 6.82 },
  numbering: null, // 명함 차단 → 미측정
}
// bundle_qty(책자 CPR4000)는 수량 의미가 "묶음 수"라 매수(per-sheet) 기준선과 직접 비교 불가.
const BUNDLE_QTY_CATEGORIES = new Set(['CPR4000'])

const VAT_OK = (ratio) => Math.abs(ratio - 1.0) <= 0.02 || Math.abs(ratio - 1.1) <= 0.02

function fitLinear(points) {
  const n = points.length
  if (n < 2) return null
  const xs = points.map((p) => p.qty), ys = points.map((p) => p.amt)
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0)
  const sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * ys[i], 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  const rate = (n * sxy - sx * sy) / denom
  const base = (sy - rate * sx) / n
  const meanY = sy / n
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0)
  const ssRes = ys.reduce((a, y, i) => a + (y - (base + rate * xs[i])) ** 2, 0)
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot
  return { base: Math.round(base), rate: Number(rate.toFixed(4)), r2: Number(r2.toFixed(4)), n }
}

const result = { ranAt: raw.ranAt, processedAt: new Date().toISOString(), vatRatio: 1.1, categories: [] }
const rows = [] // 공식표 행

for (const c of raw.categories) {
  const isBundle = BUNDLE_QTY_CATEGORIES.has(c.code)
  const catOut = { code: c.code, qtyField: c.qtyField, qtyUnit: isBundle ? 'bundle(묶음)' : '매(sheet)', finishings: {} }
  for (const [fv, d] of Object.entries(c.finishings)) {
    const pts = d.series.filter((s) => !s.error)
    // 결정론 분류
    const classify = (s) => {
      if (!(s.amt > 0)) return 'NO_DATA'
      if (s.payDelta > 0) return VAT_OK(s.payDelta / s.amt) ? 'COUPLED_OK' : 'COUPLED_DRIFT'
      return 'UNCOUPLED'
    }
    const tagged = pts.map((s) => ({ qty: s.qty, amt: s.amt, payDelta: s.payDelta, ratio: s.amt > 0 && s.payDelta > 0 ? Number((s.payDelta / s.amt).toFixed(3)) : null, cls: classify(s) }))
    const usable = tagged.filter((s) => s.cls === 'COUPLED_OK')
    const computed = tagged.filter((s) => s.amt > 0) // 계산은 됨(coupled or uncoupled)
    const fit = fitLinear((usable.length >= 2 ? usable : computed).map((s) => ({ qty: s.qty, amt: s.amt })))
    // 게이트 판정
    let gate
    if (usable.length >= 2) gate = 'LOADABLE'
    else if (usable.length === 1) gate = 'LOADABLE_1PT' // 단일점(VAT 정상) — base 만, slope 미확정
    else if (computed.length > 0) gate = 'HOLD_UNCOUPLED' // amt 계산되나 pay 미반영 → 재확인
    else gate = 'BLOCK_NODATA'
    // CNC 기준선 대비
    const baseline = isBundle ? null : CNC_BASELINE[fv]
    let parity = null
    if (baseline && fit) {
      const at2000 = fit.base + fit.rate * 2000
      const cncAt2000 = baseline.base + baseline.rate * 2000
      parity = { cncAt2000: Math.round(cncAt2000), catAt2000: Math.round(at2000), coef: Number((at2000 / cncAt2000).toFixed(3)), verdict: Math.abs(at2000 / cncAt2000 - 1) <= 0.05 ? 'MATCH' : 'DIVERGE' }
    } else if (baseline === null && CNC_BASELINE[fv] === null && fit) {
      parity = { note: 'CNC 미측정(명함 차단) — 비명함 최초 측정값', verdict: 'NEW_DATA' }
    }
    catOut.finishings[fv] = { gate, points: tagged, fit, parity, amtField: d.amtField }
    rows.push({ cat: c.code, unit: catOut.qtyUnit, fv, gate, fit, parity, points: tagged.map((t) => `${t.qty}:${t.amt}`).join(' ') })
  }
  result.categories.push(catOut)
}

fs.writeFileSync(path.join(OUT, 'noncard-surcharge-formulas.json'), JSON.stringify(result, null, 2))

// 마크다운 공식표
let md = `# OMO-3557 비명함 surcharge 카테고리 공식표 (라이브 수량스윕 fit)\n\n`
md += `측정 raw: \`noncard-surcharge.json\` (${raw.ranAt}) · 후처리 \`noncard-surcharge-formulas.json\`\n`
md += `방법: production activateFinishings 1:1 재현 + base-config 자동선택 → hidden \`{type}_amt\` 직독(OCR/추론 금지). READ-ONLY, 실주문 없음.\n\n`
md += `## parity/결정론 게이트\n`
md += `라이브 \`payΔ/amt = 1.100\`(부가세 10%) 일관 확인 → hidden amt 는 결정론적 wholesale surcharge.\n`
md += `- LOADABLE: COUPLED_OK(payΔ=amt×1.1) ≥2점 → 적재가능 · LOADABLE_1PT: 1점만(slope 미확정)\n`
md += `- HOLD_UNCOUPLED: amt 계산되나 payΔ=0(가격 미반영, 시퀀스 재확인 필요) · BLOCK_NODATA: amt=0\n\n`
md += `## 공식표 (amt ≈ base + rate·수량, 수량단위=카테고리별)\n\n`
md += `| 카테고리 | 단위 | 후가공 | 게이트 | 측정점(수량:amt) | fit base | rate | R²(n) | CNC대비 |\n`
md += `|---|---|---|---|---|---:|---:|---:|---|\n`
for (const r of rows) {
  const fitS = r.fit ? `${r.fit.base}` : '-'
  const rateS = r.fit ? `${r.fit.rate}` : '-'
  const r2S = r.fit ? `${r.fit.r2}(${r.fit.n})` : '-'
  const parS = r.parity ? (r.parity.verdict === 'DIVERGE' ? `DIVERGE coef ${r.parity.coef}` : r.parity.verdict + (r.parity.coef ? ` ${r.parity.coef}` : '')) : (r.unit.startsWith('bundle') ? 'bundle(비교불가)' : '-')
  md += `| ${r.cat} | ${r.unit} | ${r.fv} | ${r.gate} | ${r.points} | ${fitS} | ${rateS} | ${r2S} | ${parS} |\n`
}
md += `\n## 비명함 측정 한계(정직 명시)\n`
md += `- **박/형압(foil/ap, 면적모델)**: 비명함은 add-to-list UI(\`addBak()\`+\`chgBakSection/Side/Type/Size\`+\`bak_exist_dongpan\` AJAX populate, \`bakSizeReadonly\`). 동기 이벤트로 동판옵션 미populate → 본 스윕서 미측정(amt=0). 별도 add-to-list RE 필요(자식이슈).\n`
md += `- **CLF1000**: qty 래더 최소 2,000·간격 2,000 → cap 5,000 에서 2점만(slope 신뢰 낮음). 3점 확보엔 8,000 포함 재측정 권장.\n`
md += `- **CPR4000(책자)**: 수량=bundle(묶음) 단위라 매수기준 CNC 공식과 직접 비교 불가(단위 환산 필요).\n`
md += `- **CPR5000/die_cut·score_crease 등 UNCOUPLED**: amt 계산되나 payΔ=0 — 가격 반영 시퀀스 재확인 후 적재.\n`
fs.writeFileSync(path.join(OUT, 'NONCARD-SURCHARGE.md'), md)

// 콘솔 요약
console.log(md)
console.log('\nSAVED noncard-surcharge-formulas.json + NONCARD-SURCHARGE.md')
