// OMO-3520: 고객 표시가가 수량에 따라 스케일하는지 — 생성 매트릭스 직접 검증 (READ-ONLY).
import { fetchSwadpiaCategoryData, calculateSwadpiaPriceKrw } from '../src/lib/swadpia.ts'
import { calculatePriceFromSwadpia } from '../src/lib/pricing.ts'

const data = await fetchSwadpiaCategoryData('business-cards')
console.log('fetchSuccess:', data.fetchSuccess, '| printEntries:', data.printEntries.length)
// 고유 수량 tier
const qtys = [...new Set(data.printEntries.map(e => e.quantity))].sort((a,b)=>a-b)
console.log('수량 tiers in matrix:', qtys)
// SNW300W00 의 (qty, print_unit2)
const paper = 'SNW300W00'
const rows = data.printEntries.filter(e => e.paper_code === paper && e.print_unit2 > 0).sort((a,b)=>a.quantity-b.quantity)
console.log(`\n${paper} (qty, print_unit2):`)
for (const r of rows) console.log(`  q${r.quantity} = ${r.print_unit2}`)

// 고객가 시뮬: lookupSwadpiaCost 재현(nearest-higher, 없으면 last) + calculatePriceFromSwadpia
function lookup(qty){
  const ents = rows
  const exact = ents.find(e=>e.quantity===qty); if(exact) return {cost:exact.print_unit2, eff:exact.quantity}
  const up = ents.find(e=>e.quantity>=qty); if(up) return {cost:up.print_unit2, eff:up.quantity}
  const last = ents[ents.length-1]; return last?{cost:last.print_unit2, eff:last.quantity}:null
}
const margin = 3.3, fx = 1/1525
console.log('\n고객 표시가(useSwadpia 경로) by qty:')
for (const q of [200,400,600,1000,2000]) {
  const r = lookup(q)
  if(!r){console.log(`  q${q}: no matrix`); continue}
  const usd = calculatePriceFromSwadpia({swadpiaCostKrw:r.cost, marginMultiplier:margin, exchangeRate:fx})
  console.log(`  q${q}: matrix costKrw=${r.cost} (eff q${r.eff}) → 고객가 $${usd.toFixed(2)}`)
}
