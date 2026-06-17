#!/usr/bin/env node
// OMO-3418: 명함 printcity↔현행(성원/DB) 가격 parity 스냅샷.
//
// 목적: 명함 섹션 공급사 컷오버(NEXT_PUBLIC_NAMECARD_SUPPLIER=printcity) **승인 자료**.
//   슬러그별 대표 수량(100/200/500/1000)에서 printcity 고객가 vs 현행(성원) 고객가의 이동폭(±%).
//
// 결정론 원칙(charter):
//   - 가격 화면 OCR/LLM 추론 금지. 양측 모두 가격 JSON 직독.
//     · printcity: src/data/printcity-namecard-base-matrix.json (price-api.dtp21.com 공개 GET 직독본).
//     · 성원: estimate/estimate_goods/json_data print_info1 (현행 라이브 가격경로와 동일 — 읽기전용 POST).
//   - 실주문/결제 없음. 가격 조회 GET/JSON 만.
//
// 산출 basis(라이브 코드 경로 정확 복제):
//   고객가 = baseKrw × margin × FX.  margin/FX 는 양측 공통이라 parity %는 baseKrw 비로 결정(상수 소거).
//   라이브 ProductConfigurator 는 항상 print_unit2(성원=양면) 를, 첫 유효 용지(print_unit2>0)로,
//   수량 상위브래킷 스냅으로 표시한다(lookupSwadpiaCost). printcity 어댑터(getPrintcityNamecardData)는
//   print_unit2=base=단면(canonical) 으로 채운다 → 컷오버 시 "기본 표시면"이 양면→단면으로 바뀌는
//   side-basis 차이가 존재. 본 스냅샷은 default(표시기본) 와 동일면(단/양면) parity 를 모두 계산한다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SWADPIA_BASE = 'https://www.swadpia.co.kr'
const REP_QTYS = [100, 200, 500, 1000]

// slug → 성원 category_code (src/lib/swadpia.ts CATEGORY_MAP 동기화, 명함 중 printcity base 보유분).
const CNC = {
  'business-cards': 'CNC1000',
  'premium-business-cards': 'CNC2000',
  'premium-foil-cards': 'CNC3000',
  'uv-business-cards': 'CNC6000',
  'transparent-business-cards': 'CNC5000',
}

const SLUG_LABEL = {
  'business-cards': '일반 명함',
  'premium-business-cards': '프리미엄 명함',
  'premium-foil-cards': '박/포일 카드',
  'uv-business-cards': 'UV 명함',
  'transparent-business-cards': '투명 명함',
}

// ── 성원 print_info1 직독 ───────────────────────────────────────────────────
async function fetchSwadpia(code) {
  const body = new URLSearchParams({ t: String(Math.floor(Date.now() / 1000)), product: 'name', category_code: code })
  const res = await fetch(`${SWADPIA_BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${SWADPIA_BASE}/goods/goods_view/${code}`,
      'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersPriceBot/1.0)',
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = await res.json()
  const entries = []
  for (const e of raw.print_info1 ?? []) {
    const q = parseInt(String(e.unit_key), 10)
    if (Number.isNaN(q)) continue
    const info = e['0']
    if (!info) continue
    entries.push({
      q,
      paper: String(info.paper_code ?? ''),
      single: Number(info.print_unit1) || 0, // 단면
      double: Number(info.print_unit2) || 0, // 양면
    })
  }
  return entries
}

// 라이브 swadpiaPaperCode 기본값 복제: printEntries 순서상 print_unit2>0 첫 용지.
function firstValidPaper(entries) {
  for (const e of entries) if (e.double > 0) return e.paper
  return null
}

// 수량 → 단가(상위브래킷 스냅, 초과 시 최대). side: 'single'|'double'.
function lookupKrw(entries, paper, qty, side) {
  const rows = entries.filter((e) => e.paper === paper && e[side] > 0).sort((a, b) => a.q - b.q)
  if (!rows.length) return null
  const exact = rows.find((r) => r.q === qty)
  if (exact) return exact[side]
  const upper = rows.find((r) => r.q >= qty)
  if (upper) return upper[side]
  return rows[rows.length - 1][side]
}

// ── printcity base-matrix 직독 (라이브 어댑터 동일 선택) ──────────────────────
const baseMatrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/printcity-namecard-base-matrix.json'), 'utf8'))

function pcRepProduct(slug) {
  // representativeBaseProduct: ourSlug 일치 + papers>0 첫 제품.
  return baseMatrix.products.find((p) => p.ourSlug === slug && (p.papers?.length ?? 0) > 0) ?? null
}
// printcity 어댑터: 각 용지 print_unit2 = base = single>0?single:double (canonical 단면 기준).
// 첫 유효 용지(base>0) = 기본 표시 용지.
function pcFirstPaper(prod) {
  for (const p of prod.papers) {
    const qtys = new Set([...Object.keys(p.single || {}), ...Object.keys(p.double || {})].map(Number))
    for (const q of qtys) {
      const s = p.single?.[String(q)] ?? 0
      const d = p.double?.[String(q)] ?? 0
      if ((s > 0 ? s : d) > 0) return p
    }
  }
  return null
}
function pcLookupKrw(paper, qty, side) {
  // side 'single' = canonical 단면 base, 'double' = 양면(single+add 또는 double 직접).
  const src = side === 'single' ? paper.single : paper.double
  const map = {}
  for (const [q, v] of Object.entries(src || {})) if (Number(v) > 0) map[q] = Number(v)
  // 양면이 비어있고 single 만 있으면 double 폴백 없음(해당 용지 단면전용).
  const qs = Object.keys(map).map(Number).sort((a, b) => a - b)
  if (!qs.length) return null
  if (map[qty] != null) return map[qty]
  const upper = qs.find((q) => q >= qty)
  if (upper != null) return map[upper]
  return map[qs[qs.length - 1]]
}

// ── parity 빌드 ──────────────────────────────────────────────────────────────
const pctShift = (cur, next) => (cur > 0 ? Math.round(((next - cur) / cur) * 1000) / 10 : null)

async function main() {
  const slugs = []
  for (const [slug, code] of Object.entries(CNC)) {
    const swEntries = await fetchSwadpia(code)
    const swPaper = firstValidPaper(swEntries)
    const prod = pcRepProduct(slug)
    const pcPaper = prod ? pcFirstPaper(prod) : null
    if (!swPaper || !prod || !pcPaper) {
      slugs.push({ slug, label: SLUG_LABEL[slug], swadpiaCode: code, skipped: true, reason: !swPaper ? 'no-swadpia-paper' : 'no-printcity-paper' })
      continue
    }
    const rows = REP_QTYS.map((q) => {
      // 현행(성원): 라이브 기본 표시 = print_unit2(양면). 동일면 비교용 단면도 산출.
      const swDouble = lookupKrw(swEntries, swPaper, q, 'double')
      const swSingle = lookupKrw(swEntries, swPaper, q, 'single')
      // printcity: 기본 표시 = print_unit2 = canonical 단면 base. 양면 = single+add(=double 매트릭스).
      const pcSingle = pcLookupKrw(pcPaper, q, 'single')
      const pcDouble = pcLookupKrw(pcPaper, q, 'double')
      return {
        qty: q,
        swadpiaSingleKrw: swSingle,
        swadpiaDoubleKrw: swDouble,
        printcitySingleKrw: pcSingle,
        printcityDoubleKrw: pcDouble,
        // default(표시기본) parity: printcity 단면(canonical) vs 성원 양면(현행 표시).
        defaultShiftPct: pctShift(swDouble, pcSingle),
        // 동일면 parity(공정 비교).
        singleShiftPct: pctShift(swSingle, pcSingle),
        doubleShiftPct: pctShift(swDouble, pcDouble),
      }
    })
    slugs.push({
      slug,
      label: SLUG_LABEL[slug],
      swadpiaCode: code,
      swadpiaPaper: swPaper,
      printcityProductId: prod.id,
      printcityProductName: prod.name,
      printcityPaper: pcPaper.code,
      printcityPaperTitle: pcPaper.title,
      rows,
    })
  }

  const out = {
    issue: 'OMO-3418',
    purpose: '명함 printcity↔현행(성원) 고객가 parity — 컷오버(NEXT_PUBLIC_NAMECARD_SUPPLIER) 승인 자료',
    capturedAt: new Date().toISOString(),
    method: '양측 가격 JSON 직독. 고객가 = baseKrw×margin×FX; margin/FX 공통이라 parity%는 baseKrw 비. 라이브 코드 경로(lookupSwadpiaCost/getPrintcityNamecardData) 정확 복제.',
    repQtys: REP_QTYS,
    sideBasisNote: '라이브 기본 표시 단가는 성원=print_unit2(양면), printcity=print_unit2(=canonical 단면 base). 컷오버 시 기본 표시면이 양면→단면으로 바뀜 → defaultShiftPct 는 이 side-basis 차이를 포함. singleShiftPct/doubleShiftPct 는 동일면 공정 비교.',
    foilNote: '박(엣지/에폭엠보)은 total_price 미포함 → census foilTable(수량브래킷) 분리 산정. 박 parity 는 printcity-namecard.ts buildFoilDiff(성원 분리형 surcharge 앵커) 참조.',
    slugs,
  }
  const dest = path.join(ROOT, 'src/data/omo3418-namecard-parity.json')
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')
  console.log('wrote', dest)
  for (const s of slugs) {
    if (s.skipped) { console.log(`SKIP ${s.slug}: ${s.reason}`); continue }
    console.log(`\n${s.slug} (${s.swadpiaCode} ${s.swadpiaPaper} ↔ pc ${s.printcityPaper})`)
    for (const r of s.rows) {
      console.log(`  q${r.qty}: 성원양면 ${r.swadpiaDoubleKrw} → pc단면 ${r.printcitySingleKrw} (default ${r.defaultShiftPct}%) | 단면 ${r.singleShiftPct}% | 양면 ${r.doubleShiftPct}%`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
