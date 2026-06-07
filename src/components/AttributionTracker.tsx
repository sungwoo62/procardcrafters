'use client'

import { useEffect } from 'react'
import { captureFirstTouchAttribution } from '@/lib/attribution-capture'

// 방문 시 first-touch 채널 귀속을 1회 캡처한다 (OMO-2594).
// 렌더 출력 없음 — 레이아웃에 한 번 마운트.
export default function AttributionTracker() {
  useEffect(() => {
    captureFirstTouchAttribution()
  }, [])
  return null
}
