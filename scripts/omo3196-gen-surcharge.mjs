/**
 * OMO-3196: amt-CNC1000.json(byQty) → 명함 후가공 수량별 surcharge 매트릭스 JSON 생성.
 * 컨피규레이터 수량 범위(≤12000)만 유지 + 마지막 상위 1개. 0 은 Included 로 유지.
 * 실행: node scripts/omo3196-gen-surcharge.mjs
 */
import * as fs from 'fs'

const SRC = 'scripts/test-artifacts/omo3196/amt-CNC1000.json'
const OUT = 'src/config/finishing-surcharge-cnc1000.json'
const MAX_QTY = 12000

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const byQty = data.byQty || {}

const tiers = Object.keys(byQty)
  .map((q) => ({ qty: parseInt(q, 10), amts: byQty[q] }))
  .filter((t) => Number.isFinite(t.qty))
  .sort((a, b) => a.qty - b.qty)

// ≤MAX_QTY + 바로 위 1개(상위 보간용)
const kept = []
for (const t of tiers) {
  kept.push(t)
  if (t.qty > MAX_QTY) break
}

const matrix = kept.map((t) => {
  const krw = {}
  for (const [k, v] of Object.entries(t.amts)) {
    const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(n)) krw[k] = n
  }
  return { qty: t.qty, krw }
})

fs.writeFileSync(OUT, JSON.stringify(matrix, null, 2))
console.log(`wrote ${OUT}: ${matrix.length} tiers, qtys ${matrix.map((m) => m.qty).join(',')}`)
console.log('sample @qty', matrix[0]?.qty, matrix[0]?.krw)
console.log('sample @last', matrix[matrix.length - 1]?.qty, matrix[matrix.length - 1]?.krw)
