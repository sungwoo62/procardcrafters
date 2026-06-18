#!/usr/bin/env node
// OMO-3452: printcity 실제 명함 → 제품 페이지용 컴팩트 가격/옵션 데이터셋.
//
// 입력: scripts/test-artifacts/omo3452-printcity-real-namecard.full.json
//   = omo3452-printcity-real-namecard-crawl.mjs 가 site/seller/printcity.menuCategory[명함] 진실원천
//     기반으로 productbysite/{id} 직독한 printcity 실제 명함 16제품(storefront title + 조합별 가격).
// 출력: src/data/printcity-namecard-pricing.json (클라이언트 구성기 소비).
//
// 보드 2026-06-18 지적 반영: 기존 전역 census(타 테넌트 명함 혼입, 0/12 일치) 폐기 → 실제 스토어프론트만.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'scripts/test-artifacts/omo3452-printcity-real-namecard.full.json')
const OUT = join(ROOT, 'src/data/printcity-namecard-pricing.json')

const ENGLISH_AXIS = { coating: 'Coating', material: 'Paper', color: 'Print Sides', size: 'Size', foil: 'Foil' }

// 영어사이트 표시명(스토어프론트 한글명 → 깔끔한 영문 제품명).
const EN_NAME = {
  '고급 명함': 'Premium Business Cards',
  '일반 명함': 'Standard Business Cards',
  'PET 카드명함': 'PET Transparent Cards',
  'MC 카드명함': 'MC Thick Card',
  '점자 명함': 'Braille Business Cards',
  '엣지 명함': 'Edge-Foil Business Cards',
  '부분코팅 명함': 'Spot-UV Business Cards',
  '에폭시 명함': 'Epoxy Business Cards',
  '디지털 명함': 'Digital Business Cards',
  '디지털 화이트명함': 'Digital White Cards',
  '디지털 긴급명함': 'Digital Express Cards',
  '디지털 형광명함': 'Digital Neon Cards',
  '디지털 카드명함': 'Digital Thick Cards',
  '디지털 3D박명함': 'Digital 3D Foil Cards',
  '디지털 부분에폭명함': 'Digital Spot-Epoxy Cards',
  '디지털 홀로그램명함': 'Digital Hologram Cards',
}
const EN_SUB = {
  일반명함: 'Offset Cards', 카드명함: 'Card Stock', 스페셜명함: 'Specialty',
  디지털일반명함: 'Digital', 디지털카드명함: 'Digital Card', 디지털후가공명함: 'Digital Finished',
}

// 우리 카탈로그 slug 매핑(표시 참고용, 실제 storefront 제품 기준 큐레이션)
const OUR_SLUG = {
  '일반 명함': 'business-cards',
  '고급 명함': 'premium-business-cards',
  'PET 카드명함': 'transparent-business-cards',
  'MC 카드명함': 'premium-business-cards',
  '점자 명함': null,
  '엣지 명함': 'premium-foil-cards',
  '부분코팅 명함': 'uv-business-cards',
  '에폭시 명함': 'premium-foil-cards',
}

function axisOptions(items = []) {
  return items.map((t) => ({ code: t.code, ko: t.title }))
}

function main() {
  const census = JSON.parse(readFileSync(SRC, 'utf8'))
  const out = []
  for (const p of census.products) {
    // selecter(printcity 스토어프론트가 실제 노출하는 옵션)의 전체 code 집합.
    // productTypes 에는 selecter 에 없는 orphan 용지(예 고급명함 SNW/POS) 조합이 섞여 있고,
    // 그 orphan 조합이 가짜 코팅(무광/유광)을 만든다 → selecter 밖 code 를 가진 조합은 폐기.
    const validCodes = new Set()
    for (const [k, items] of Object.entries(p.axes)) {
      if (k === 'other') { for (const o of items) for (const t of o.options) validCodes.add(t.code) }
      else for (const t of items) validCodes.add(t.code)
    }
    const pt = (p.priceTable || [])
      .filter((r) => r.combo.every((c) => validCodes.has(c)))
      .filter((r) => (r.prices || []).some((x) => x.v > 0))
    if (pt.length === 0) continue

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
    for (const o of p.axes.other || []) {
      for (const t of o.options) {
        if (!usedCodes.has(t.code)) continue
        const pref = (t.code || '').split(':')[0]
        axes[pref] = axes[pref] || { label: o.name || pref, options: [] }
        if (!axes[pref].options.some((x) => x.code === t.code)) axes[pref].options.push({ code: t.code, ko: t.title })
      }
    }

    const table = pt.map((r) => ({ c: r.combo, p: r.prices.filter((x) => x.v > 0).map((x) => [x.q, x.v]) }))
    const qtys = [...new Set(table.flatMap((r) => r.p.map((x) => x[0])))].sort((a, b) => a - b)

    out.push({
      id: p.id,
      nameKO: p.storefrontTitle, // 스토어프론트 실제 명칭(내부 참조)
      label: EN_NAME[p.storefrontTitle] || p.nameEN || p.storefrontTitle, // 영문 표시명
      sub: p.sub,
      subEn: EN_SUB[p.sub] || p.sub,
      subCode: p.subCode,
      subType: p.subType,
      ourSlug: OUR_SLUG[p.storefrontTitle] ?? null,
      category3rd: p.subCode,
      hasFoil: !!p.hasFoil,
      axes,
      quantities: qtys,
      table,
    })
  }

  const SUB_ORDER = ['bc01', 'bc02', 'bc03', 'bc04', 'bc05', 'bc06']
  out.sort((a, b) => SUB_ORDER.indexOf(a.subCode) - SUB_ORDER.indexOf(b.subCode))

  const payload = {
    issue: 'OMO-3452',
    source: census.source,
    sellerId: census.sellerId,
    method: 'printcity 실제 스토어프론트(menuCategory[명함]) productbysite/{id} 직독. 추론/OCR 없음.',
    capturedAt: census.capturedAt,
    productCount: out.length,
    products: out,
  }
  writeFileSync(OUT, JSON.stringify(payload))
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1)
  console.log(`wrote ${OUT} — ${out.length} products, ${kb} KB`)
  for (const o of out) console.log(`  · [${o.subCode}] ${o.nameKO} (${o.sub}) axes:[${Object.keys(o.axes).join(',')}] combos:${o.table.length} qty:${o.quantities.length}`)
}

main()
