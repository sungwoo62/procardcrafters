// OMO-3159: 경량 인메모리 레이트리미터 (게스트 남용 가드).
//
// PDF 생성은 서버 CPU 를 쓰므로 무인증 공개 라우트는 IP 단위로 제한한다.
// 외부 의존성 없이 고정 윈도(fixed-window) 카운터를 모듈 메모리에 둔다.
//
// 한계(의도적): 서버리스/멀티인스턴스에선 인스턴스별로 카운터가 분리된다.
//   즉 절대 상한이 아니라 "단일 인스턴스 폭주 방지"용 1차 가드다. 강한 보장이
//   필요해지면 추후 Supabase/Upstash 기반으로 승격(이 함수 시그니처 유지).

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** epoch ms — 윈도가 리셋되는 시각. */
  resetAt: number
  retryAfterSec: number
}

/**
 * 고정 윈도 레이트리밋.
 * @param key      식별자(보통 IP). 라우트별 prefix 권장 (예: `quote-pdf:1.2.3.4`).
 * @param limit    윈도당 허용 횟수.
 * @param windowMs 윈도 길이(ms).
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    sweep(now)
    return { ok: true, remaining: limit - 1, resetAt, retryAfterSec: Math.ceil(windowMs / 1000) }
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return {
    ok: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/** 만료 버킷을 가끔 청소해 메모리 누수를 막는다(매 호출 1/16 확률 대신 결정적: 256개 초과 시). */
function sweep(now: number): void {
  if (buckets.size < 256) return
  for (const [k, w] of buckets) {
    if (now >= w.resetAt) buckets.delete(k)
  }
}

/**
 * 요청에서 클라이언트 IP 를 best-effort 로 추출한다.
 * Vercel/프록시 환경: x-forwarded-for 첫 항목 우선.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return headers.get('x-real-ip') || 'unknown'
}
