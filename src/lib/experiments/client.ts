// 브라우저용 실험 헬퍼 — 배정 조회 + 이벤트 전송 (OMO-2596)
'use client'

const SESSION_KEY = 'print_exp_session_id'

export interface AssignedVariant {
  id: string
  key: string
  config: Record<string, unknown>
}

// 비로그인 사용자 식별용 세션 ID (localStorage 영속)
export function getExperimentSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = window.localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/** 실험 변형 배정 조회. 미배정/오류 시 null → 호출부는 기본 변형 표시. */
export async function assignVariant(
  experimentKey: string,
  userId?: string
): Promise<AssignedVariant | null> {
  try {
    const res = await fetch('/api/experiments/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experimentKey,
        sessionId: getExperimentSessionId(),
        userId: userId ?? null,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { assigned: boolean; variant: AssignedVariant | null }
    return data.assigned ? data.variant : null
  } catch {
    return null
  }
}

async function track(
  experimentKey: string,
  variantKey: string,
  eventType: 'impression' | 'click' | 'conversion',
  extra: { value?: number; orderId?: string; userId?: string } = {}
): Promise<void> {
  try {
    await fetch('/api/experiments/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        experimentKey,
        variantKey,
        eventType,
        sessionId: getExperimentSessionId(),
        ...extra,
      }),
    })
  } catch {
    // 이벤트 유실 허용 — UX 차단 금지
  }
}

export function trackImpression(experimentKey: string, variantKey: string, userId?: string) {
  return track(experimentKey, variantKey, 'impression', { userId })
}

export function trackClick(experimentKey: string, variantKey: string, userId?: string) {
  return track(experimentKey, variantKey, 'click', { userId })
}

export function trackConversion(
  experimentKey: string,
  variantKey: string,
  opts: { value?: number; orderId?: string; userId?: string } = {}
) {
  return track(experimentKey, variantKey, 'conversion', opts)
}
