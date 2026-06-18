#!/usr/bin/env node
// OMO-3452: printcity 명함 → 실제 제품 페이지용 컴팩트 가격/옵션 데이터셋 생성.
//
// 입력: scripts/test-artifacts/omo3414/printcity-namecard-census.full.json
//        (= OMO-3414 가 price-api.dtp21.com/v2 공개 GET 으로 직독한 명함 17제품 풀 census.
//         각 제품 productTypes[] = 조합(combo)별 수량→가격 priceTable. OCR/LLM 미사용.)
// 출력: src/data/printcity-namecard-pricing.json
//        (= 판매가능 명함 제품만, 옵션축 code→title + combo별 수량가격. 클라이언트 구성기 직접 소비.)
//
// 판매가능 = priceTable 에 v>0 조합이 1개 이상 && 명함 카테고리(피켓 MP_OPK / 포토카드 MP_PCD 제외).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'scripts/test-artifacts/omo3414/printcity-namecard-census.full.json')
const OUT = join(ROOT, 'src/data/printcity-namecard-pricing.json')

const EXCLUDE_CAT = new Set(['MP_OPK', 'MP_PCD']) // 피켓·포토카드 = 명함 아님

// OMO-3414 PRODUCT_MAPPING (printcityId → 우리 slug). 표시용 영문 슬러그/라벨 큐레이션.
const MAPPING = {
  '61de7e13a36b0ec358946de3': { slug: 'business-cards', label: 'Standard Name Cards' },
  '63e4abde3374d8d1dc54458d': { slug: 'business-cards', label: 'Unified Name Cards' },
  '61d7e6ff4618a211d2069c9a': { slug: 'premium-business-cards', label: 'Imported-Paper Cards' },
  '6879cc61a67a79397627ad3c': { slug: 'premium-business-cards', label: 'Imported-Paper Cards (Value)' },
  '61db8d7fb2fd4166089fa04d': { slug: 'premium-business-cards', label: 'VIP Cards' },
  '63db173890953943cfdafc94': { slug: 'premium-foil-cards', label: 'Edge-Foil Cards' },
  '61ef5b679b270074d7f1e369': { slug: 'uv-business-cards', label: 'Spot-UV (Partial Coating) Cards' },
  '61e52abfabaed95eaaf08cb0': { slug: 'premium-foil-cards', label: 'Epoxy / Emboss Cards' },
  '61de95b8241774a67e60074f': { slug: 'premium-business-cards', label: 'Offset Card-Stock Cards' },
  '61de9be4241774a67e601af8': { slug: 'transparent-business-cards', label: 'PET Transparent Cards' },
  '61dfcbbe542d106e1224f76f': { slug: null, label: 'Braille Cards' },
  '6a05875bd6dd07b8536a14f8': { slug: 'premium-business-cards', label: 'Imported-Paper Cards (Event)' },
  '690d5723122978358a481644': { slug: 'business-cards', label: 'Standard Name Cards (Event)' },
}

const ENGLISH_AXIS = { coating: 'Coating', material: 'Paper', color: 'Print Sides', size: 'Size', foil: 'Foil' }

function axisOptions(items = []) {
  return items.map((t) => ({ code: t.code, ko: t.title }))
}

function main() {
  const census = JSON.parse(readFileSync(SRC, 'utf8'))
  const out = []
  for (const p of census.products) {
    const pt = (p.priceTable || []).filter((r) => (r.prices || []).some((x) => x.v > 0))
    if (pt.length === 0) continue
    if (EXCLUDE_CAT.has(p.category3rd)) continue

    // combo 에 실제로 등장하는 code 만 노출(가격표에 없는 phantom 옵션 제거 → 기본선택이 항상 유가).
    const usedCodes = new Set()
    const usedPrefixes = new Set()
    for (const r of pt) for (const c of r.combo) { usedCodes.add(c); usedPrefixes.add(c.split(':')[0]) }

    const axes = {}
    const AXMAP = [
      ['coating', 'COT', p.axes.coating],
      ['material', 'MAT', p.axes.material],
      ['color', 'COL', p.axes.color],
      ['size', 'SIZ', p.axes.size],
      ['foil', 'BKK', p.axes.foil],
    ]
    for (const [key, prefix, items] of AXMAP) {
      if (!usedPrefixes.has(prefix)) continue
      const opts = axisOptions(items).filter((o) => o.code.startsWith(prefix + ':') && usedCodes.has(o.code))
      if (opts.length) axes[key] = { label: ENGLISH_AXIS[key], options: opts }
    }
    // 기타 축(부분코팅 PCS / 에폭 EPS 등) — combo 에 실제 등장하는 code 만 노출
    for (const o of p.axes.other || []) {
      for (const t of o.options) {
        if (!usedCodes.has(t.code)) continue
        const pref = (t.code || '').split(':')[0]
        axes[pref] = axes[pref] || { label: o.selecterName || o.name || pref, options: [] }
        if (!axes[pref].options.some((x) => x.code === t.code)) axes[pref].options.push({ code: t.code, ko: t.title })
      }
    }

    // 컴팩트 priceTable: combo(코드배열) + prices(v>0 만)
    const table = pt.map((r) => ({
      c: r.combo,
      p: r.prices.filter((x) => x.v > 0).map((x) => [x.q, x.v]),
    }))
    const qtys = [...new Set(table.flatMap((r) => r.p.map((x) => x[0])))].sort((a, b) => a - b)

    const map = MAPPING[p.id] || { slug: null, label: p.nameEN || p.nameKO }
    out.push({
      id: p.id,
      nameKO: p.nameKO,
      label: map.label,
      ourSlug: map.slug,
      category3rd: p.category3rd,
      hasFoil: !!p.hasFoil,
      axes,
      quantities: qtys,
      table,
    })
  }

  const payload = {
    issue: 'OMO-3452',
    source: census.source,
    method: 'OMO-3414 풀 census(priceTable) 재가공 — 조합별 수량가격 직독. 추론/OCR 없음.',
    capturedAt: census.capturedAt,
    productCount: out.length,
    products: out,
  }
  writeFileSync(OUT, JSON.stringify(payload))
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1)
  console.log(`wrote ${OUT} — ${out.length} products, ${kb} KB`)
  for (const o of out) console.log(`  · ${o.nameKO} (${o.label}) axes:[${Object.keys(o.axes).join(',')}] combos:${o.table.length} qty:${o.quantities.length}`)
}

main()
