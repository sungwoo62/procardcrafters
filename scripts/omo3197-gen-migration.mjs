/**
 * OMO-3197: 크롤된 성원 쇼핑백 옵션 → 마이그레이션 SQL 생성기
 * 입력: scripts/omo3197-bag-options.json (omo3197-crawl-bags.mjs 산출물)
 * 출력: supabase/migrations/20260615000010_omo3197_shopping_bags_4types.PROPOSED.sql
 *
 * 4개 성원 카테고리 = 4개 제품(slug)에 실측 옵션을 시드한다.
 *   CPK4000 paper-shopping-bags / CPK2000 gift-bags /
 *   CPK3000 handleless-bags(신규) / CPK5000 small-batch-bags(신규)
 * 옵션 type 은 성원 폼 필드명(paper_code/paper_size/paper_qty)을 그대로 써서
 * 컨피규레이터 UI(OPTION_LABEL 매핑) + 향후 자동발주가 동일 값을 공유한다.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('./omo3197-bag-options.json', import.meta.url), 'utf8'))

// slug ↔ 성원 코드 + 메타
const PRODUCTS = {
  CPK4000: { slug: 'paper-shopping-bags', exists: true },
  CPK2000: { slug: 'gift-bags', exists: true },
  CPK3000: { slug: 'handleless-bags', exists: false, name_ko: '끈없는 쇼핑백', name_en: 'Handleless Bags', base: 110000, weight: 70 },
  CPK5000: { slug: 'small-batch-bags', exists: false, name_ko: '소량 쇼핑백', name_en: 'Small-Batch Bags', base: 64000, weight: 60 },
}

// 노출할 수량(성원 실값에서 큐레이션). CPK5000 은 50/100 만 존재.
const QTY_LADDER = {
  CPK5000: ['50', '100'],
  default: ['200', '500', '1000', '2000', '3000', '5000', '10000'],
}

// 인쇄 옵션 한↔영 (성원 page textContent 가 일부 모지바케라 코드 기준으로 깨끗한 라벨 고정)
const PRINT_EN = {
  CTN10: 'Color (1 side)', CTN11: 'Color + gold', CTN12: 'Color + silver',
  BDD21: 'Black 1-color (full)', CTN99: 'No printing',
}
const PRINT_KO = {
  CTN10: '단면칼라', CTN11: '단면칼라+금색', CTN12: '단면칼라+은색',
  BDD21: '전면 먹1도', CTN99: '인쇄없음',
}
// 모지바케(이중인코딩) 정리: (친환경) 접두 복원
function cleanKo(text) {
  return text.replace(/\(ì¹œí™˜ê²½\)/g, '(친환경)')
}
// 용지 영문 (best-effort; 한글 원문은 label_ko 보존)
function paperEn(text) {
  text = cleanKo(text)
  return text
    .replace('아트지', 'Art paper').replace('스노우지', 'Snow paper')
    .replace('랑데뷰', 'Rendezvous').replace('아르떼', 'Arte')
    .replace('크린쇼핑백', 'Clean bag stock').replace('비스포크쇼핑', 'Bespoke eco bag')
    .replace('(친환경)', '(eco) ').replace('백색', 'white').replace('내츄럴', 'natural')
    .replace('울트라화이트', 'ultra-white').replace('화이트', 'white').trim()
}
// 사이즈: "가로180×높이200×폭100" → "180 × 200 × 100 mm"
function sizeEn(text) {
  if (text.includes('직접입력')) return 'Custom size'
  const m = text.match(/가로(\d+)×높이(\d+)×폭(\d+)/)
  return m ? `${m[1]} × ${m[2]} × ${m[3]} mm (W×H×D)` : text
}

const esc = (s) => s.replace(/'/g, "''")
const lines = []
lines.push(`-- OMO-3197: 성원 쇼핑백 4종 연동 — 라이브 재크롤 옵션 시드`)
lines.push(`-- 생성: scripts/omo3197-gen-migration.mjs ← scripts/omo3197-bag-options.json (${data.fetchedAt})`)
lines.push(`-- 성원 상단 4버튼 = 4 category_code. DB 기존 옵션(100/200/500 등 임의값)을`)
lines.push(`-- 실측 성원 옵션(paper_code/paper_size/paper_qty)으로 교체한다.`)
lines.push(`--`)
lines.push(`-- ⚠️ 수량별 PRICING 은 미포함: 성원 쇼핑백 가격행렬은 index(unit_key) 기반이라`)
lines.push(`--    json_data 로 수량↔단가 매핑이 불가(calcuEstimate 인터랙티브 경로 필요).`)
lines.push(`--    → 신규 2종은 is_active=FALSE(드래프트), 가격 엔진은 후속 이슈에서 연동.`)
lines.push(`BEGIN;`)
lines.push(``)

for (const [code, meta] of Object.entries(PRODUCTS)) {
  const v = data.codes[code]
  lines.push(`-- ========== ${code} → ${meta.slug} (${v.label}) ==========`)
  if (!meta.exists) {
    lines.push(`INSERT INTO print_products (`)
    lines.push(`  slug, name_ko, name_en, category, base_price_krw, margin_multiplier,`)
    lines.push(`  sort_order, is_active, min_order_quantity, production_days_min, production_days_max, unit_weight_g`)
    lines.push(`) VALUES (`)
    lines.push(`  '${meta.slug}', '${meta.name_ko}', '${meta.name_en}', 'paper_bags', ${meta.base}, 4,`)
    lines.push(`  50, FALSE, 1, 2, 4, ${meta.weight}`)
    lines.push(`) ON CONFLICT (slug) DO NOTHING;`)
  }
  // 기존 임의 옵션 제거(설정값이라 안전) 후 실측 재시드
  lines.push(`DELETE FROM print_product_options WHERE product_id = (SELECT id FROM print_products WHERE slug='${meta.slug}')`)
  lines.push(`  AND option_type IN ('paper','size','quantity','paper_code','paper_size','paper_qty','print_color_type');`)

  const ins = (type, label_ko, label_en, value, isDefault, sort) =>
    lines.push(`INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)`+
      ` SELECT id, '${type}', '${esc(label_ko)}', '${esc(label_en)}', '${esc(value)}', 0, ${isDefault ? 'TRUE' : 'FALSE'}, ${sort} FROM print_products WHERE slug='${meta.slug}';`)

  // 용지
  v.paper_code.forEach((o, i) => ins('paper_code', cleanKo(o.text), paperEn(o.text), o.value, i === 0, i + 1))
  // 인쇄
  v.print_color_type.forEach((o, i) => ins('print_color_type', PRINT_KO[o.value] ?? cleanKo(o.text), PRINT_EN[o.value] ?? o.text, o.value, o.value === 'CTN10', i + 1))
  // 사이즈
  v.paper_size.forEach((o, i) => ins('paper_size', o.text, sizeEn(o.text), o.value, i === 0, i + 1))
  // 수량 (큐레이션된 성원 실값)
  const ladder = QTY_LADDER[code] ?? QTY_LADDER.default
  const present = new Set(v.paper_qty.map((o) => o.value))
  ladder.filter((q) => present.has(q)).forEach((q, i) => ins('paper_qty', `${q}매`, `${q} pcs`, q, i === 0, i + 1))
  lines.push(``)
}

lines.push(`COMMIT;`)
lines.push(``)

const dest = new URL('../supabase/migrations/20260615000010_omo3197_shopping_bags_4types.PROPOSED.sql', import.meta.url).pathname
writeFileSync(dest, lines.join('\n'))
console.log('생성:', dest, '\n행수:', lines.length)
