// OMO-2903 ① 옵션 선택연동 E2E
//   에디터 용지/사이즈/수량 선택 → /api/swadpia-price 가 의존하는 동일 경로
//   (fetchSwadpiaCategoryData + calculateSwadpiaPriceKrw)를 성원 라이브로 직접 호출해
//   카테고리 대표 6종에서 ① 용지별 ② 수량별 가격이 실시간 갱신(=달라짐)되는지 검증.
//   가격 API route.ts 와 동일 로직 → 헤드리스 브라우저 없이도 가격 연동 무결성 확인.
//
// 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2903-option-linkage-e2e.ts
import { fetchSwadpiaCategoryData, calculateSwadpiaPriceKrw, lookupPrintCost } from '../src/lib/swadpia.ts'

// 파리티 보고서(omo2902) 카테고리 대표 샘플
const SAMPLES = [
  { slug: 'business-cards', cat: 'CNC1000', label: '명함' },
  { slug: 'brochures', cat: 'CLF2000', label: '브로슈어' },
  { slug: 'saddle-stitch-booklet', cat: 'CPR4000', label: '책자' },
  { slug: 'posters', cat: 'CPR2000', label: '포스터' },
  { slug: 'banners', cat: 'CPR5000', label: '배너' },
  { slug: 'wall-calendars', cat: 'CCD1000', label: '캘린더' },
]

const QTYS = [100, 500, 1000]

type CaseResult = {
  slug: string
  cat: string
  label: string
  fetchSuccess: boolean
  paperCount: number
  sizeCount: number
  printEntryCount: number
  papersTested: string[]
  // qty×paper 가격 매트릭스
  priceMatrix: Record<string, Record<number, number>>
  // print matrix(수량별) 가격으로 산출됐는지 vs 용지단가 폴백인지
  priceSource: 'print_matrix' | 'paper_fallback' | 'mixed' | 'none'
  // 검증 판정
  qtyVaries: boolean       // 같은 용지에서 수량 바꾸면 가격이 달라지는가
  paperVaries: boolean     // 같은 수량에서 용지 바꾸면 가격이 달라지는가
  verdict: '✅' | '🟡' | '❌'
  note: string
}

async function run() {
  const results: CaseResult[] = []

  for (const s of SAMPLES) {
    const data = await fetchSwadpiaCategoryData(s.slug)
    const r: CaseResult = {
      slug: s.slug, cat: s.cat, label: s.label,
      fetchSuccess: data.fetchSuccess,
      paperCount: data.papers.length,
      sizeCount: data.sizes.length,
      printEntryCount: data.printEntries.length,
      papersTested: [],
      priceMatrix: {},
      priceSource: 'none',
      qtyVaries: false, paperVaries: false,
      verdict: '❌', note: '',
    }

    if (!data.fetchSuccess) {
      r.note = `fetch 실패: ${data.errorMessage ?? '?'}`
      results.push(r)
      console.log(`[${s.label}/${s.cat}] ❌ ${r.note}`)
      continue
    }

    // 에디터가 실제 선택하는 용지 목록(data.papers, 유효 단가 보유) 상위 3종으로 검증.
    // ⚠️ 명함류(CNC*)는 printEntries 가 paper_code 를 보유 → 수량 티어 매칭.
    //    그 외(CLF/CPR/CCD)는 printEntries.paper_code 가 비어 lookupPrintCost=null → 용지단가 폴백.
    const validPapers = data.papers.filter(p => (p.price_unit2 ?? 0) > 0 || (p.price_unit1 ?? 0) > 0)
    const papers = (validPapers.length > 0 ? validPapers : data.papers).slice(0, 3).map(p => p.paper_code)
    r.papersTested = papers

    let printMatrixHits = 0, fallbackHits = 0
    for (const paper of papers) {
      r.priceMatrix[paper] = {}
      for (const qty of QTYS) {
        const viaMatrix = lookupPrintCost(data, paper, qty, true)
        if (viaMatrix !== null) printMatrixHits++; else fallbackHits++
        r.priceMatrix[paper][qty] = calculateSwadpiaPriceKrw(data, paper, qty, true)
      }
    }
    r.priceSource = printMatrixHits > 0 && fallbackHits > 0 ? 'mixed'
      : printMatrixHits > 0 ? 'print_matrix'
      : fallbackHits > 0 ? 'paper_fallback' : 'none'

    // qtyVaries: 어느 한 용지에서라도 수량별 가격이 2개 이상 distinct
    r.qtyVaries = papers.some(p => {
      const vals = QTYS.map(q => r.priceMatrix[p][q]).filter(v => v > 0)
      return new Set(vals).size >= 2
    })
    // paperVaries: 어느 한 수량에서라도 용지별 가격이 2개 이상 distinct
    r.paperVaries = QTYS.some(q => {
      const vals = papers.map(p => r.priceMatrix[p][q]).filter(v => v > 0)
      return new Set(vals).size >= 2
    })

    const anyPriced = papers.some(p => QTYS.some(q => r.priceMatrix[p][q] > 0))
    if (r.qtyVaries && (r.paperVaries || papers.length === 1)) { r.verdict = '✅'; r.note = `용지·수량 가격 실시간 갱신 정상 (${r.priceSource})` }
    else if (anyPriced && r.paperVaries && !r.qtyVaries) { r.verdict = '🟡'; r.note = `용지별 갱신O·수량별 갱신X — ${r.priceSource}: 수량 티어 미반영(런칭 확인필요)` }
    else if (anyPriced) { r.verdict = '🟡'; r.note = `가격 산출되나 갱신 약함 (qtyVaries=${r.qtyVaries}, paperVaries=${r.paperVaries}, ${r.priceSource})` }
    else { r.verdict = '❌'; r.note = '가격 0 — print matrix 미커버(비표준 구조)' }

    results.push(r)
    console.log(`[${s.label}/${s.cat}] ${r.verdict} src=${r.priceSource} papers=${r.paperCount} sizes=${r.sizeCount} entries=${r.printEntryCount} qtyVaries=${r.qtyVaries} paperVaries=${r.paperVaries}`)
    for (const p of papers) {
      console.log(`    ${p}: ` + QTYS.map(q => `${q}매=₩${r.priceMatrix[p][q]}`).join('  '))
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    source: 'swadpia live (fetchSwadpiaCategoryData) — /api/swadpia-price 동일 경로',
    pass: results.filter(r => r.verdict === '✅').length,
    warn: results.filter(r => r.verdict === '🟡').length,
    fail: results.filter(r => r.verdict === '❌').length,
    results,
  }
  console.log('\n' + JSON.stringify(summary, null, 2))
  return summary
}

run().catch(e => { console.error('FATAL', e); process.exit(1) })
