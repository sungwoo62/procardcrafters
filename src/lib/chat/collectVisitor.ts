// OMO-3744: 방문자 자동수집 — 클라이언트 캡처 유틸(브라우저 전용)
// navigator/screen/Intl/referrer/location + URL 의 utm_* 를 파싱해 /api/chat 로 보낼
// VisitorMetaPayload 를 구성한다. 개인정보 최소수집.
// medal-site / omoongmoo(OMO-3317) / plaque(OMO-3319)와 동일 패턴.
import type { VisitorMetaPayload } from '@/types/chat'

// 영속 방문자 ID 저장 키 — print_chat_logs.session_id(세션 단위)와 별개로
// 방문자(브라우저) 단위로 cs_visitor_profiles 를 매칭하기 위한 단일 소스.
const VISITOR_ID_KEY = 'pccf_visitor_id'

/** 영속 방문자 ID 조회/생성. SSR 안전(window 없으면 ''). 스토리지 차단 시 빈 문자열. */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const persisted = window.localStorage.getItem(VISITOR_ID_KEY)
    if (persisted) return persisted
    const id = `vis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    window.localStorage.setItem(VISITOR_ID_KEY, id)
    return id
  } catch {
    // 시크릿 모드 등 스토리지 차단 — 매칭 불가하지만 흐름은 막지 않는다.
    return ''
  }
}

function detectDevice(ua: string): string {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet'
  }
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Chrome\//i.test(ua)) return 'Chrome'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua)) return 'Safari'
  return 'Unknown'
}

function parseUtm(url: string | undefined) {
  const out: Pick<VisitorMetaPayload,
    'utmSource' | 'utmMedium' | 'utmCampaign' | 'utmTerm' | 'utmContent'> = {}
  if (!url) return out
  try {
    const sp = new URL(url).searchParams
    if (sp.get('utm_source')) out.utmSource = sp.get('utm_source')!
    if (sp.get('utm_medium')) out.utmMedium = sp.get('utm_medium')!
    if (sp.get('utm_campaign')) out.utmCampaign = sp.get('utm_campaign')!
    if (sp.get('utm_term')) out.utmTerm = sp.get('utm_term')!
    if (sp.get('utm_content')) out.utmContent = sp.get('utm_content')!
  } catch { /* invalid url */ }
  return out
}

/** 방문자 메타 수집. 직접 마운트(ChatWidget)이므로 현재 location/referrer 를 사용한다. */
export function collectVisitorMeta(): VisitorMetaPayload {
  if (typeof window === 'undefined') return {}
  const nav = window.navigator
  const ua = nav.userAgent ?? ''
  const pageUrl = window.location.href
  const referrer = document.referrer ?? ''

  let timezone: string | undefined
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch { /* unsupported */ }

  return {
    device: detectDevice(ua),
    os: detectOS(ua),
    browser: detectBrowser(ua),
    screenResolution: window.screen ? `${window.screen.width}x${window.screen.height}` : undefined,
    locale: nav.language,
    timezone,
    userAgent: ua,
    referrer: referrer || undefined,
    landingUrl: pageUrl,
    currentPageUrl: pageUrl,
    ...parseUtm(pageUrl),
  }
}
