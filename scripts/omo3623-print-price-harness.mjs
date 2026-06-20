#!/usr/bin/env node
/**
 * OMO-3623 — 성원 인쇄단가 headless 추출 하니스 (READ-ONLY)
 *
 * OMO-3610 RE 실행: 전단/포스터/브로셔/책자/캘린더 10종은 generic JSON endpoint
 * 가 garbage(unit_key=1 print_unit=64000) 라 결정적 기준단가를 못 뽑는다.
 * 그러나 goods_view(실주문폼)는 성원 자기 cascade 코드(print_class/postpress_class/
 * product_class)를 브라우저에서 실행해 실가를 hidden #total_price 로 산출한다.
 *
 * 본 하니스는 TS 재구현 없이 **성원 코드를 그대로 실행**한다(보드 절대규칙):
 *   1) headless chromium 으로 goods_view/{category_code} 로드 → 엔진이 json_data
 *      AJAX + cascade 를 자체 실행, 기본 조합의 #total_price 산출.
 *   2) 대표 조합(size × paper × qty × print_method × 양/단면)을 옵션 select 에
 *      세팅 후 성원 inline onchange(chg*) 를 호출 → 재계산.
 *   3) parity 게이트: #total_price === #supply_amt === 화면표시 공급가(.price)
 *      가 아니면 적재후보에서 차단(크롤≠화면).
 *
 * READ-ONLY: 실주문/결제/로그인 불필요(견적 데이터 공개). 박(箔)은 total 미포함
 * → 별색 surcharge 분리(기존 finishing-surcharge 규칙 유지, 본 하니스 범위 외).
 *
 * 산출물(서버 전용, 클라 비노출):
 *   scripts/data/omo3623-print-price-samples.json  — 표집 total_price + parity
 *
 * 사용: node scripts/omo3623-print-price-harness.mjs [--out <path>]
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'https://www.swadpia.co.kr'
const OUT =
  process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : path.join(__dirname, 'data', 'omo3623-print-price-samples.json')

/**
 * 표집 매트릭스. category_code 당 goods_view 페이지 1개를 공유하는 slug 들을
 * 명시하고, 기본조합(page defaults)+대표 변형(qty tier / 부수 / 용지)을 둔다.
 * overrides: [{ sel: '<select id>', value: '<option value>' }] — 순서대로 적용,
 * 각 적용 후 성원 inline onchange 를 호출해 cascade 재계산.
 */
const PAGES = [
  {
    category_code: 'CPR3000',
    slugs: ['leaflets'],
    estimate_class: 'CLF2000',
    samples: [
      { label: 'base: ART150 A4 양면4/4 1000매 PTM10', overrides: [] },
      { label: 'qty tier: 2000매', overrides: [{ sel: 'paper_qty', value: '2000' }] },
      { label: '부수 2 (order_count)', overrides: [{ sel: 'order_count', value: '2' }] },
    ],
  },
  {
    category_code: 'CPR2000',
    slugs: ['posters'],
    samples: [
      { label: 'base: ART150 A2 단면 250매 PTM10', overrides: [] },
      { label: 'qty tier: 500매', overrides: [{ sel: 'paper_qty', value: '500' }] },
    ],
  },
  {
    category_code: 'CLF2000',
    slugs: ['brochures', 'menus'],
    samples: [
      { label: 'base: ART150 A4 양면4/4 1000매 PTM10', overrides: [] },
      { label: 'qty tier: 2000매', overrides: [{ sel: 'paper_qty', value: '2000' }] },
    ],
  },
  {
    category_code: 'CPR4000',
    slugs: ['saddle-stitch-booklet', 'perfect-bound-booklet', 'catalogs'],
    samples: [
      { label: 'base: 200부 표지ARE190 내지ARE105 32p PTM20', overrides: [] },
      { label: '부수 tier: 500부', overrides: [{ sel: 'bundle_qty', value: '500' }] },
    ],
  },
  {
    category_code: 'CCD1000',
    slugs: ['wall-calendars'],
    samples: [
      { label: 'base: ART180 벽걸이 100부 PTC20', overrides: [] },
      { label: '부수 2', overrides: [{ sel: 'order_count', value: '2' }] },
    ],
  },
  {
    category_code: 'CCD2000',
    slugs: ['desk-calendars', 'mini-calendars'],
    samples: [
      { label: 'base: ART180 탁상 디지털 DPF12', overrides: [] },
      { label: '부수 5', overrides: [{ sel: 'order_count', value: '5' }] },
    ],
  },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 페이지 안에서 옵션 적용 + 성원 onchange 호출 + cascade 재계산 후 가격 표집 */
async function evalSample(pg, overrides) {
  return pg.evaluate(async (overrides) => {
    const fmt = (n) => Number(n).toLocaleString('en-US')
    const applied = []
    for (const ov of overrides) {
      const el = document.getElementById(ov.sel)
      if (!el) {
        applied.push({ ...ov, ok: false, reason: 'no-select' })
        continue
      }
      const has = [...el.options].some((o) => o.value === ov.value)
      if (!has) {
        applied.push({ ...ov, ok: false, reason: 'no-option' })
        continue
      }
      el.value = ov.value
      // 성원 자기 wiring 실행 (inline onchange="chgXxx();")
      if (typeof el.onchange === 'function') el.onchange()
      else el.dispatchEvent(new Event('change', { bubbles: true }))
      applied.push({ ...ov, ok: true })
      await new Promise((r) => setTimeout(r, 650))
    }
    await new Promise((r) => setTimeout(r, 350))
    const total = document.getElementById('total_price')?.value ?? null
    const supply = document.getElementById('supply_amt')?.value ?? null
    // 화면 표시 공급가 후보 (.price 텍스트들에서 콤마숫자 추출)
    const shown = [...document.querySelectorAll('.price, [id*=price], [id*=total]')]
      .map((e) => (e.textContent || '').replace(/[^0-9]/g, ''))
      .filter((t) => t.length >= 3)
    // 현재 선택 스냅샷 (대표 조합 증거)
    const snap = {}
    ;['paper_type', 'paper_code', 'paper_size', 'paper_qty', 'paper_qty_select',
      'order_count', 'bundle_qty', 'print_method', 'fside_color_amount',
      'bside_color_amount', 'in_page_qty', 'cover_paper_code'].forEach((id) => {
      const e = document.getElementById(id)
      if (e && e.value) snap[id] = e.value
    })
    const totalN = total != null ? Number(total) : NaN
    const supplyN = supply != null ? Number(supply) : NaN
    const orderCount = Number(document.getElementById('order_count')?.value || '1') || 1
    // 공급가(적재 대상 라인 합계) = supply_amt. 화면 표시 공급가와 대조(크롤≠화면).
    // total_price 는 CPR/CLF 에선 라인합계와 동일하지만 CCD(디지털/토너)에선
    // 부수당 단가 → supply_amt = total_price × order_count. 둘 다 기록한다.
    const shownMatch =
      shown.includes(String(supplyN)) || shown.includes(fmt(supplyN))
    return {
      applied,
      order_count: orderCount,
      supply_amt: Number.isFinite(supplyN) ? supplyN : null, // 공급가(라인합계) = 적재 대상
      unit_price: Number.isFinite(totalN) ? totalN : null, // hidden total_price (CCD=부수단가)
      price_model:
        Number.isFinite(totalN) && Number.isFinite(supplyN)
          ? totalN === supplyN
            ? 'line-total' // total_price == supply_amt (CPR/CLF)
            : Math.abs(supplyN - totalN * orderCount) <= 1
              ? 'unit×count' // supply_amt = total_price × order_count (CCD 디지털/토너)
              : 'other'
          : null,
      parity: {
        supply_in_shown: shownMatch, // 크롤 supply_amt == 화면 표시 공급가
        positive: Number.isFinite(supplyN) && supplyN > 0,
        unit_count_consistent:
          Number.isFinite(totalN) &&
          Number.isFinite(supplyN) &&
          (totalN === supplyN || Math.abs(supplyN - totalN * orderCount) <= 1),
      },
      selection: snap,
    }
  }, overrides)
}

async function run() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  })
  const results = []
  for (const page of PAGES) {
    for (let i = 0; i < page.samples.length; i++) {
      const s = page.samples[i]
      const pg = await ctx.newPage()
      const rec = {
        category_code: page.category_code,
        estimate_class: page.estimate_class ?? null,
        slugs: page.slugs,
        sample_index: i,
        label: s.label,
      }
      try {
        await pg.goto(`${BASE}/goods/goods_view/${page.category_code}`, {
          waitUntil: 'networkidle',
          timeout: 50000,
        })
        await sleep(2500) // json_data AJAX + cascade 초기화 대기
        const r = await evalSample(pg, s.overrides)
        // parity 게이트: 공급가(supply_amt) 가 양수이고 화면 표시 공급가와 일치하며
        // unit×count 관계가 일관해야 적재 후보. 아니면 차단(크롤≠화면).
        const gatePass =
          r.parity.positive && r.parity.supply_in_shown && r.parity.unit_count_consistent
        Object.assign(rec, r, {
          gate: gatePass ? 'pass' : 'block',
          gate_reason: gatePass
            ? null
            : !r.parity.positive
              ? 'non-positive supply_amt'
              : !r.parity.supply_in_shown
                ? 'supply_amt not in shown 공급가 (크롤≠화면)'
                : 'unit×count 불일치 (transient/미정착)',
        })
      } catch (e) {
        Object.assign(rec, { gate: 'block', gate_reason: `error: ${String(e).slice(0, 120)}` })
      }
      results.push(rec)
      // 증분 저장 (긴 라이브 하니스 세션 kill 내성)
      writeOut(results)
      console.log(
        `${page.category_code}[${i}] ${rec.label} → 공급가=${rec.supply_amt ?? '-'} (unit=${rec.unit_price ?? '-'}, ${rec.price_model ?? '-'}) gate=${rec.gate}${rec.gate_reason ? ' (' + rec.gate_reason + ')' : ''}`,
      )
      await pg.close()
      await sleep(400) // rate-limit 예의
    }
  }
  await browser.close()
  writeOut(results)
  // 커버리지 요약
  const pass = results.filter((r) => r.gate === 'pass')
  const byCat = {}
  for (const r of results) {
    byCat[r.category_code] ??= { total: 0, pass: 0, slugs: r.slugs }
    byCat[r.category_code].total++
    if (r.gate === 'pass') byCat[r.category_code].pass++
  }
  console.log('\n=== COVERAGE ===')
  console.log(`samples: ${results.length}, pass: ${pass.length}, block: ${results.length - pass.length}`)
  for (const [c, v] of Object.entries(byCat)) {
    console.log(`  ${c} (${v.slugs.join(',')}): ${v.pass}/${v.total} pass`)
  }
}

function writeOut(results) {
  const slugSet = new Set(PAGES.flatMap((p) => p.slugs))
  const payload = {
    issue: 'OMO-3623',
    source: 'swadpia goods_view headless cascade (성원 자기 코드 실행)',
    method: 'playwright chromium → #total_price (hidden) parity-gated vs #supply_amt + 화면표시 공급가',
    read_only: true,
    note_bak: '박(箔)은 total_price 미포함 → 별색 surcharge 분리(finishing-surcharge), 본 하니스 범위 외',
    server_only: true,
    slugs_covered: [...slugSet],
    samples: results,
  }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
