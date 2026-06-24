// OMO-3744: 방문자 프로필 패널 — 공통 매핑·포맷·마스킹 유틸 (procard admin surface)
// 데이터 소스: cs_visitor_profiles(visitor_id, site='procard') + cs_page_views(session_id 연결)
// 레퍼런스: allpack-ops src/lib/messenger/visitorProfile.ts (OMO-3324/3321)
// ⚠️ cs_page_views.session_id 는 TEXT(UUID 캐스팅 금지). IP 는 서버에서 마스킹 후 전달.

export type VisitorPageView = {
  id: string
  pageUrl: string | null
  referrer: string | null
  createdAt: string
}

export type VisitorProfile = {
  device: string | null
  os: string | null
  browser: string | null
  screenResolution: string | null
  locale: string | null
  timezone: string | null
  userAgent: string | null
  snsChannel: string | null
  referrer: string | null
  landingUrl: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  currentPageUrl: string | null
  country: string | null
  region: string | null
  city: string | null
  ipMasked: string | null
  visitCount: number | null
  sessionCount: number | null
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export type VisitorProfileResponse = {
  profile: VisitorProfile | null
  pageViews: VisitorPageView[]
}

// 한국어 필드 라벨(내부 운영자용 패널 — 회사 공통 ops 표준과 동일 문자열)
export const VISITOR_FIELD_LABELS = {
  device: '디바이스',
  os: '운영체제',
  browser: '브라우저',
  screenResolution: '화면 해상도',
  locale: '언어',
  timezone: '시간대',
  snsChannel: '유입 채널',
  referrer: '리퍼러',
  landingUrl: '랜딩 페이지',
  utmSource: 'UTM 소스',
  utmMedium: 'UTM 매체',
  utmCampaign: 'UTM 캠페인',
  currentPageUrl: '최근 페이지',
  country: '국가',
  region: '지역',
  city: '도시',
  ip: 'IP',
  visitCount: '방문 횟수',
  sessionCount: '세션 수',
  firstSeenAt: '최초 방문',
  lastSeenAt: '최근 방문',
} as const

// ===== IP 부분 마스킹 (OMO-2760 최소수집 · 서버측 적용) =====
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const trimmed = ip.trim()
  if (!trimmed) return null
  // IPv4: 뒤 2옥텟 마스킹 (211.234.*.*)
  if (trimmed.includes('.') && !trimmed.includes(':')) {
    const parts = trimmed.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`
  }
  // IPv6: 앞 2그룹만 노출
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}:****`
  }
  return '***'
}

// ===== DB 로우 → VisitorProfile 매핑(snake_case → camelCase, IP 마스킹) =====
type ProfileRow = Record<string, unknown>

export function mapProfileRow(row: ProfileRow | null | undefined): VisitorProfile | null {
  if (!row) return null
  const s = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
  const n = (v: unknown): number | null => (typeof v === 'number' ? v : null)
  return {
    device: s(row.device),
    os: s(row.os),
    browser: s(row.browser),
    screenResolution: s(row.screen_resolution),
    locale: s(row.locale),
    timezone: s(row.timezone),
    userAgent: s(row.user_agent),
    snsChannel: s(row.sns_channel),
    referrer: s(row.referrer),
    landingUrl: s(row.landing_url),
    utmSource: s(row.utm_source),
    utmMedium: s(row.utm_medium),
    utmCampaign: s(row.utm_campaign),
    currentPageUrl: s(row.current_page_url),
    country: s(row.country),
    region: s(row.region),
    city: s(row.city),
    ipMasked: maskIp(s(row.ip)),
    visitCount: n(row.visit_count),
    sessionCount: n(row.session_count),
    firstSeenAt: s(row.first_seen_at),
    lastSeenAt: s(row.last_seen_at),
  }
}

export function mapPageViewRows(rows: ProfileRow[] | null | undefined): VisitorPageView[] {
  if (!rows) return []
  return rows.map((r) => ({
    id: String(r.id ?? ''),
    pageUrl: typeof r.page_url === 'string' ? r.page_url : null,
    referrer: typeof r.referrer === 'string' ? r.referrer : null,
    createdAt: String(r.created_at ?? ''),
  }))
}
