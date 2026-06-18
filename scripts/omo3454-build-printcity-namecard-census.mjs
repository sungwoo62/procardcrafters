#!/usr/bin/env node
// OMO-3454 (보드 2026-06-18): printcity 리포트뷰가 쓰는 명함 census 를 실제 스토어프론트로 교정.
//
// 근본원인: 기존 src/data/printcity-namecard-census.json 은 OMO-3414 의 전역 SaaS census
//   (product?categoryName1st=명함 — site-scope 없음)라 타 테넌트 명함이 혼입(0/12 일치).
// 수정: OMO-3452 가 site/seller/printcity menuCategory[명함] 진실원천으로 직독한
//   scripts/test-artifacts/omo3452-printcity-real-namecard.full.json (실제 16제품)을
//   리포트 lib(src/lib/printcity-namecard.ts)가 소비하는 census 스키마로 변환.
//
// 파생 규칙(가격 추론 아님 — priceTable 직독 집계):
//  · baseByQty[q] = 박 없는 base 조합들의 수량 q 최저가(=대표 entry base 단가).
//  · foilTable.byColor[BKK:*][q] = 해당 박색 포함 조합의 수량 q 최저가(완성가).
// OCR/LLM 미사용, 읽기전용, 실주문 없음.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'scripts/test-artifacts/omo3452-printcity-real-namecard.full.json')
const OUT = join(ROOT, 'src/data/printcity-namecard-census.json')

const hasFoilCombo = (combo) => combo.some((c) => c.startsWith('BKK:'))

// base(박 없는) 조합들의 수량별 최저가
function baseByQty(priceTable) {
  const out = {}
  for (const r of priceTable) {
    if (hasFoilCombo(r.combo)) continue
    for (const p of r.prices) {
      if (!(p.v > 0)) continue
      const k = String(p.q)
      if (out[k] == null || p.v < out[k]) out[k] = p.v
    }
  }
  return out
}

// 박색별 수량 최저 완성가 + 대표 용지/도수
function foilTable(product) {
  if (!product.hasFoil) return null
  const byColor = {}
  let repPaper
  let repPrint = ''
  for (const r of product.priceTable) {
    const foil = r.combo.find((c) => c.startsWith('BKK:'))
    if (!foil) continue
    const mat = r.combo.find((c) => c.startsWith('MAT:'))
    const col = r.combo.find((c) => c.startsWith('COL:'))
    if (repPaper == null && mat) repPaper = mat
    if (!repPrint && col) repPrint = col
    byColor[foil] = byColor[foil] || {}
    for (const p of r.prices) {
      if (!(p.v > 0)) continue
      const k = String(p.q)
      if (byColor[foil][k] == null || p.v < byColor[foil][k]) byColor[foil][k] = p.v
    }
  }
  return { repPaper, repPrint, byColor }
}

function main() {
  const full = JSON.parse(readFileSync(SRC, 'utf8'))
  const products = full.products.map((p) => ({
    id: p.id,
    nameKO: p.storefrontTitle, // 스토어프론트 실제 명칭(진실원천)
    nameEN: p.nameEN,
    category2nd: p.subType,
    category3rd: p.subCode,
    categoryCode: p.categoryCode,
    priceType: p.priceType,
    saleStatus: p.saleStatus,
    hasFoil: !!p.hasFoil,
    foilKind: p.foilKind ?? null,
    foilColors: p.foilColors || [],
    counts: p.counts,
    axes: p.axes,
    quantities: p.quantities,
    baseByQty: baseByQty(p.priceTable || []),
    foilTable: foilTable(p),
  }))

  const payload = {
    issue: 'OMO-3454',
    source:
      'printcity 실제 스토어프론트 — price-api.dtp21.com/v2/site/seller/printcity menuCategory[명함].cateItems → productbysite/{id} (OMO-3452 진실원천)',
    method:
      'site-scoped 진실원천(menuCategory) 기반 productbysite/{id} 직독. baseByQty/foilTable 는 priceTable 최저가 집계. OCR/LLM 미사용, 읽기전용, 실주문 없음.',
    note: 'OMO-3414 전역 census(타 테넌트 혼입, 0/12 일치) 폐기 → 실제 스토어프론트 16제품으로 교정(OMO-3454).',
    capturedAt: full.capturedAt,
    category: '명함 (site/seller/printcity menuCategory[명함])',
    sellerId: full.sellerId,
    productCount: products.length,
    products,
  }
  writeFileSync(OUT, JSON.stringify(payload, null, 2))
  console.log(`wrote ${OUT} — ${products.length} products`)
  for (const p of products) {
    const b200 = p.baseByQty['200']
    console.log(
      `  · [${p.category3rd}] ${p.nameKO} foil=${p.hasFoil ? p.foilColors.length : '—'} base200=${b200 ?? '—'} qty=${p.quantities.length}`,
    )
  }
}

main()
