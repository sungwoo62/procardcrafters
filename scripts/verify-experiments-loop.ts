/**
 * 자동 최적화 루프 엔드투엔드 검증 (OMO-2596)
 * 실제 service 코드(runOptimizationLoop)를 사용해 증빙한다.
 *
 * 실행: npx tsx scripts/verify-experiments-loop.ts
 * 테스트 실험 생성 → 노출/전환 시드 → 루프 실행 → 승자 채택·패자 비활성 검증 → 정리
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { runOptimizationLoop } from '../src/lib/experiments/service'
import { assignVariant } from '../src/lib/experiments/service'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    })
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
const KEY = 'verify_loop_' + Math.floor(Date.now() / 1000)
let expId: string | null = null

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('  ✓ ' + msg)
}

async function main() {
try {
  const { data: exp, error: e1 } = await db
    .from('print_marketing_experiments')
    .insert({
      key: KEY,
      name: 'E2E 검증 실험',
      surface: 'product_page',
      status: 'running',
      goal_metric: 'cvr',
      min_sample_per_variant: 200,
      auto_promote: true,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (e1) throw e1
  expId = exp.id as string
  console.log('실험 생성:', KEY)

  const { data: variants, error: e2 } = await db
    .from('print_marketing_experiment_variants')
    .insert([
      { experiment_id: expId, key: 'control', name: 'Control', is_control: true, weight: 1 },
      { experiment_id: expId, key: 'B', name: 'Variant B', is_control: false, weight: 1 },
    ])
    .select()
  if (e2) throw e2
  const control = variants!.find((v) => v.key === 'control')!
  const vB = variants!.find((v) => v.key === 'B')!

  // 배정 sticky 검증 (실제 service.assignVariant)
  const a1 = await assignVariant(db, exp as never, 'sticky-sess', null)
  const a2 = await assignVariant(db, exp as never, 'sticky-sess', null)
  assert(!!a1 && a1.id === a2?.id, 'assignVariant: 동일 세션 sticky')

  // 이벤트 시드: control 5% CVR, B 10% CVR (각 노출 1000)
  type Ev = Record<string, unknown>
  const events: Ev[] = []
  for (let i = 0; i < 1000; i++) {
    events.push({ experiment_id: expId, variant_id: control.id, event_type: 'impression', session_id: 'c' + i })
    events.push({ experiment_id: expId, variant_id: vB.id, event_type: 'impression', session_id: 'b' + i })
  }
  for (let i = 0; i < 50; i++) {
    events.push({ experiment_id: expId, variant_id: control.id, event_type: 'conversion', session_id: 'c' + i, value: 30 })
  }
  for (let i = 0; i < 100; i++) {
    events.push({ experiment_id: expId, variant_id: vB.id, event_type: 'conversion', session_id: 'b' + i, value: 30 })
  }
  for (let i = 0; i < events.length; i += 500) {
    const { error } = await db.from('print_marketing_experiment_events').insert(events.slice(i, i + 500))
    if (error) throw error
  }
  console.log('이벤트 시드:', events.length)

  // 실제 자동 최적화 루프 실행
  const outcomes = await runOptimizationLoop(db)
  const mine = outcomes.find((o) => o.experimentKey === KEY)
  console.log('루프 결과:', JSON.stringify(mine, null, 2))
  assert(!!mine, '루프가 실험을 평가함')
  assert(mine!.result.decided && mine!.result.reason === 'significant', '유의한 승자 판정')
  assert(mine!.result.winnerKey === 'B', '승자 = Variant B')
  assert(mine!.promoted === true, '자동 채택됨')
  assert(mine!.deactivatedVariantKeys.includes('control'), '패자(control) 비활성화')

  // DB 상태 검증
  const { data: after } = await db.from('print_marketing_experiments').select('*').eq('id', expId).single()
  assert(after!.status === 'completed', 'DB: status=completed')
  assert(after!.winner_variant_id === vB.id, 'DB: winner=B')
  const { data: vAfter } = await db.from('print_marketing_experiment_variants').select('*').eq('experiment_id', expId)
  assert(vAfter!.find((v) => v.key === 'control')!.is_active === false, 'DB: control 비활성')
  assert(vAfter!.find((v) => v.key === 'B')!.is_active === true, 'DB: B 활성 유지')

  console.log('\n✅ 자동 최적화 루프 엔드투엔드 검증 통과')
} catch (err) {
  console.error('\n❌', (err as Error).message || err)
  process.exitCode = 1
} finally {
  if (expId) {
    await db.from('print_marketing_experiments').delete().eq('id', expId)
    console.log('정리 완료 (실험 CASCADE 삭제)')
  }
}
}

main()
