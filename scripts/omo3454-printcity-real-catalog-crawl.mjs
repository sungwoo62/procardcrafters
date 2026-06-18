#!/usr/bin/env node
// OMO-3454 (보드 2026-06-18): printcity 전체 카탈로그 리포트(/reports/printcity-catalog)를
//   실제 스토어프론트 진실원천으로 교정.
//
// 근본원인: 기존 src/data/printcity-catalog-census.json 은 product?all=true&page=N (site-scope 없는
//   공용 SaaS 전수)로 크롤 → printcity 가 실제 판매하지 않는 타 테넌트 제품 혼입(171제품/25카테고리).
// 수정: site/seller/printcity 의 menuCategory 가 printcity 실제 노출 카탈로그의 진실원천.
//   cateName(1차)·subCateName(2차)·subCateCode(3차)·cateItems(productId/title/EnName)로 그룹핑하고,
//   priceType 은 productbysite/{id} 직독으로 채운다.
//
// 공개 GET·읽기전용. OCR/LLM 미사용, 실주문 없음.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src/data/printcity-catalog-census.json')
const BASE = 'https://price-api.dtp21.com/v2'
const H = { Referer: 'https://printcity.co.kr/', Origin: 'https://printcity.co.kr' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${BASE}/${path}`, { headers: H })
      if (r.status === 200) return await r.json()
      if (r.status >= 500) { await sleep(600); continue }
      return { _httpError: r.status }
    } catch { await sleep(600) }
  }
  return { _httpError: 'retry-exhausted' }
}

async function main() {
  const site = await get('site/seller/printcity')
  const sdoc = site?.data || site
  const sellerId = sdoc?._id
  const menus = sdoc.menuCategory || []

  // 제품 평탄화 (cateName=cat1, subCateName=cat2, subCateCode=cat3)
  const flat = []
  for (const m of menus) {
    for (const it of m.cateItems || []) {
      flat.push({
        id: it.productId,
        nameKO: it.title,
        nameEN: it.productEnName ?? null,
        cat1: m.cateName,
        cat2: m.subCateName ?? null,
        cat3: m.subCateCode ?? null,
      })
    }
  }
  console.log(`printcity sellerId=${sellerId} · 실제 카탈로그 ${flat.length}제품`)

  // priceType 직독 (제품 doc)
  const priceTypeTotals = {}
  for (const p of flat) {
    const d = await get(`productbysite/${p.id}`)
    const doc = d && !d._httpError ? d.data || d : null
    p.priceType = doc?.typeOfPriceDetermintion ?? null
    if (p.priceType) priceTypeTotals[p.priceType] = (priceTypeTotals[p.priceType] || 0) + 1
    process.stdout.write('.')
    await sleep(120)
  }
  console.log('')

  // cat1 그룹핑
  const catMap = new Map()
  for (const p of flat) {
    if (!catMap.has(p.cat1)) catMap.set(p.cat1, { cat1: p.cat1, count: 0, priceTypes: {}, subMap: new Map(), products: [] })
    const g = catMap.get(p.cat1)
    g.count++
    if (p.priceType) g.priceTypes[p.priceType] = (g.priceTypes[p.priceType] || 0) + 1
    const subName = p.cat2 || '기타'
    g.subMap.set(subName, (g.subMap.get(subName) || 0) + 1)
    g.products.push({ id: p.id, nameKO: p.nameKO, nameEN: p.nameEN, cat2: p.cat2, cat3: p.cat3, priceType: p.priceType })
  }
  const categories = [...catMap.values()]
    .map((g) => ({
      cat1: g.cat1,
      count: g.count,
      priceTypes: g.priceTypes,
      sub: [...g.subMap.entries()].map(([name, count]) => ({ name, count })),
      products: g.products,
    }))
    .sort((a, b) => b.count - a.count)

  const payload = {
    issue: 'OMO-3454',
    source: 'printcity 실제 스토어프론트 — price-api.dtp21.com/v2/site/seller/printcity menuCategory (OMO-3414 전역 product?all=true 폐기)',
    crawledVia: 'site/seller/printcity menuCategory → cateItems(productId/title/EnName), priceType=productbysite/{id} 직독',
    sellerId,
    productCount: flat.length,
    reportedTotal: flat.length,
    categoryCount: categories.length,
    priceTypeTotals,
    categories,
    products: flat.map((p) => ({ id: p.id, nameKO: p.nameKO, nameEN: p.nameEN, cat2: p.cat2, cat3: p.cat3, priceType: p.priceType })),
  }
  writeFileSync(OUT, JSON.stringify(payload, null, 2))
  console.log(`\n✅ wrote ${OUT} — ${flat.length}제품 / ${categories.length}카테고리`)
  for (const c of categories) console.log(`  · ${c.cat1} ${c.count} [${Object.entries(c.priceTypes).map(([t, n]) => `${t}:${n}`).join(' ')}]`)
}
main()
