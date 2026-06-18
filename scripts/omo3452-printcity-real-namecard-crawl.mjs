#!/usr/bin/env node
// OMO-3452 (보드 2026-06-18 지적 반영): printcity 실제 스토어프론트 명함 제품만 크롤.
//
// 근본원인: 기존 census 가 site-scope 없는 product?categoryName1st=명함(공용 SaaS 전역)으로 크롤 →
//   printcity 가 실제 판매하지 않는 타 테넌트/마스터 명함을 적재(일반지/통합/수입지/특가/VIP 등 0/12 일치).
// 수정: price-api.dtp21.com/v2/site/seller/printcity 의 menuCategory[cateName=명함].cateItems 가
//   printcity 실제 명함 16제품(storefront title + productId)의 진실원천. 그 id 만 product/{id} 딥콜.
//
// 공개 GET·읽기전용. OCR/LLM 미사용, 실주문 없음.
import { writeFileSync } from 'node:fs'

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

function buildPriceTable(productTypes = []) {
  return productTypes.map((pt) => ({
    combo: (pt.selectors || []).map((x) => x.code),
    prices: (pt.price || []).map((p) => ({ q: p.quantity, v: p.value })).filter((p) => p.q > 0),
  })).filter((r) => r.prices.length > 0)
}

async function main() {
  const site = await get('site/seller/printcity')
  const sdoc = site?.data || site
  const sellerId = sdoc?._id
  const namecard = []
  for (const m of sdoc.menuCategory || []) {
    if (m.cateName !== '명함') continue
    for (const it of m.cateItems || []) {
      namecard.push({ productId: it.productId, title: it.title, sub: m.subCateName, subCode: m.subCateCode, subType: m.subCateType })
    }
  }
  console.log(`printcity sellerId=${sellerId} · 실제 명함 제품 ${namecard.length}건`)

  const products = []
  for (const nc of namecard) {
    process.stdout.write(`  ${nc.subCode} ${nc.title} (${nc.productId}) ... `)
    const d = await get(`productbysite/${nc.productId}`)
    if (!d || d._httpError) { console.log('FAIL', d?._httpError); await sleep(150); continue }
    const doc = d.data || d
    const { axes, foilKind } = classifyAxes(doc.selecters)
    const priceTable = buildPriceTable(doc.productTypes)
    const qtys = [...new Set(priceTable.flatMap((r) => r.prices.map((p) => p.q)))].sort((a, b) => a - b)
    const realCombos = priceTable.filter((r) => r.prices.some((x) => x.v > 0)).length
    products.push({
      id: doc._id,
      storefrontTitle: nc.title,
      nameKO: doc.productNameKO,
      nameEN: doc.productNameEN,
      sub: nc.sub, subCode: nc.subCode, subType: nc.subType,
      categoryCode: doc.categoryCode,
      priceType: doc.typeOfPriceDetermintion,
      saleStatus: doc.saleStatus,
      hasFoil: axes.foil.length > 0, foilKind, foilColors: axes.foil,
      counts: { material: axes.material.length, size: axes.size.length, color: axes.color.length, coating: axes.coating.length, combos: priceTable.length },
      axes, quantities: qtys, priceTable,
    })
    console.log(`combos=${priceTable.length} priced=${realCombos} foil=${axes.foil.length} qty=${qtys.length}`)
    await sleep(150)
  }

  const out = {
    issue: 'OMO-3452',
    source: 'printcity 실제 스토어프론트 — price-api.dtp21.com/v2/site/seller/printcity menuCategory[명함].cateItems → product/{id}',
    sellerId,
    method: 'site-scoped 진실원천(menuCategory) 기반 product/{id} 직독. OCR/LLM 미사용, 읽기전용.',
    capturedAt: '__STAMP__',
    productCount: products.length,
    products,
  }
  const path = new URL('./test-artifacts/omo3452-printcity-real-namecard.full.json', import.meta.url)
  writeFileSync(path, JSON.stringify(out, null, 2))
  console.log(`\n✅ ${products.length}건 → scripts/test-artifacts/omo3452-printcity-real-namecard.full.json`)
}
main()
