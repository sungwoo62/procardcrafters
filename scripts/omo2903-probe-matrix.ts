// OMO-2903 진단: 비-명함 카테고리의 printEntries/paper 구조 확인
import { fetchSwadpiaCategoryData } from '../src/lib/swadpia.ts'

const slugs = ['business-cards', 'brochures', 'saddle-stitch-booklet', 'posters', 'banners', 'wall-calendars']
for (const slug of slugs) {
  const d = await fetchSwadpiaCategoryData(slug)
  const papersSample = d.papers.slice(0, 3).map(p => ({ code: p.paper_code, u1: p.price_unit1, u2: p.price_unit2, rate: p.price_sale_rate }))
  const entriesSample = d.printEntries.slice(0, 4)
  const distinctPaperCodes = Array.from(new Set(d.printEntries.map(e => e.paper_code))).slice(0, 6)
  const distinctQtys = Array.from(new Set(d.printEntries.map(e => e.quantity))).slice(0, 12)
  console.log(`\n=== ${slug} (${d.categoryCode}) ok=${d.fetchSuccess} papers=${d.papers.length} entries=${d.printEntries.length} ===`)
  console.log('  papers[0..2]:', JSON.stringify(papersSample))
  console.log('  entries[0..3]:', JSON.stringify(entriesSample))
  console.log('  distinct entry paper_codes:', JSON.stringify(distinctPaperCodes))
  console.log('  distinct entry quantities:', JSON.stringify(distinctQtys))
}
