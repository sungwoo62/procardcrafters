#!/usr/bin/env node
// OMO-3414 (board 2026-06-17 reopen): printcity(dtp21) "전체 제품군" 전수 크롤링·리스트업.
// 공개 GET·읽기전용. price-api.dtp21.com/v2 직독. 가격/메타는 JSON 직독(OCR/LLM 금지).
//
// API 특이점(census 중 발견):
//   - product?categoryName1st=<카테고리>  → 해당 카테고리만 필터(응답엔 category[] 중첩).
//   - product?<아무param>=...             → 기본 전체 목록(20/page) 반환. limit 무시됨.
//   - product?all=true&page=N             → 전체 목록 페이지네이션(20/page). 이 경로로 전수.
//   - 목록 doc 은 경량(메타만): _id, category[], productNameKO/EN, typeOfPriceDetermintion.
//     selecters/productTypes(가격표)는 product/{id} 딥콜에서만(명함은 별도 census 보유).
//
// 산출: src/data/printcity-catalog-census.json (전체 카탈로그 리스트업 단일 소스).
import { writeFileSync } from 'node:fs'

const BASE = 'https://price-api.dtp21.com/v2'
const H = { Referer: 'https://printcity.co.kr/', Origin: 'https://printcity.co.kr' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${BASE}/${path}`, { headers: H })
      if (r.status === 200) return await r.json()
      if (r.status >= 500) { await sleep(500); continue }
      return { _httpError: r.status }
    } catch { await sleep(500) }
  }
  return { _httpError: 'retry-exhausted' }
}

async function main() {
  // 1) 전수 페이지네이션 (all=true 트리거 + page).
  const byId = new Map()
  let total = null
  for (let page = 1; page <= 50; page++) {
    const d = await get(`product?all=true&page=${page}`)
    const rows = d?.data || []
    if (total == null && d?.total != null) total = d.total
    if (rows.length === 0) break
    for (const p of rows) {
      const cat = (p.category && p.category[0]) || {}
      byId.set(p._id, {
        id: p._id,
        nameKO: p.productNameKO || null,
        nameEN: p.productNameEN || null,
        cat1: cat.categoryName1st || null,
        cat2: cat.categoryName2nd || null,
        cat3: cat.categoryName3rd || null,
        priceType: p.typeOfPriceDetermintion || null,
        modifiedAt: p.modifiedAt || null,
      })
    }
    process.stdout.write(`  page ${page}: +${rows.length} (누적 ${byId.size})\n`)
    await sleep(120)
  }
  const products = [...byId.values()]

  // 2) 카테고리 트리 집계.
  const tree = {} // cat1 -> { count, priceTypes:{}, cat2:{ name -> count } , products:[] }
  for (const p of products) {
    const c1 = p.cat1 || '(미분류)'
    const t = (tree[c1] ||= { cat1: c1, count: 0, priceTypes: {}, sub: {}, products: [] })
    t.count++
    t.priceTypes[p.priceType || '?'] = (t.priceTypes[p.priceType || '?'] || 0) + 1
    const sub = p.cat2 || '(none)'
    t.sub[sub] = (t.sub[sub] || 0) + 1
    t.products.push({ id: p.id, nameKO: p.nameKO, nameEN: p.nameEN, cat2: p.cat2, cat3: p.cat3, priceType: p.priceType })
  }
  const categories = Object.values(tree)
    .map((t) => ({ ...t, sub: Object.entries(t.sub).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.count - a.count)

  const priceTypeTotals = {}
  for (const p of products) priceTypeTotals[p.priceType || '?'] = (priceTypeTotals[p.priceType || '?'] || 0) + 1

  const out = {
    source: 'price-api.dtp21.com/v2 (printcity 공개 GET, 읽기전용)',
    crawledVia: 'product?all=true&page=N (20/page)',
    productCount: products.length,
    reportedTotal: total,
    categoryCount: categories.length,
    priceTypeTotals,
    categories,
    products,
  }
  writeFileSync(new URL('../src/data/printcity-catalog-census.json', import.meta.url), JSON.stringify(out, null, 2))
  console.log(`\n전수 완료: ${products.length}/${total} 제품, ${categories.length} 1차카테고리`)
  console.log('priceType 분포:', JSON.stringify(priceTypeTotals))
  console.log('카테고리:', categories.map((c) => `${c.cat1}(${c.count})`).join(', '))
}
main()
