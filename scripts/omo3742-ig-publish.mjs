#!/usr/bin/env node
/**
 * OMO-3742 — procardcrafters @procard IG organic 게시 워커 검증 CLI.
 *
 * 모드:
 *   --check                organic 게시 가능 여부 점검(IG가 BM 비즈니스 계정으로 연결됐는지).
 *   --dry-run              컨테이너 생성 payload만 출력(실제 IG 호출 0건). 기본 모드.
 *   --image <url>          게시할 공개 https 이미지 URL(여러 번 지정 가능 → 캐러셀).
 *   --caption <text>       캡션.
 *   --live                 (게이트) organic 연결 확인 후에만 실제 게시. 미연결 시 거부.
 *
 * 자격증명: .env.local 의 PCCF_META_LONG_LIVED_TOKEN / PCCF_META_IG_USER_ID / PCCF_META_APP_SECRET.
 *   토큰 미설정 시 --check 는 not_configured, --dry-run 은 payload만 출력.
 *
 * ⚠️ 라이브 게시 하드 전제(OMO-3737): 실 @procard IG(17841464131369489)가 비즈니스
 *   계정으로 BM에 연결되어야 한다. PBIA(광고용)는 organic 게시 불가.
 */
import { createHmac } from 'crypto'
import { readFileSync } from 'fs'

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
    }
  } catch { /* 없으면 무시 */ }
}
loadEnv(new URL('../.env.local', import.meta.url).pathname)

const API_VERSION = process.env.META_API_VERSION || 'v22.0'
const GRAPH = `https://graph.facebook.com/${API_VERSION}`
const DEFAULT_IG_USER_ID = '17841464131369489'

const TOKEN = process.env.PCCF_META_LONG_LIVED_TOKEN || ''
const IG_USER_ID = process.env.PCCF_META_IG_USER_ID || DEFAULT_IG_USER_ID
const APP_SECRET = process.env.PCCF_META_APP_SECRET || ''

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const multi = (f) => args.reduce((acc, a, i) => (args[i - 1] === f ? [...acc, a] : acc), [])
const one = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }

function proof() {
  return APP_SECRET ? createHmac('sha256', APP_SECRET).update(TOKEN).digest('hex') : null
}

function buildContainerPayload(imageUrls, caption) {
  if (imageUrls.length === 1) {
    return { endpoint: `${IG_USER_ID}/media`, payload: { image_url: imageUrls[0], caption } }
  }
  return {
    endpoint: `${IG_USER_ID}/media`,
    payload: { media_type: 'CAROUSEL', caption, _children_image_urls: imageUrls.slice(0, 10) },
  }
}

async function graphGet(path, fields) {
  const qs = new URLSearchParams({ access_token: TOKEN, fields })
  const p = proof(); if (p) qs.set('appsecret_proof', p)
  const res = await fetch(`${GRAPH}/${path}?${qs}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || `IG API 오류(${res.status})`)
  return data
}

async function check() {
  console.log('=== OMO-3742 organic 게시 readiness 점검 ===')
  console.log(`IG user id: ${IG_USER_ID}`)
  if (!TOKEN) {
    console.log('결과: not_configured — PCCF_META_LONG_LIVED_TOKEN 미설정')
    console.log('→ 라이브 게시 불가. 토큰/연결 완료 전까지 dry-run만 가능.')
    return false
  }
  try {
    const me = await graphGet(IG_USER_ID, 'id,username,account_type')
    const ok = me.account_type === 'BUSINESS' || me.account_type === 'MEDIA_CREATOR'
    console.log(`username: @${me.username ?? '?'}  account_type: ${me.account_type ?? '?'}`)
    console.log(ok
      ? '결과: ready ✅ — organic 게시 가능'
      : '결과: not_ready ❌ — BM에 IG 비즈니스 계정 연결 필요(PBIA는 organic 불가, OMO-3737)')
    return ok
  } catch (e) {
    console.log(`결과: not_ready ❌ — ${e.message}`)
    console.log('→ IG가 BM 자산으로 연결되지 않았을 수 있음(OMO-3737 후속).')
    return false
  }
}

function dryRun() {
  const imageUrls = multi('--image').filter(Boolean)
  const caption = one('--caption') || '(캡션 미지정)'
  if (imageUrls.length === 0) {
    console.log('⚠️ --image <url> 를 1개 이상 지정하세요. (예시 payload를 위해 placeholder 사용)')
    imageUrls.push('https://procardcrafters.com/sample.jpg')
  }
  const { endpoint, payload } = buildContainerPayload(imageUrls, caption)
  console.log('=== OMO-3742 dry-run: 컨테이너 생성 payload ===')
  console.log(`POST ${GRAPH}/${endpoint}`)
  console.log(JSON.stringify(payload, null, 2))
  console.log(imageUrls.length === 1
    ? '→ 단일 이미지 게시물(create container → media_publish)'
    : `→ 캐러셀 ${Math.min(imageUrls.length, 10)}장(슬라이드별 컨테이너 → CAROUSEL 부모 → media_publish)`)
  console.log('실제 IG 호출: 0건 (dry-run)')
}

async function main() {
  if (has('--check')) {
    await check()
    return
  }
  if (has('--live')) {
    const ready = await check()
    if (!ready) {
      console.log('\n❌ 라이브 게시 거부: organic 연결 미완. dry-run/스캐폴딩까지만 가능(OMO-3742 게이트).')
      process.exit(2)
    }
    console.log('\n(라이브 게시는 igPostQueue.dispatchIgPost 경유 — 사람 승인 게이트 통과 필요)')
    return
  }
  dryRun()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
