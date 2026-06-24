#!/usr/bin/env node
/**
 * OMO-3752 검증: procard 광고 = 뉴트라 공용 KRW 계정 "분리 집행" 정합성 확인.
 *
 * 2단계:
 *  (A) 오프라인 dry-run — 토큰 없이 순수 payload 빌더를 실행해
 *      ① KRW 예산 단위 ② @procardcrafters 신원 ③ PROCARD 네이밍 ④ procard 픽셀 분리를 증명.
 *  (B) 라이브(선택) — PCCF_META_* 토큰이 있으면 광고계정 통화/연결 IG·페이지를 GET으로 확인
 *      (선행: 보드 UI에서 @procardcrafters IG + procard 페이지를 계정에 연결).
 *
 * 사용: node scripts/omo3752-procard-ads-validate.mjs  (Node ≥22.18: TS 타입 자동 스트립)
 * 어떤 경우에도 실제 캠페인을 생성하지 않는다(읽기/빌드만).
 */
import { readFileSync } from 'fs'

// .env.local 로드(있으면)
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
} catch { /* 없으면 무시 */ }

// policy.ts는 순수 모듈(Next/Supabase 의존 없음) → Node 타입 스트립으로 직접 로드.
const policy = await import('../src/lib/meta-ads/policy.ts')

function ok(label, cond, detail) {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  return cond
}

console.log('\n=== (A) 오프라인 dry-run: payload 분리 증명 ===\n')
let pass = true

// ② 신원 + ③ 네이밍 + ④ 픽셀 + ① KRW 예산
const campaign = policy.buildCampaignPayload('POD MVP W1', 'OUTCOME_SALES')
pass &= ok('③ 캠페인 PROCARD 네이밍', campaign.name === 'PROCARD — POD MVP W1', campaign.name)
pass &= ok('   캠페인 PAUSED 빌드', campaign.status === 'PAUSED')

const adset = policy.buildAdsetPayload({
  name: 'POD MVP W1',
  campaignId: 'c1',
  targeting: { geo_locations: { countries: ['US'] }, age_min: 18, age_max: 65 },
  dailyBudgetMinor: policy.DAILY_BUDGET_MINOR,
  pixelId: process.env.PCCF_META_PIXEL_ID || '1421706653319003',
})
pass &= ok('③ 광고세트 PROCARD 네이밍', adset.name.startsWith('PROCARD —'), adset.name)
pass &= ok(
  '① KRW 예산 단위(원, cents 아님)',
  adset.daily_budget === 30000 && policy.ACCOUNT_CURRENCY === 'KRW',
  `daily_budget=${adset.daily_budget} (${policy.formatMinor(adset.daily_budget)})`,
)
pass &= ok(
  '④ procard 픽셀 promoted_object',
  !!adset.promoted_object && adset.promoted_object.pixel_id !== policy.NUTRA_FORBIDDEN_PIXEL_ID,
  `pixel_id=${adset.promoted_object?.pixel_id}`,
)

const creative = policy.buildCreativePayload(
  'POD MVP W1',
  { page_id: process.env.PCCF_META_PAGE_ID || '1115260595012450', instagram_actor_id: policy.PROCARD_INSTAGRAM_ACTOR_ID },
  { message: 'Pro business cards, designed for your trade. Fast.', link: 'https://procardcrafters.com' },
)
const spec = creative.object_story_spec
pass &= ok('② object_story_spec.page_id 설정', !!spec.page_id, `page_id=${spec.page_id}`)
pass &= ok(
  '② instagram_actor_id = @procardcrafters',
  spec.instagram_actor_id === policy.PROCARD_INSTAGRAM_ACTOR_ID,
  `actor=${spec.instagram_actor_id}`,
)

// 혼용 차단 가드 검증
let blocked = false
try {
  policy.buildAdsetPayload({ name: 'X', campaignId: 'c', targeting: {}, dailyBudgetMinor: 30000, pixelId: policy.NUTRA_FORBIDDEN_PIXEL_ID })
} catch { blocked = true }
pass &= ok('가드: 뉴트라 메인 픽셀 주입 차단', blocked)

let igBlocked = false
try {
  policy.assertProcardIdentity({ page_id: '1', instagram_actor_id: '999_nutra' })
} catch { igBlocked = true }
pass &= ok('가드: 뉴트라 IG actor 차단', igBlocked)

console.log(`\n(A) 결과: ${pass ? 'PASS ✅' : 'FAIL ❌'}`)

// ─── (B) 라이브 선행조건 확인(토큰 있을 때만) ───
console.log('\n=== (B) 라이브 선행조건(토큰 있을 때만) ===\n')
const TOKEN = process.env.PCCF_META_LONG_LIVED_TOKEN
const ACCT = process.env.PCCF_META_AD_ACCOUNT_ID
if (!TOKEN || !ACCT) {
  console.log('⏭  PCCF_META_LONG_LIVED_TOKEN/AD_ACCOUNT_ID 미설정 — 라이브 확인 생략(오프라인만).')
  process.exit(pass ? 0 : 1)
}
const SECRET = process.env.PCCF_META_APP_SECRET
const { createHmac } = await import('crypto')
const proof = SECRET ? createHmac('sha256', SECRET).update(TOKEN).digest('hex') : null
async function g(endpoint, fields) {
  const url = new URL(`https://graph.facebook.com/v22.0${endpoint}`)
  url.searchParams.set('access_token', TOKEN)
  if (proof) url.searchParams.set('appsecret_proof', proof)
  if (fields) url.searchParams.set('fields', fields)
  const r = await fetch(url)
  const j = await r.json()
  if (j.error) throw new Error(`${endpoint}: ${j.error.message} (code ${j.error.code})`)
  return j
}
try {
  const acct = await g(`/${ACCT}`, 'name,currency,timezone_name')
  ok('계정 통화 = KRW', acct.currency === 'KRW', `${acct.name} | ${acct.currency} | ${acct.timezone_name}`)
  const igs = await g(`/${ACCT}/instagram_accounts`, 'id,username')
  const list = igs.data || []
  ok(
    '선행: @procardcrafters IG가 계정에 연결됨',
    list.some((i) => i.id === policy.PROCARD_INSTAGRAM_ACTOR_ID),
    list.length ? list.map((i) => `@${i.username}(${i.id})`).join(', ') : 'instagram_accounts=[] (보드 UI 연결 필요)',
  )
} catch (e) {
  console.log(`라이브 확인 실패: ${e.message}`)
}
process.exit(pass ? 0 : 1)
