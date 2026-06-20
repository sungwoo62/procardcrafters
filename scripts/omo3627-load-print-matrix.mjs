#!/usr/bin/env node
/**
 * OMO-3627 — 성원 인쇄단가 매트릭스 적재 (print_products.base_price_krw)
 *
 * OMO-3623 표집(scripts/data/omo3623-print-price-samples.json)을 print_products 의
 * base_price_krw 로 적재한다. 10종(전단·포스터·브로셔·책자·캘린더)을 quote-only(last-good)
 * 에서 표집 실공급가로 재분류.
 *
 * ⚠️ 라이브 고객가 변경 = 보드 가격 승인 게이트.
 *   - 기본 DRY-RUN: 현행 base ↔ 표집 base 델타만 출력(쓰기 없음).
 *   - --apply 시에만 DB 갱신. SWADPIA_MATRIX_ROUTING 라우팅 플래그와 별개로,
 *     적재 자체가 고객가를 바꾸므로 보드 승인 후에만 --apply.
 *
 * 환경: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (라이브 쓰기).
 * READ-ONLY 조회는 anon key 로도 가능(RLS 공개 read).
 *
 * 사용:
 *   node scripts/omo3627-load-print-matrix.mjs            # dry-run (델타 리포트)
 *   node scripts/omo3627-load-print-matrix.mjs --apply    # 보드 승인 후 DB 적재
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')

// OMO-3623 표집 → slug 별 대표 MOQ 공급가(base_price_krw). swadpia-print-matrix.ts 와 동일 출처.
const samples = JSON.parse(
  readFileSync(join(__dirname, 'data/omo3623-print-price-samples.json'), 'utf8'),
)
const matrixBase = {}
for (const s of samples.samples) {
  if (s.sample_index === 0 && s.order_count === 1 && s.gate === 'pass') {
    for (const slug of s.slugs) matrixBase[slug] = s.supply_amt
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY(또는 ANON_KEY) 필요')
  process.exit(2)
}
const supabase = createClient(url, key)

const slugs = Object.keys(matrixBase)
const { data: rows, error } = await supabase
  .from('print_products')
  .select('slug, base_price_krw')
  .in('slug', slugs)
if (error) {
  console.error('조회 실패:', error.message)
  process.exit(1)
}
const current = Object.fromEntries((rows || []).map((r) => [r.slug, Number(r.base_price_krw ?? 0)]))

console.log(`\n=== OMO-3627 인쇄단가 매트릭스 적재 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`)
console.log('slug'.padEnd(26), 'current'.padStart(10), 'sampled'.padStart(10), 'Δ%'.padStart(9))
const plan = []
for (const slug of slugs) {
  const cur = current[slug] ?? 0
  const next = matrixBase[slug]
  const pct = cur > 0 ? (((next - cur) / cur) * 100).toFixed(0) + '%' : 'n/a'
  console.log(slug.padEnd(26), String(cur).padStart(10), String(next).padStart(10), pct.padStart(9))
  if (next !== cur) plan.push({ slug, from: cur, to: next })
}
console.log(`\n변경 대상: ${plan.length}/${slugs.length}종 (KRW base, 고객가 = base×margin×FX)\n`)

if (!APPLY) {
  console.log('DRY-RUN — DB 쓰기 없음. 보드 승인 후 --apply 로 적재하세요.')
  process.exit(0)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('--apply 는 SUPABASE_SERVICE_ROLE_KEY 필요(쓰기 권한).')
  process.exit(2)
}
let ok = 0
for (const p of plan) {
  const { error: e } = await supabase
    .from('print_products')
    .update({ base_price_krw: p.to })
    .eq('slug', p.slug)
  if (e) console.error(`  ✗ ${p.slug}: ${e.message}`)
  else { ok++; console.log(`  ✓ ${p.slug}: ${p.from} → ${p.to}`) }
}
console.log(`\n적재 완료: ${ok}/${plan.length}종. SWADPIA_MATRIX_ROUTING ON 으로 구성기 라우팅 활성.`)
