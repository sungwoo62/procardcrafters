// 광고비 일배치 적재 엔진 (OMO-2595 · 북극성 축3: 마케팅 성과측정)
//
// Google Ads / Meta Marketing API에서 일자×캠페인 단위 spend/impressions/clicks/
// conversions를 가져와 print_ad_spend(UNIQUE: spend_date, channel, campaign)에 upsert한다.
// /admin/marketing 의 Blended ROAS/CPA · 채널별 ROAS가 이 데이터를 소비한다.
//
// 설계 원칙(성과측정 정직성):
//  - 자격증명이 없는 채널은 건너뛴다(skipped) — 추측 수치 생성 금지.
//  - 응답 파싱은 순수 함수로 분리(parseGoogleAdsRows/parseMetaInsights)해 테스트 가능.
//  - 동일 (일자,채널,캠페인) 재적재는 upsert로 멱등 — 최근 며칠을 겹쳐 재동기화해
//    플랫폼의 사후 보정(전환/스펜드 finalize)을 반영한다.

import { createServerClient } from '@/lib/supabase'

const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v18'
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0'

export type AdSpendChannel = 'google_ads' | 'meta'

export type AdSpendRow = {
  spend_date: string // YYYY-MM-DD
  channel: AdSpendChannel
  campaign: string
  spend_usd: number
  impressions: number
  clicks: number
  conversions: number
  source: AdSpendChannel
  currency: string
}

export type ChannelResult = {
  channel: AdSpendChannel
  status: 'ok' | 'skipped' | 'error'
  reason?: string // skipped/error 사유
  rows: number
  spend: number
}

export type IngestSummary = {
  range: { since: string; until: string; days: number }
  channels: ChannelResult[]
  upserted: number
}

type GoogleAdsConfig = {
  devToken: string
  clientId: string
  clientSecret: string
  refreshToken: string
  customerId: string
  loginCustomerId: string
}

type MetaConfig = {
  accessToken: string
  adAccountId: string // act_ prefix 제거된 숫자
}

// ─── 설정 해석 (Vercel env 우선) ──────────────────────────────────
// OMO-2557에서 셋업한 Google Ads OAuth 자격증명을 재사용한다.
export function resolveGoogleAdsConfig(): GoogleAdsConfig | null {
  const cfg = {
    devToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
    customerId: (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/[^0-9]/g, ''),
    loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/[^0-9]/g, ''),
  }
  const required = [cfg.devToken, cfg.clientId, cfg.clientSecret, cfg.refreshToken, cfg.customerId]
  if (required.some((v) => !v)) return null
  return cfg
}

export function resolveMetaConfig(): MetaConfig | null {
  // OMO-2552 Meta CAPI 셋업이 적재한 PCCF_META_* 를 우선 재사용(동일 system-user 토큰).
  // 신규 META_* 명도 폴백 지원.
  const accessToken = process.env.PCCF_META_LONG_LIVED_TOKEN || process.env.META_ACCESS_TOKEN || ''
  const rawAccount = process.env.PCCF_META_AD_ACCOUNT_ID || process.env.META_AD_ACCOUNT_ID || ''
  const adAccountId = rawAccount.replace(/^act_/, '').replace(/[^0-9]/g, '')
  if (!accessToken || !adAccountId) return null
  return { accessToken, adAccountId }
}

// ─── 날짜 유틸 ────────────────────────────────────────────────────
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// [since, until] 폐구간. days=3 이면 오늘 포함 최근 3일.
export function dateRange(now: number, days: number): { since: string; until: string } {
  const until = new Date(now)
  const since = new Date(now - (days - 1) * 86400000)
  return { since: isoDate(since), until: isoDate(until) }
}

// ─── 순수 파서: Google Ads search 응답 → AdSpendRow[] ─────────────
// REST search 결과 행은 camelCase. int64 계열은 문자열로 올 수 있어 Number()로 강제.
type GoogleAdsResultRow = {
  campaign?: { name?: string }
  segments?: { date?: string }
  metrics?: {
    costMicros?: string | number
    impressions?: string | number
    clicks?: string | number
    conversions?: string | number
  }
  customer?: { currencyCode?: string }
}

export function parseGoogleAdsRows(
  results: GoogleAdsResultRow[],
  fallbackCurrency = 'USD',
): AdSpendRow[] {
  const out: AdSpendRow[] = []
  for (const r of results ?? []) {
    const date = r.segments?.date
    if (!date) continue
    const m = r.metrics ?? {}
    out.push({
      spend_date: date,
      channel: 'google_ads',
      campaign: r.campaign?.name?.trim() || '(all)',
      spend_usd: Math.round((Number(m.costMicros ?? 0) / 1_000_000) * 100) / 100,
      impressions: Math.round(Number(m.impressions ?? 0)),
      clicks: Math.round(Number(m.clicks ?? 0)),
      conversions: Math.round(Number(m.conversions ?? 0) * 100) / 100,
      source: 'google_ads',
      currency: r.customer?.currencyCode || fallbackCurrency,
    })
  }
  return out
}

// ─── 순수 파서: Meta Insights 응답 → AdSpendRow[] ─────────────────
// actions[] 에서 구매 전환만 합산한다(purchase / offsite_conversion.fb_pixel_purchase).
type MetaAction = { action_type?: string; value?: string | number }
type MetaInsightRow = {
  date_start?: string
  campaign_name?: string
  spend?: string | number
  impressions?: string | number
  clicks?: string | number
  actions?: MetaAction[]
  account_currency?: string
}

const META_PURCHASE_ACTIONS = new Set([
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'omni_purchase',
])

export function parseMetaInsights(rows: MetaInsightRow[], fallbackCurrency = 'USD'): AdSpendRow[] {
  const out: AdSpendRow[] = []
  for (const r of rows ?? []) {
    const date = r.date_start
    if (!date) continue
    let conversions = 0
    for (const a of r.actions ?? []) {
      if (a.action_type && META_PURCHASE_ACTIONS.has(a.action_type)) {
        conversions += Number(a.value ?? 0)
      }
    }
    out.push({
      spend_date: date,
      channel: 'meta',
      campaign: r.campaign_name?.trim() || '(all)',
      spend_usd: Math.round(Number(r.spend ?? 0) * 100) / 100,
      impressions: Math.round(Number(r.impressions ?? 0)),
      clicks: Math.round(Number(r.clicks ?? 0)),
      conversions: Math.round(conversions * 100) / 100,
      source: 'meta',
      currency: r.account_currency || fallbackCurrency,
    })
  }
  return out
}

// ─── Google Ads fetch ────────────────────────────────────────────
async function googleAccessToken(cfg: GoogleAdsConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: 'refresh_token',
  })
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Google OAuth 실패: ${r.status} ${JSON.stringify(j)}`)
  return j.access_token as string
}

export async function fetchGoogleAdsSpend(
  cfg: GoogleAdsConfig,
  since: string,
  until: string,
): Promise<AdSpendRow[]> {
  const token = await googleAccessToken(cfg)
  const query =
    'SELECT campaign.name, segments.date, customer.currency_code, ' +
    'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions ' +
    `FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': cfg.devToken,
    'Content-Type': 'application/json',
  }
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId

  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cfg.customerId}/googleAds:searchStream`
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Google Ads search 실패: ${r.status} ${JSON.stringify(j)}`)
  // searchStream은 [{results:[...]}, ...] 형태로 청크 배열을 반환한다.
  const chunks = Array.isArray(j) ? j : [j]
  const results = chunks.flatMap((c: { results?: GoogleAdsResultRow[] }) => c.results ?? [])
  return parseGoogleAdsRows(results)
}

// ─── Meta fetch (페이지네이션) ────────────────────────────────────
export async function fetchMetaSpend(
  cfg: MetaConfig,
  since: string,
  until: string,
): Promise<AdSpendRow[]> {
  const params = new URLSearchParams({
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    fields: 'campaign_name,spend,impressions,clicks,actions,account_currency',
    limit: '500',
    access_token: cfg.accessToken,
  })
  let url: string | null =
    `https://graph.facebook.com/${META_API_VERSION}/act_${cfg.adAccountId}/insights?${params}`
  const all: MetaInsightRow[] = []
  let guard = 0
  while (url && guard < 50) {
    guard += 1
    const r: Response = await fetch(url)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`Meta Insights 실패: ${r.status} ${JSON.stringify(j)}`)
    all.push(...((j.data as MetaInsightRow[]) ?? []))
    url = j.paging?.next ?? null
  }
  return parseMetaInsights(all)
}

// ─── upsert ───────────────────────────────────────────────────────
export async function upsertAdSpend(rows: AdSpendRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const supabase = createServerClient()
  const nowIso = new Date().toISOString()
  const payload = rows.map((r) => ({ ...r, updated_at: nowIso }))
  const { error } = await supabase
    .from('print_ad_spend')
    .upsert(payload, { onConflict: 'spend_date,channel,campaign' })
  if (error) throw new Error(`print_ad_spend upsert 실패: ${error.message}`)
  return rows.length
}

// ─── 오케스트레이터 ───────────────────────────────────────────────
export async function runAdSpendIngest(opts: {
  now: number
  days?: number
  channels?: AdSpendChannel[]
}): Promise<IngestSummary> {
  const days = opts.days && opts.days > 0 ? Math.min(opts.days, 365) : 3
  const { since, until } = dateRange(opts.now, days)
  const want = opts.channels ?? ['google_ads', 'meta']
  const results: ChannelResult[] = []
  let upserted = 0

  if (want.includes('google_ads')) {
    const cfg = resolveGoogleAdsConfig()
    if (!cfg) {
      results.push({ channel: 'google_ads', status: 'skipped', reason: 'credentials_missing', rows: 0, spend: 0 })
    } else {
      try {
        const rows = await fetchGoogleAdsSpend(cfg, since, until)
        const n = await upsertAdSpend(rows)
        upserted += n
        results.push({
          channel: 'google_ads',
          status: 'ok',
          rows: n,
          spend: Math.round(rows.reduce((s, r) => s + r.spend_usd, 0) * 100) / 100,
        })
      } catch (e) {
        results.push({ channel: 'google_ads', status: 'error', reason: (e as Error).message, rows: 0, spend: 0 })
      }
    }
  }

  if (want.includes('meta')) {
    const cfg = resolveMetaConfig()
    if (!cfg) {
      results.push({ channel: 'meta', status: 'skipped', reason: 'credentials_missing', rows: 0, spend: 0 })
    } else {
      try {
        const rows = await fetchMetaSpend(cfg, since, until)
        const n = await upsertAdSpend(rows)
        upserted += n
        results.push({
          channel: 'meta',
          status: 'ok',
          rows: n,
          spend: Math.round(rows.reduce((s, r) => s + r.spend_usd, 0) * 100) / 100,
        })
      } catch (e) {
        results.push({ channel: 'meta', status: 'error', reason: (e as Error).message, rows: 0, spend: 0 })
      }
    }
  }

  return { range: { since, until, days }, channels: results, upserted }
}
