#!/usr/bin/env node
/**
 * OMO-3737: procardcrafters Meta 자산 연결성 감사(connectivity audit)
 * 페이지↔IG↔비즈니스↔광고계정↔픽셀이 모두 올바로 연결돼 광고 집행 가능한지 점검한다.
 *
 * 사용: PCCF_META_* 로드 후
 *   node scripts/audit-meta-connectivity.mjs [IG_ID]
 * IG_ID 미지정 시 PCCF_META_INSTAGRAM_ACTOR_ID 사용.
 */
import { createHmac } from 'crypto'
import { readFileSync } from 'fs'

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
    }
  } catch { /* noop */ }
}
loadEnv(new URL('../.env.local', import.meta.url).pathname)

const BASE = 'https://graph.facebook.com/v22.0'
const TOKEN = process.env.PCCF_META_LONG_LIVED_TOKEN
const SECRET = process.env.PCCF_META_APP_SECRET
const AD_ACCOUNT = process.env.PCCF_META_AD_ACCOUNT_ID
const PAGE_ID = process.env.PCCF_META_PAGE_ID
const BUSINESS_ID = process.env.PCCF_META_BUSINESS_ID
const PIXEL_ID = process.env.PCCF_META_PIXEL_ID
const IG_ID = process.argv[2] || process.env.PCCF_META_INSTAGRAM_ACTOR_ID
if (!TOKEN || !SECRET) { console.error('토큰/시크릿 미설정'); process.exit(1) }
const proof = createHmac('sha256', SECRET).update(TOKEN).digest('hex')

async function g(endpoint, fields) {
  const url = new URL(`${BASE}${endpoint}`)
  url.searchParams.set('access_token', TOKEN)
  url.searchParams.set('appsecret_proof', proof)
  if (fields) url.searchParams.set('fields', fields)
  const res = await fetch(url.toString())
  const data = await res.json()
  if (data.error) return { __error: data.error.message, __code: data.error.code }
  return data
}

const ok = (b) => (b ? '✅' : '❌')
const results = []
function row(label, pass, detail) { results.push({ label, pass, detail }); console.log(`${ok(pass)} ${label} — ${detail}`) }

async function main() {
  console.log(`\n=== Meta 연결성 감사 (IG=${IG_ID}) ===\n`)

  // 1) IG 계정 유효성
  const ig = await g(`/${IG_ID}`, 'username,name,ig_id,profile_picture_url')
  row('IG 계정 유효', !ig.__error && !!ig.username, ig.__error ? ig.__error : `@${ig.username} (${ig.name || '-'})`)

  // 2) 페이지 ↔ IG 연결
  const page = await g(`/${PAGE_ID}`, 'name,instagram_business_account{id,username},connected_instagram_account{id,username}')
  const iba = page.instagram_business_account
  const cia = page.connected_instagram_account
  const linkedId = iba?.id || cia?.id
  row('페이지↔IG 연결', linkedId === IG_ID, page.__error ? page.__error
    : linkedId ? `${page.name} → ${iba ? 'instagram_business_account' : 'connected_instagram_account'}=${linkedId} (@${iba?.username || cia?.username})`
    : `${page.name} 에 IG 미연결`)

  // 3) 광고계정 ↔ 비즈니스
  const acct = await g(`/${AD_ACCOUNT}`, 'name,business,account_status,currency')
  row('광고계정↔비즈니스', acct.business?.id === BUSINESS_ID, acct.__error ? acct.__error
    : `${acct.name} biz=${acct.business?.id} status=${acct.account_status}`)

  // 4) 광고계정에서 IG를 광고 신원으로 사용 가능?
  const adIg = await g(`/${AD_ACCOUNT}/instagram_accounts`, 'id,username')
  const adIgList = adIg.data || []
  row('광고계정에서 IG 사용가능', adIgList.some((a) => a.id === IG_ID || a.username),
    adIg.__error ? adIg.__error : adIgList.length ? adIgList.map((a) => `${a.id}@${a.username || '-'}`).join(', ') : '연결된 IG 없음')

  // 4b) 페이지 백드 IG(PBIA) — 페이지 신원 IG 노출용 placeholder
  const pbia = page.page_backed_instagram_accounts?.data?.[0]
    || (await g(`/${PAGE_ID}`, 'page_backed_instagram_accounts{id,username}')).page_backed_instagram_accounts?.data?.[0]
  if (pbia) console.log(`ℹ️  page-backed IG 존재: ${pbia.id} (페이지 신원으로 IG 배치 노출 가능 — 실제 IG 아님)`)

  // 5) 비즈니스 ↔ 페이지 소유
  const ownedPages = await g(`/${BUSINESS_ID}/owned_pages`, 'id,name')
  const opList = ownedPages.data || []
  row('비즈니스↔페이지 소유', opList.some((p) => p.id === PAGE_ID),
    ownedPages.__error ? ownedPages.__error : opList.map((p) => `${p.id}(${p.name})`).join(', ') || '없음')

  // 6) 픽셀 ↔ 광고계정
  const pix = await g(`/${AD_ACCOUNT}/adspixels`, 'id,name')
  const pxList = pix.data || []
  row('픽셀↔광고계정', pxList.some((p) => p.id === PIXEL_ID),
    pix.__error ? pix.__error : pxList.map((p) => `${p.id}(${p.name})`).join(', ') || '없음')

  const pass = results.filter((r) => r.pass).length
  console.log(`\n=== 결과: ${pass}/${results.length} 연결 OK ===`)
  console.log(`PCCF_META_INSTAGRAM_ACTOR_ID=${IG_ID}`)
}
main().catch((e) => { console.error('audit 실패:', e.message); process.exit(1) })
