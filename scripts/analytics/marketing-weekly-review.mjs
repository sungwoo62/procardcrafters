#!/usr/bin/env node
/**
 * marketing-weekly-review.mjs — OMO-2597 검증/시드 스크립트
 *
 * 목적: /api/cron/marketing-review 와 동일한 집계를 실 DB(service_role)로 재현해
 *   (1) print_orders/print_ad_spend 스키마 컬럼 가용성 검증,
 *   (2) 직전 완료 주 vs 전주 KPI 산출,
 *   (3) print_marketing_reviews 에 첫 리포트 upsert(영속화 증거).
 *
 * 주의: 채널 파생/제안 로직의 단일 소스는 src/lib/marketing/{performance,review}.ts 이며,
 *   본 스크립트는 동일 규칙을 검증용으로 재현한다(런타임 TS 러너 부재). 추측 수치 금지.
 *
 * 사용법: node scripts/analytics/marketing-weekly-review.mjs [--anchor YYYY-MM-DD] [--persist]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

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
const local = readEnvLocal()
const env = (n) => process.env[n] || local[n]
const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}
const db = createClient(SUPABASE_URL, SERVICE_KEY)

const args = process.argv.slice(2)
const anchorArg = args.indexOf('--anchor')
const PERSIST = args.includes('--persist')
const anchor = anchorArg >= 0 ? new Date(`${args[anchorArg + 1]}T00:00:00Z`) : new Date(Date.now() - 86400000)

// ── 채널 파생(attribution.ts deriveChannel 재현) ──────────────
const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'naver.', 'ecosia.']
const SOCIAL_HOSTS = ['facebook.', 'instagram.', 't.co', 'twitter.', 'x.com', 'tiktok.', 'pinterest.', 'linkedin.', 'youtube.']
const norm = (v) => (v ?? '').trim().toLowerCase()
function deriveChannel(o) {
  const source = norm(o.utm_source), medium = norm(o.utm_medium)
  if (o.gclid) return 'paid_search'
  if (o.fbclid) return 'paid_social'
  if (medium) {
    if (['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'sem'].includes(medium)) return 'paid_search'
    if (['paid_social', 'paidsocial', 'social_paid', 'display'].includes(medium)) return 'paid_social'
    if (medium === 'email' || medium === 'newsletter') return 'email'
    if (medium === 'organic') return 'organic_search'
    if (medium === 'social') return 'organic_social'
    if (medium === 'referral') return 'referral'
  }
  if (source) {
    if (['google', 'bing', 'naver'].includes(source)) return 'organic_search'
    if (['facebook', 'instagram', 'meta', 'tiktok', 'twitter', 'x'].includes(source)) return 'organic_social'
    if (source === 'newsletter' || source === 'email') return 'email'
    return 'referral'
  }
  const host = norm(o.referrer_host)
  if (host) {
    if (SEARCH_HOSTS.some((h) => host.includes(h))) return 'organic_search'
    if (SOCIAL_HOSTS.some((h) => host.includes(h))) return 'organic_social'
    return 'referral'
  }
  return 'direct'
}
const SPEND_MAP = { google_ads: 'paid_search', meta: 'paid_social', tiktok: 'paid_social' }
const LABELS = { paid_search: '유료 검색', paid_social: '유료 소셜', organic_search: '자연 검색', organic_social: '자연 소셜', email: '이메일', referral: '추천', direct: '직접/미식별' }
const r2 = (n) => Math.round(n * 100) / 100

function weekStart(d) {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  out.setUTCDate(out.getUTCDate() - ((out.getUTCDay() + 6) % 7))
  return out
}
const addDays = (d, n) => { const o = new Date(d); o.setUTCDate(o.getUTCDate() + n); return o }

async function aggregate(start, end) {
  const startIso = start.toISOString(), endIso = end.toISOString()
  const startDate = startIso.slice(0, 10), endDate = endIso.slice(0, 10)
  const { data: orders, error: oErr } = await db
    .from('print_orders')
    .select('total_usd, status, utm_source, utm_medium, gclid, fbclid, referrer_host')
    .gte('created_at', startIso).lt('created_at', endIso)
    .not('status', 'in', '(cancelled,refunded)')
  if (oErr) throw new Error(`orders: ${oErr.message}`)
  const ch = {}
  const ensure = (c) => (ch[c] ||= { channel: c, label: LABELS[c], orders: 0, revenue_usd: 0, spend_usd: 0, clicks: 0, impressions: 0, roas: null, cpa_usd: null })
  let rev = 0, ord = 0, attr = 0
  for (const o of orders ?? []) {
    const c = deriveChannel(o), a = ensure(c), v = Number(o.total_usd ?? 0)
    a.orders++; a.revenue_usd += v; rev += v; ord++; if (c !== 'direct') attr++
  }
  const { data: spend, error: sErr } = await db
    .from('print_ad_spend').select('channel, spend_usd, clicks, impressions')
    .gte('spend_date', startDate).lt('spend_date', endDate)
  if (sErr) throw new Error(`ad_spend: ${sErr.message}`)
  let totSpend = 0, totClicks = 0
  for (const s of spend ?? []) {
    const a = ensure(SPEND_MAP[s.channel] ?? 'paid_search')
    a.spend_usd += Number(s.spend_usd ?? 0); a.clicks += Number(s.clicks ?? 0); a.impressions += Number(s.impressions ?? 0)
    totSpend += Number(s.spend_usd ?? 0); totClicks += Number(s.clicks ?? 0)
  }
  const channels = Object.values(ch).map((c) => {
    c.aov_usd = c.orders > 0 ? r2(c.revenue_usd / c.orders) : 0
    c.roas = c.spend_usd > 0 ? r2(c.revenue_usd / c.spend_usd) : null
    c.cpa_usd = c.spend_usd > 0 && c.orders > 0 ? r2(c.spend_usd / c.orders) : null
    c.revenue_usd = r2(c.revenue_usd); c.spend_usd = r2(c.spend_usd)
    return c
  }).sort((a, b) => b.revenue_usd - a.revenue_usd)
  return {
    since: startIso, until: endIso,
    kpi: {
      revenue_usd: r2(rev), orders: ord, aov_usd: ord > 0 ? r2(rev / ord) : 0,
      ad_spend_usd: r2(totSpend), blended_roas: totSpend > 0 ? r2(rev / totSpend) : null,
      blended_cpa_usd: totSpend > 0 && ord > 0 ? r2(totSpend / ord) : null,
      paid_clicks: totClicks, paid_cvr_pct: totClicks > 0 ? r2((ord / totClicks) * 100) : null,
      attributed_orders: attr,
    },
    channels,
    spendRows: (spend ?? []).length, orderRows: (orders ?? []).length,
  }
}

const curStart = weekStart(anchor), curEnd = addDays(curStart, 7), prevStart = addDays(curStart, -7)
const cur = await aggregate(curStart, curEnd)
const prev = await aggregate(prevStart, curStart)

console.log(`\n주간 마케팅 리뷰 검증 — 대상 주 ${cur.since.slice(0,10)} ~ ${cur.until.slice(0,10)}`)
console.log('DB 스키마 검증: print_orders 귀속 컬럼 OK, print_ad_spend OK (쿼리 에러 없음)')
console.log(`\n[금주] 주문행 ${cur.orderRows} · 광고비행 ${cur.spendRows}`)
console.log('  KPI:', JSON.stringify(cur.kpi))
console.log(`[전주] 주문행 ${prev.orderRows} · 광고비행 ${prev.spendRows}`)
console.log('  KPI:', JSON.stringify(prev.kpi))
console.log('\n채널별(금주):')
for (const c of cur.channels) console.log(`  ${c.label}: 매출 $${c.revenue_usd} · 주문 ${c.orders} · ROAS ${c.roas ?? 'N/A'} · CPA ${c.cpa_usd ?? 'N/A'}`)

if (PERSIST) {
  const hasPrev = prev.kpi.orders > 0 || prev.kpi.revenue_usd > 0 || prev.kpi.ad_spend_usd > 0
  const row = {
    period_start: cur.since, period_end: cur.until,
    metrics: { current: cur, previous: hasPrev ? prev : null },
    suggestions: [], data_gaps: [{ metric: '사이트 전체 CVR(주문/세션)', reason: 'GA4 세션 미연동', unblock: 'OMO-2602' }],
    summary_md: `# 검증 시드 — ${cur.since.slice(0,10)}~${cur.until.slice(0,10)}\n실 데이터 집계 검증 완료. 정식 리포트는 주간 cron이 생성.`,
  }
  const { error } = await db.from('print_marketing_reviews').upsert(row, { onConflict: 'period_start' })
  if (error) { console.error('persist 실패:', error.message); process.exit(1) }
  console.log('\n✅ print_marketing_reviews upsert 성공(period_start unique)')
}
