#!/usr/bin/env node
// OMO-3414: printcity(dtp21) 명함 카테고리 전수 census.
// 공개 GET·읽기전용. price-api.dtp21.com/v2 직독. 가격은 JSON 직독(OCR/LLM 금지).
// 산출: src/data/printcity-namecard-census.json (웹 비교뷰 단일 소스).
//
// 파이프라인:
//   product?categoryName1st=명함  → 명함 마스터 제품 목록(ObjectId)
//   product/{id}                  → 풀 doc: selecters(옵션축) + productTypes[].price[{quantity,value}]
//                                   = 조합별 실제 고객가(=우리가 printcity에서 주문 시 원가). 직독.
// 비고: 신형 마스터 제품은 박/엣지박을 selecter(bakKindCode/edgeBakKindCode)로 안고
//       productTypes 가격에 번들 → 박은 별도 surcharge가 아니라 완성형 룩업(priceComplete).
import { writeFileSync } from 'node:fs'

const BASE = 'https://price-api.dtp21.com/v2'
const H = { Referer: 'https://printcity.co.kr/', Origin: 'https://printcity.co.kr' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${BASE}/${path}`, { headers: H })
      if (r.status === 200) return await r.json()
      if (r.status >= 500) { await sleep(500); continue }
      return { _httpError: r.status }
    } catch { await sleep(500) }
  }
  return { _httpError: 'retry-exhausted' }
}

// selecter 축을 분류한다(용지/사이즈/도수/코팅/박).
function classifyAxes(selecters = []) {
  const axes = { coating: [], material: [], color: [], size: [], foil: [], other: [] }
  let foilKind = null
  for (const s of selecters) {
    const opts = (s.types || []).map((t) => ({ code: t.code, title: t.title }))
    const kc = s.kindCode || ''
    if (kc === 'coatingCode') axes.coating = opts
    else if (kc === 'materialCode') axes.material = opts
    else if (kc === 'colorCode') axes.color = opts
    else if (kc === 'sizeCode') axes.size = opts
    else if (/bak/i.test(kc)) { axes.foil = opts; foilKind = kc }
    else axes.other.push({ name: s.selecterName, kindCode: kc, options: opts })
  }
  return { axes, foilKind }
}

// productTypes → 조합별 가격표. combo = selector code 집합, prices = [{q,v}].
function buildPriceTable(productTypes = []) {
  return productTypes.map((pt) => ({
    combo: (pt.selectors || []).map((x) => x.code),
    prices: (pt.price || []).map((p) => ({ q: p.quantity, v: p.value })).filter((p) => p.q > 0),
  })).filter((r) => r.prices.length > 0)
}

// 표준 base 가격: 박축 없는(또는 첫 박색) + 단면4도(COL:40) 조합에서 용지·수량별 최저가.
// 반환: { byQty: { [q]: minValue }, papersUsed }
function deriveBaseByQty(priceTable, foilKind) {
  const byQty = {}
  for (const row of priceTable) {
    // 단면4도 우선(없으면 전체) — base 비교 일관성
    const isSingle = row.combo.includes('COL:40')
    for (const { q, v } of row.prices) {
      if (!isSingle && priceTable.some((r2) => r2.combo.includes('COL:40'))) continue
      if (byQty[q] == null || v < byQty[q]) byQty[q] = v
    }
  }
  return byQty
}

async function main() {
  const list = await get(`product?categoryName1st=${encodeURIComponent('명함')}`)
  const seeds = (list.data || []).map((p) => ({ id: p._id, nameKO: p.productNameKO }))
  console.log(`명함 마스터 제품 ${seeds.length}건 census 시작`)
  const products = []
  for (const seed of seeds) {
    process.stdout.write(`  ${seed.id} ${seed.nameKO} ... `)
    const d = await get(`product/${seed.id}`)
    if (!d || d._httpError) { console.log('FAIL', d?._httpError); await sleep(150); continue }
    const { axes, foilKind } = classifyAxes(d.selecters)
    const priceTable = buildPriceTable(d.productTypes)
    const baseByQty = deriveBaseByQty(priceTable, foilKind)
    const qtys = [...new Set(priceTable.flatMap((r) => r.prices.map((p) => p.q)))].sort((a, b) => a - b)
    products.push({
      id: d._id, nameKO: d.productNameKO, nameEN: d.productNameEN,
      category2nd: d.category?.[0]?.categoryName2nd, category3rd: d.category?.[0]?.categoryName3rd,
      categoryCode: d.categoryCode, priceType: d.typeOfPriceDetermintion, saleStatus: d.saleStatus,
      hasFoil: axes.foil.length > 0, foilKind, foilColors: axes.foil,
      counts: { material: axes.material.length, size: axes.size.length, color: axes.color.length, coating: axes.coating.length, combos: priceTable.length },
      axes, quantities: qtys, baseByQty, priceTable,
    })
    console.log(`combos=${priceTable.length} qty=${qtys.length} foil=${axes.foil.length}`)
    await sleep(150)
  }
  // 박 제품: 색상×수량 가격곡선 도출(대표 용지·단면4도 고정). 박 priceComplete 번들 분석용.
  function deriveFoilTable(p) {
    if (!p.hasFoil) return null
    const repPaper = p.axes.material[0]?.code
    const byColor = {}
    for (const row of p.priceTable) {
      const foil = row.combo.find((c) => p.foilColors.some((f) => f.code === c))
      if (!foil) continue
      if (repPaper && !row.combo.includes(repPaper)) continue
      if (!row.combo.includes('COL:40')) continue // 단면4도 기준
      byColor[foil] = Object.fromEntries(row.prices.map((x) => [x.q, x.v]))
    }
    return { repPaper, repPrint: 'COL:40', byColor }
  }

  const meta = {
    issue: 'OMO-3414',
    source: 'printcity (dtp21/iamdesign/printdeal 공용 SaaS) — price-api.dtp21.com/v2 공개 GET',
    method: 'API JSON 직독 (product 마스터 doc: selecters + productTypes[].price). OCR/LLM 미사용, 읽기전용, 실주문 없음.',
    note: 'printcity 명함=priceComplete(완성형 룩업): 박/엣지박이 selecter 축으로 productTypes 가격에 번들. 가격=우리가 printcity 공급 시 원가(retail).',
    capturedAt: new Date().toISOString(),
    category: '명함 (categoryName1st=명함)',
    productCount: products.length,
  }
  // 1) full 아티팩트(가격표 통째) → test-artifacts (번들 미포함)
  const fullPath = new URL('./test-artifacts/omo3414/printcity-namecard-census.full.json', import.meta.url)
  writeFileSync(fullPath, JSON.stringify({ ...meta, products }, null, 2))
  // 2) compact(페이지 번들용) → src/data. 거대 priceTable 제거, baseByQty + foilTable 보존.
  const compact = products.map((p) => {
    const { priceTable, ...rest } = p
    return { ...rest, foilTable: deriveFoilTable(p) }
  })
  const compactPath = new URL('../src/data/printcity-namecard-census.json', import.meta.url)
  writeFileSync(compactPath, JSON.stringify({ ...meta, products: compact }, null, 2))
  const foilProducts = products.filter((p) => p.hasFoil)
  console.log(`\n✅ census ${products.length}건`)
  console.log(`   full  → scripts/test-artifacts/omo3414/printcity-namecard-census.full.json`)
  console.log(`   compact(번들) → src/data/printcity-namecard-census.json`)
  console.log(`   박/엣지박 보유: ${foilProducts.length}건 — ${foilProducts.map((p) => `${p.nameKO}(${p.foilColors.length}색)`).join(', ')}`)
}
main()
