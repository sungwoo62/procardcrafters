// 마케팅 채널 귀속 first-touch 캡처 (OMO-2594, 북극성 축3)
// 최초 방문 시 쿼리스트링 UTM/gclid/fbclid + document.referrer 를 localStorage 에
// 1회 저장(first-touch)하고, 체크아웃 시 주문 본문에 실어 print_orders 에 기록한다.
// 추측 금지 — 신호가 실제로 있을 때만 해당 필드를 채운다(없으면 서버에서 direct).
//
// 클라이언트 전용(window/document 사용). 서버측 정규화는 attribution.ts 의
// sanitizeAttribution() 가 담당한다(단일 소스 분리).

const STORAGE_KEY = 'pccf_attribution'

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

export interface StoredAttribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  fbclid?: string
  landing_path?: string
  referrer_host?: string
  captured_at?: string
}

function readStored(): StoredAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredAttribution) : null
  } catch {
    return null
  }
}

// 외부(내부 이동이 아닌) referrer 의 호스트만 반환한다.
function externalReferrerHost(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined
  try {
    const host = new URL(document.referrer).host
    if (!host || host === window.location.host) return undefined // 사이트 내부 이동 제외
    return host
  } catch {
    return undefined
  }
}

/**
 * 최초 방문 시 1회만 귀속 신호를 저장한다(first-touch).
 * 이미 저장돼 있으면 덮어쓰지 않아 최초 유입 출처를 보존한다.
 * localStorage 비활성/쿼터 초과 등 어떤 예외에도 조용히 무시 — 페이지/주문 흐름 무영향.
 */
export function captureFirstTouchAttribution(): void {
  if (typeof window === 'undefined') return
  if (readStored()) return // first-touch 보존

  try {
    const params = new URLSearchParams(window.location.search)
    const data: StoredAttribution = {}

    for (const key of UTM_KEYS) {
      const v = params.get(key)
      if (v) data[key] = v.slice(0, 255)
    }
    const gclid = params.get('gclid')
    if (gclid) data.gclid = gclid.slice(0, 512)
    const fbclid = params.get('fbclid')
    if (fbclid) data.fbclid = fbclid.slice(0, 512)

    data.landing_path = (window.location.pathname + window.location.search).slice(0, 512)
    const referrerHost = externalReferrerHost()
    if (referrerHost) data.referrer_host = referrerHost.slice(0, 255)
    data.captured_at = new Date().toISOString()

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage 비활성/쿼터 초과 — 무시(귀속은 best-effort, 주문은 정상 진행)
  }
}

/**
 * 저장된 first-touch 귀속을 주문 API 본문용으로 반환한다.
 * 신호가 없으면 빈 객체 → 서버 sanitizeAttribution 이 전 컬럼 null 로 처리(direct).
 */
export function getStoredAttribution(): StoredAttribution {
  return readStored() ?? {}
}
