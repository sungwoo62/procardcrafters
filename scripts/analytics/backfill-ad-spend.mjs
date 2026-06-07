#!/usr/bin/env node
/**
 * backfill-ad-spend.mjs — OMO-2595 [북극성 축3]
 *
 * 광고비 일배치 cron(`/api/cron/ingest-ad-spend`)을 임의 기간으로 호출해
 * print_ad_spend를 백필한다. 적재 로직은 cron 라우트(src/lib/ad-spend.ts)에
 * 단일 소스로 존재하므로, 본 스크립트는 그 엔드포인트를 호출만 한다(중복 구현 없음).
 *
 * 왜 cron이 아니라 백필 스크립트?
 *   Vercel cron은 기본 days=3(최근 보정분만 재동기화). 출시 초기/누락분 등
 *   과거 N일을 한 번에 적재할 때 사용한다.
 *
 * 자격증명: Vercel env에 GOOGLE_ADS_* / META_* 가 설정돼 있어야 실제 데이터가 흐른다.
 *   미설정 채널은 응답에 status:"skipped" 로 표시된다(추측 적재 없음).
 *
 * 환경변수(.env.local 또는 셸):
 *   CRON_SECRET                      (필수: 라우트 Bearer 인증)
 *   AD_SPEND_BASE_URL                (선택: 기본 https://<NEXT_PUBLIC_SITE_URL>)
 *   NEXT_PUBLIC_SITE_URL             (BASE_URL 미지정 시 사용)
 *
 * 사용:
 *   node scripts/analytics/backfill-ad-spend.mjs --days 30
 *   node scripts/analytics/backfill-ad-spend.mjs --days 7 --channel google_ads
 *   node scripts/analytics/backfill-ad-spend.mjs --days 30 --base http://localhost:3000
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')

function readEnvLocal() {
  const file = path.join(ROOT, '.env.local')
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const args = process.argv.slice(2)
const argVal = (f, d) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : d
}

const local = readEnvLocal()
const get = (k) => process.env[k] || local[k] || ''

const days = Number(argVal('--days', '30'))
const channel = argVal('--channel', 'all')
const secret = get('CRON_SECRET')
let base = argVal('--base', '') || get('AD_SPEND_BASE_URL') || get('NEXT_PUBLIC_SITE_URL')

if (!secret) {
  console.error('[backfill] CRON_SECRET 누락 — .env.local 또는 셸 env에 설정 필요.')
  process.exit(1)
}
if (!base) {
  console.error('[backfill] BASE URL 미지정 — --base 또는 NEXT_PUBLIC_SITE_URL 필요.')
  process.exit(1)
}
base = base.replace(/\/$/, '')

const url = `${base}/api/cron/ingest-ad-spend?days=${days}&channel=${encodeURIComponent(channel)}`
console.log(`[backfill] POST→GET ${url}`)

const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } })
const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error(`[backfill] 실패 ${res.status}:`, JSON.stringify(body))
  process.exit(1)
}
console.log('[backfill] 완료:', JSON.stringify(body, null, 2))

const skipped = (body.channels || []).filter((c) => c.status === 'skipped')
if (skipped.length) {
  console.warn(
    `\n⚠️ 자격증명 미설정 채널: ${skipped.map((c) => c.channel).join(', ')} — Vercel env 설정 필요(docs/OMO-2595 참고).`,
  )
}
