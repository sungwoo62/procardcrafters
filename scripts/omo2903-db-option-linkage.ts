// OMO-2903 ①(정정) 생산 옵션-가격 연동 검증 — 실제 경로(DB)
//   ⚠️ 발견: /api/swadpia-price(calculateSwadpiaPriceKrw)는 UI 미사용(라우트만 존재).
//   실제 고객가 = (base_price_krw + Σ print_product_options.extra_price_krw) × margin × 환율
//                 (src/lib/pricing.ts calculateItemPriceUsd, src/app/order/page.tsx).
//   따라서 옵션 선택→가격 갱신은 print_product_options.extra_price_krw 로 결정된다.
//   본 스크립트는 카테고리 대표 6종의 옵션 행을 조회해 ① 옵션 타입(용지/사이즈/수량)
//   존재 ② extra_price_krw 분포(가격을 실제로 움직이는 옵션이 있는가)를 검증.
//
// 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2903-db-option-linkage.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !key) { console.error('NO SUPABASE CREDS'); process.exit(2) }
const sb = createClient(url, key)

const SAMPLES = [
  { slug: 'business-cards', label: '명함' },
  { slug: 'brochures', label: '브로슈어' },
  { slug: 'saddle-stitch-booklet', label: '책자' },
  { slug: 'posters', label: '포스터' },
  { slug: 'banners', label: '배너' },
  { slug: 'wall-calendars', label: '캘린더' },
]

type Out = {
  slug: string; label: string; found: boolean
  basePriceKrw: number | null; margin: number | null
  optionTypes: Record<string, { count: number; pricedCount: number; extraRange: [number, number] }>
  pricedOptionTotal: number
  verdict: '✅' | '🟡' | '❌'; note: string
}

const results: Out[] = []
for (const s of SAMPLES) {
  const { data: prod } = await sb
    .from('print_products')
    .select('id, slug, base_price_krw, margin_multiplier, is_active')
    .eq('slug', s.slug)
    .maybeSingle()

  if (!prod) {
    results.push({ slug: s.slug, label: s.label, found: false, basePriceKrw: null, margin: null, optionTypes: {}, pricedOptionTotal: 0, verdict: '❌', note: 'print_products 행 없음' })
    console.log(`[${s.label}] ❌ 상품 없음`)
    continue
  }

  const { data: opts } = await sb
    .from('print_product_options')
    .select('option_type, value, label_en, extra_price_krw, sort_order')
    .eq('product_id', prod.id)
    .order('option_type', { ascending: true })

  const byType: Record<string, { count: number; pricedCount: number; extraRange: [number, number] }> = {}
  let pricedTotal = 0
  for (const o of opts ?? []) {
    const t = o.option_type
    const ex = Number(o.extra_price_krw ?? 0)
    if (!byType[t]) byType[t] = { count: 0, pricedCount: 0, extraRange: [Infinity, -Infinity] }
    byType[t].count++
    if (ex !== 0) { byType[t].pricedCount++; pricedTotal++ }
    byType[t].extraRange[0] = Math.min(byType[t].extraRange[0], ex)
    byType[t].extraRange[1] = Math.max(byType[t].extraRange[1], ex)
  }
  for (const t of Object.keys(byType)) {
    if (!isFinite(byType[t].extraRange[0])) byType[t].extraRange = [0, 0]
  }

  const types = Object.keys(byType)
  const hasPaper = types.some(t => /paper|용지|material|stock/i.test(t))
  const hasSize = types.some(t => /size|사이즈|dimension/i.test(t))
  const hasQty = types.some(t => /quantity|qty|수량|count/i.test(t))
  let verdict: Out['verdict'] = '✅'
  let note = ''
  if (types.length === 0) { verdict = '❌'; note = '옵션 행 0 — 옵션 선택 UI/가격연동 없음' }
  else if (pricedTotal === 0) { verdict = '🟡'; note = `옵션 ${types.length}종 있으나 extra_price_krw 전부 0 — 옵션 바꿔도 가격 불변(연동 약함)` }
  else { verdict = '✅'; note = `가격이동 옵션 ${pricedTotal}개 — paper=${hasPaper} size=${hasSize} qty=${hasQty}` }

  results.push({ slug: s.slug, label: s.label, found: true, basePriceKrw: prod.base_price_krw, margin: prod.margin_multiplier, optionTypes: byType, pricedOptionTotal: pricedTotal, verdict, note })
  console.log(`[${s.label}/${s.slug}] ${verdict} base=₩${prod.base_price_krw} margin=${prod.margin_multiplier} active=${prod.is_active} types=[${types.join(',')}] pricedOpts=${pricedTotal}`)
  for (const t of types) console.log(`    ${t}: ${byType[t].count}개 (가격이동 ${byType[t].pricedCount}, extra ₩${byType[t].extraRange[0]}~${byType[t].extraRange[1]})`)
}

const summary = {
  generatedAt: new Date().toISOString(),
  priceModel: '(base_price_krw + Σ print_product_options.extra_price_krw) × margin × 환율 (calculateItemPriceUsd)',
  note: '/api/swadpia-price(calculateSwadpiaPriceKrw)는 UI 미사용 — sync-prices/cron 의 base_price 갱신 전용',
  pass: results.filter(r => r.verdict === '✅').length,
  warn: results.filter(r => r.verdict === '🟡').length,
  fail: results.filter(r => r.verdict === '❌').length,
  results,
}
console.log('\n' + JSON.stringify(summary, null, 2))
