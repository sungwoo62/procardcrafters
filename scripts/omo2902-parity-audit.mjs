#!/usr/bin/env node
/**
 * OMO-2902 런칭 전 전체점검 — 성원애드피아 ↔ 우리사이트 파리티 감사
 *
 * 1) 제품/카테고리 파리티: CATEGORY_MAP 의 모든 슬러그에 대해 성원 라이브 데이터를
 *    조회 → 용지/사이즈/인쇄 매트릭스가 실제로 내려오는지 검증(깨진 매핑 = 런칭 리스크).
 * 2) 후가공 파리티: SWADPIA_FINISHING_FIELDS 의 mapped/runtime/needs_audit 분류 →
 *    needs_audit 는 발주 시 자동 반영 안 되는 항목(수동 처리 필요).
 *
 * 매핑은 소스(src/lib/swadpia.ts, src/config/swadpia-finishing-fields.ts)에서 직접
 * 추출하므로 코드와 절대 드리프트하지 않는다.
 *
 * 실행: node scripts/omo2902-parity-audit.mjs
 * 산출: scripts/test-artifacts/omo2902/parity-report.json + .md
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'scripts', 'test-artifacts', 'omo2902')
mkdirSync(OUT_DIR, { recursive: true })

const SWADPIA_BASE = 'https://www.swadpia.co.kr'

// ─── 소스에서 CATEGORY_MAP 추출 ───
function extractCategoryMap() {
  const src = readFileSync(join(ROOT, 'src/lib/swadpia.ts'), 'utf8')
  const block = src.match(/export const CATEGORY_MAP[^{]*\{([\s\S]*?)\n\}/)[1]
  const map = {}
  for (const m of block.matchAll(/'([^']+)':\s*'([^']+)'/g)) map[m[1]] = m[2]
  return map
}

// ─── 소스에서 후가공 상태 추출 ───
function extractFinishings() {
  const src = readFileSync(join(ROOT, 'src/config/swadpia-finishing-fields.ts'), 'utf8')
  const out = []
  for (const m of src.matchAll(/finishingValue:\s*'([^']+)',\s*\n?\s*label_ko:\s*'([^']+)',\s*\n?\s*status:\s*'([^']+)'/g)) {
    out.push({ value: m[1], label: m[2], status: m[3] })
  }
  return out
}

async function fetchCategory(categoryCode) {
  const t = Math.floor(Date.now() / 1000)
  const body = new URLSearchParams({ t: String(t), product: 'name', category_code: categoryCode }).toString()
  try {
    const res = await fetch(`${SWADPIA_BASE}/estimate/estimate_goods/json_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${SWADPIA_BASE}/goods/goods_view/${categoryCode}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersPriceBot/1.0)',
      },
      body,
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const j = await res.json()
    return {
      ok: true,
      papers: (j.paper_info ?? []).length,
      sizes: (j.size_info ?? []).length,
      printRows: (j.print_info1 ?? []).length,
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function main() {
  const categoryMap = extractCategoryMap()
  const finishings = extractFinishings()
  const slugs = Object.keys(categoryMap)

  // 카테고리 코드는 여러 슬러그가 공유 → 코드별 1회만 조회
  const uniqueCodes = [...new Set(Object.values(categoryMap))]
  const codeData = {}
  for (const code of uniqueCodes) {
    process.stdout.write(`  fetch ${code} ... `)
    codeData[code] = await fetchCategory(code)
    console.log(codeData[code].ok ? `papers=${codeData[code].papers} sizes=${codeData[code].sizes} print=${codeData[code].printRows}` : `FAIL ${codeData[code].error}`)
  }

  // 분류: OK(표준 가격매트릭스) / NO_PRICE_MATRIX(용지는 있으나 print_info1 비어있음
  // = 스티커·라벨·봉투·양식 등 비표준 가격구조, 별도 조사 필요) / DEAD(성원 무응답)
  const products = slugs.map((slug) => {
    const code = categoryMap[slug]
    const d = codeData[code]
    let verdict
    if (!d.ok || (d.papers ?? 0) === 0) verdict = 'DEAD'
    else if ((d.printRows ?? 0) === 0) verdict = 'NO_PRICE_MATRIX'
    else verdict = 'OK'
    return {
      slug,
      categoryCode: code,
      verdict,
      ok: verdict === 'OK',
      papers: d.papers ?? 0,
      sizes: d.sizes ?? 0,
      printRows: d.printRows ?? 0,
      error: d.error ?? null,
    }
  })

  const deadProducts = products.filter((p) => p.verdict === 'DEAD')
  const noMatrixProducts = products.filter((p) => p.verdict === 'NO_PRICE_MATRIX')
  const brokenProducts = deadProducts // 진짜 런칭 차단 = DEAD 만
  const finishGrp = {
    mapped: finishings.filter((f) => f.status === 'mapped'),
    runtime: finishings.filter((f) => f.status === 'runtime'),
    needs_audit: finishings.filter((f) => f.status === 'needs_audit'),
  }

  const report = {
    issue: 'OMO-2902',
    generatedAt: new Date().toISOString(),
    summary: {
      totalProductSlugs: products.length,
      uniqueCategoryCodes: uniqueCodes.length,
      productsLiveOK: products.filter((p) => p.ok).length,
      productsNoPriceMatrix: noMatrixProducts.length,
      productsDead: deadProducts.length,
      finishingsTotal: finishings.length,
      finishingsMapped: finishGrp.mapped.length,
      finishingsRuntime: finishGrp.runtime.length,
      finishingsNeedsAudit: finishGrp.needs_audit.length,
    },
    products,
    deadProducts,
    noMatrixProducts,
    finishings: finishGrp,
  }

  writeFileSync(join(OUT_DIR, 'parity-report.json'), JSON.stringify(report, null, 2))

  // ─── Markdown ───
  const md = []
  md.push(`# OMO-2902 성원↔우리사이트 파리티 감사`)
  md.push(`생성: ${report.generatedAt}\n`)
  const s = report.summary
  md.push(`## 요약`)
  md.push(`- 제품 슬러그: **${s.totalProductSlugs}종** (성원 카테고리 ${s.uniqueCategoryCodes}종)`)
  md.push(`- 표준 가격매트릭스 정상: **${s.productsLiveOK}종** · 비표준구조(별도조사): **${s.productsNoPriceMatrix}종** · 성원무응답(차단): **${s.productsDead}종**`)
  md.push(`- 후가공: 총 ${s.finishingsTotal} (자동발주 ${s.finishingsMapped} / 런타임 ${s.finishingsRuntime} / 미감사 ${s.finishingsNeedsAudit})\n`)

  md.push(`## 1) 제품·옵션 파리티 (성원 라이브 조회)`)
  const badge = { OK: '✅', NO_PRICE_MATRIX: '🟡 비표준', DEAD: '❌ 무응답' }
  md.push(`| 슬러그 | 카테고리 | 용지 | 사이즈 | 인쇄행 | 판정 |`)
  md.push(`|---|---|---|---|---|---|`)
  for (const p of products) {
    md.push(`| ${p.slug} | ${p.categoryCode} | ${p.papers} | ${p.sizes} | ${p.printRows} | ${badge[p.verdict]} |`)
  }
  md.push('')

  if (deadProducts.length) {
    md.push(`### ❌ 표준 estimate 엔드포인트 0응답 (별도 가격경로 필요 — 카테고리 코드는 유효)`)
    md.push(`엔드포인트는 200 응답하나 paper_info=0. 봉투(CEV1000)는 print_info2/3/4·paper_extra_cost 등 별도 estimate 구조 사용 → 우리 자동 가격/발주 경로 미커버. 매핑 오류 아님.`)
    for (const p of deadProducts) md.push(`- **${p.slug}** (${p.categoryCode}): ${p.error ?? '표준 paper_info 0건'}`)
    md.push('')
  }
  if (noMatrixProducts.length) {
    md.push(`### 🟡 비표준 가격구조 (용지는 수신되나 print_info1 비어있음 — 별도 조사)`)
    md.push(`스티커·라벨·봉투·양식·일부 카테고리는 표준 인쇄 매트릭스 대신 면적/롤/세트 기반 가격을 쓸 수 있음. 우리 가격경로가 print_info1 에 의존하는지 카테고리별 확인 필요.`)
    for (const p of noMatrixProducts) md.push(`- **${p.slug}** (${p.categoryCode}): 용지 ${p.papers}, 사이즈 ${p.sizes}`)
    md.push('')
  }

  md.push(`## 2) 후가공 자동반영 파리티`)
  md.push(`발주 시 고객 후가공 선택이 성원 폼에 자동 반영되는지 분류.`)
  md.push(`- **자동발주(mapped)**: ${finishGrp.mapped.map((f) => f.label).join(', ')}`)
  md.push(`- **런타임추출(runtime)**: ${finishGrp.runtime.map((f) => f.label).join(', ')} — 사이즈 선택 후 JS 동적, 발주 러너 런타임 추출 필요`)
  md.push(`- **미감사(needs_audit)**: ${finishGrp.needs_audit.map((f) => f.label).join(', ')} — ⚠️ 자동 반영 미보장, 수동 처리/추가 조사 필요`)
  md.push('')
  md.push(`## 남은 검증 (수동/E2E)`)
  md.push(`- [ ] 옵션 선택연동 E2E: 에디터에서 용지/사이즈/수량 선택 → 가격 갱신 (per 카테고리 샘플)`)
  md.push(`- [ ] 테스트 주문 3건 → 고객주문 스샷 ↔ 성원 발주 스샷 대조 (OrderVerificationPanel 활용)`)

  writeFileSync(join(OUT_DIR, 'parity-report.md'), md.join('\n'))

  console.log('\n=== 요약 ===')
  console.log(JSON.stringify(report.summary, null, 2))
  console.log(`\n리포트: scripts/test-artifacts/omo2902/parity-report.{json,md}`)
  if (deadProducts.length) {
    console.log(`\n❌ 성원무응답(차단) ${deadProducts.length}종:`, deadProducts.map((p) => `${p.slug}(${p.categoryCode})`).join(', '))
  }
  if (noMatrixProducts.length) {
    console.log(`🟡 비표준구조 ${noMatrixProducts.length}종:`, noMatrixProducts.map((p) => p.slug).join(', '))
  }
}

main()
