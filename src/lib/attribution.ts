// 마케팅 채널 귀속(attribution) 유틸 (OMO-2587)
// 주문에 캡처된 UTM/click-id/referrer 를 표준 채널 라벨로 정규화한다.
// 캡처(체크아웃 wiring)와 성과 API 양쪽에서 동일 규칙을 쓰기 위한 단일 소스.

export interface AttributionInput {
  utm_source?: string | null
  utm_medium?: string | null
  gclid?: string | null
  fbclid?: string | null
  referrer_host?: string | null
}

// 표준 채널 라벨 — 대시보드/ROAS 매칭 키와 동일하게 유지할 것.
export type MarketingChannel =
  | 'paid_search' // Google Ads 등 유료 검색
  | 'paid_social' // Meta/TikTok 등 유료 소셜
  | 'organic_search'
  | 'organic_social'
  | 'email'
  | 'referral'
  | 'direct'

const SEARCH_ENGINE_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'naver.', 'ecosia.']
const SOCIAL_HOSTS = [
  'facebook.',
  'instagram.',
  'l.facebook.',
  'lm.facebook.',
  't.co',
  'twitter.',
  'x.com',
  'tiktok.',
  'pinterest.',
  'linkedin.',
  'youtube.',
]

function norm(v?: string | null): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * 주문 귀속 데이터를 표준 마케팅 채널로 변환한다.
 * 우선순위: click-id(유료) → utm → referrer → direct.
 * 추측하지 않는다 — 신호가 없으면 'direct'.
 */
export function deriveChannel(input: AttributionInput): MarketingChannel {
  const source = norm(input.utm_source)
  const medium = norm(input.utm_medium)

  // 1) 유료 click-id 가 가장 강한 신호
  if (input.gclid) return 'paid_search'
  if (input.fbclid) return 'paid_social'

  // 2) UTM medium 기반
  if (medium) {
    if (['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'sem'].includes(medium)) {
      return 'paid_search'
    }
    if (['paid_social', 'paidsocial', 'social_paid', 'display'].includes(medium)) {
      return 'paid_social'
    }
    if (medium === 'email' || medium === 'newsletter') return 'email'
    if (medium === 'organic') return 'organic_search'
    if (medium === 'social') return 'organic_social'
    if (medium === 'referral') return 'referral'
  }

  // 3) UTM source 기반(medium 부재 시)
  if (source) {
    if (['google', 'bing', 'naver'].includes(source)) return 'organic_search'
    if (['facebook', 'instagram', 'meta', 'tiktok', 'twitter', 'x'].includes(source)) {
      return 'organic_social'
    }
    if (source === 'newsletter' || source === 'email') return 'email'
    return 'referral'
  }

  // 4) referrer 호스트 기반
  const host = norm(input.referrer_host)
  if (host) {
    if (SEARCH_ENGINE_HOSTS.some((h) => host.includes(h))) return 'organic_search'
    if (SOCIAL_HOSTS.some((h) => host.includes(h))) return 'organic_social'
    return 'referral'
  }

  // 5) 신호 없음
  return 'direct'
}

// 광고비 테이블(print_ad_spend.channel)과 마케팅 채널 라벨 매핑.
// ROAS/CPA 계산 시 주문 매출 채널 ↔ spend 채널을 합칠 때 사용.
export const AD_SPEND_CHANNEL_MAP: Record<string, MarketingChannel> = {
  google_ads: 'paid_search',
  meta: 'paid_social',
  tiktok: 'paid_social',
}

export const CHANNEL_LABELS_KO: Record<MarketingChannel, string> = {
  paid_search: '유료 검색',
  paid_social: '유료 소셜',
  organic_search: '자연 검색',
  organic_social: '자연 소셜',
  email: '이메일',
  referral: '추천(referral)',
  direct: '직접/미식별',
}
