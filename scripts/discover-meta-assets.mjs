#!/usr/bin/env node
/**
 * OMO-3737: procardcrafters Meta 자산 자동 발견(discovery)
 * 기존 시스템유저 토큰으로 페이지/인스타/비즈니스/픽셀 ID를 Graph API에서 직접 조회한다.
 * (페이지/IG 신규 생성은 Graph API 미지원 — 이미 존재하는 자산을 발견·연결하는 용도)
 *
 * 사용: PCCF_META_* 가 들어있는 .env.local 을 로드한 뒤 실행.
 *   node scripts/discover-meta-assets.mjs
 * 출력: 사람이 읽는 요약 + .env 에 붙여넣을 라인.  토큰/시크릿은 출력하지 않는다.
 */
import { createHmac } from 'crypto'
import { readFileSync } from 'fs'

// --- .env.local 로드 (process.env 우선) ---
function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
    }
  } catch { /* 없으면 무시 */ }
}
loadEnv(new URL('../.env.local', import.meta.url).pathname)

const BASE = 'https://graph.facebook.com/v22.0'
const TOKEN = process.env.PCCF_META_LONG_LIVED_TOKEN
const SECRET = process.env.PCCF_META_APP_SECRET
const AD_ACCOUNT = process.env.PCCF_META_AD_ACCOUNT_ID
if (!TOKEN) {
  console.error('PCCF_META_LONG_LIVED_TOKEN 미설정 — .env.local 확인')
  process.exit(1)
}
// OMO-3752: APP_SECRET 미설정 운영(allpack-ai) → proof 생략. 있으면 첨부.
const proof = SECRET ? createHmac('sha256', SECRET).update(TOKEN).digest('hex') : null

async function g(endpoint, fields) {
  const url = new URL(`${BASE}${endpoint}`)
  url.searchParams.set('access_token', TOKEN)
  if (proof) url.searchParams.set('appsecret_proof', proof)
  if (fields) url.searchParams.set('fields', fields)
  const res = await fetch(url.toString())
  const data = await res.json()
  if (data.error) throw new Error(`${endpoint}: ${data.error.message} (code ${data.error.code})`)
  return data
}

async function main() {
  const found = {}

  // 1) 토큰 주체
  const me = await g('/me', 'id,name')
  console.log(`\n토큰 주체: ${me.name} (${me.id})`)

  // 2) 광고계정 → 비즈니스
  if (AD_ACCOUNT) {
    try {
      const acct = await g(`/${AD_ACCOUNT}`, 'name,currency,business,timezone_name')
      console.log(`\n광고계정: ${acct.name} | ${acct.currency} | ${acct.timezone_name}`)
      if (acct.business) {
        found.PCCF_META_BUSINESS_ID = acct.business.id
        console.log(`  └ 비즈니스: ${acct.business.name} (${acct.business.id})`)
      }
    } catch (e) { console.log(`\n광고계정 조회 실패: ${e.message}`) }
  }

  // 3) 접근 가능 페이지 + 연결된 인스타
  try {
    const pages = await g('/me/accounts', 'id,name,instagram_business_account{id,username},link')
    const list = pages.data || []
    console.log(`\n접근 가능 페이지 ${list.length}개:`)
    for (const p of list) {
      const ig = p.instagram_business_account
      console.log(`  • ${p.name} (page ${p.id})${ig ? ` ↔ IG @${ig.username} (${ig.id})` : ' [IG 미연결]'}`)
    }
    // procardcrafters 매칭(이름) 또는 첫 페이지
    const pick = list.find((p) => /procard|pccf/i.test(p.name)) || list[0]
    if (pick) {
      found.PCCF_META_PAGE_ID = pick.id
      if (pick.instagram_business_account) found.PCCF_META_INSTAGRAM_ACTOR_ID = pick.instagram_business_account.id
    }
  } catch (e) { console.log(`\n페이지 조회 실패: ${e.message}`) }

  // 4) 픽셀 (없으면 생성 안내)
  if (AD_ACCOUNT) {
    try {
      const px = await g(`/${AD_ACCOUNT}/adspixels`, 'id,name')
      const list = px.data || []
      console.log(`\n픽셀 ${list.length}개:`)
      for (const p of list) console.log(`  • ${p.name} (${p.id})`)
      if (list[0]) found.PCCF_META_PIXEL_ID = list[0].id
      else console.log('  (없음 — --create-pixel 로 생성 가능)')
    } catch (e) { console.log(`\n픽셀 조회 실패: ${e.message}`) }
  }

  console.log('\n─── .env 에 추가할 라인 ───')
  for (const k of ['PCCF_META_BUSINESS_ID', 'PCCF_META_PAGE_ID', 'PCCF_META_INSTAGRAM_ACTOR_ID', 'PCCF_META_PIXEL_ID']) {
    console.log(`${k}=${found[k] ?? ''}`)
  }
}

main().catch((e) => { console.error('discovery 실패:', e.message); process.exit(1) })
