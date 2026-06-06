'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Copy, Check, Users, TrendingUp, AlertCircle, Clock, Bell, BellOff, Share2 } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────
export interface SocialProofItem {
  id: string              // print_orders.id
  type: 'recent_order' | 'viewer_count' | 'weekly_stats' | 'stock_alert' | 'deadline'
  maskedName?: string     // 마스킹된 이름
  city?: string
  productName?: string
  relativeTime?: string
  viewerCount?: number    // viewer_count 타입
  weeklyCount?: number    // weekly_stats 타입
  stockCount?: number     // stock_alert 타입
  productSlug?: string    // stock_alert / viewer_count
  deadlineLabel?: string  // deadline 타입
  deadlineDays?: number
  createdAt?: string
}

interface ToastEntry extends SocialProofItem {
  isSelf: boolean
  toastId: string
}

const STORAGE_KEY = 'pccf_sp_disabled'
const SELF_HISTORY_KEY = 'pccf_self_notifications'
const PAGE_MAX = 3
const INTERVAL_MS = 30_000
const SELF_DURATION_MS = 10_000
const NORMAL_DURATION_MS = 6_000

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────
function genToastId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function isDisabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

function saveSelfNotification(entry: ToastEntry) {
  try {
    const raw = localStorage.getItem(SELF_HISTORY_KEY) ?? '[]'
    const arr: ToastEntry[] = JSON.parse(raw)
    arr.unshift(entry)
    localStorage.setItem(SELF_HISTORY_KEY, JSON.stringify(arr.slice(0, 100)))
  } catch {}
}

// ──────────────────────────────────────────────
// 개별 토스트 메시지 렌더링
// ──────────────────────────────────────────────
function toastMessage(item: SocialProofItem): { icon: React.ReactNode; text: string } {
  switch (item.type) {
    case 'recent_order':
      return {
        icon: <TrendingUp className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />,
        text: `${item.maskedName ?? '고객'} 님이 ${item.relativeTime ?? '방금'} ${item.productName ?? '제품'} 주문${item.city ? ` (${item.city})` : ''}`,
      }
    case 'viewer_count':
      return {
        icon: <Users className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />,
        text: `지금 ${item.viewerCount}명이 이 디자인 보는 중`,
      }
    case 'weekly_stats':
      return {
        icon: <TrendingUp className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />,
        text: `이번 주 ${item.weeklyCount?.toLocaleString()}건 출고`,
      }
    case 'stock_alert':
      return {
        icon: <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />,
        text: `오늘 ${item.productName ?? '이 제품'} ${item.stockCount}개 남음`,
      }
    case 'deadline':
      return {
        icon: <Clock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
        text: item.deadlineLabel ?? '이번 주말 마감 — 다음 출고 +N일',
      }
    default:
      return { icon: null, text: '' }
  }
}

// ──────────────────────────────────────────────
// 공유 버튼 (self-recognition 전용)
// ──────────────────────────────────────────────
function ShareButtons({ entry, userId }: { entry: ToastEntry; userId: string | null }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?ref=share&utm_source=selfshare`
    : ''

  async function handleShare(method: 'url_copy' | 'twitter' | 'kakao') {
    await fetch('/api/social-proof/share-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toastId: entry.toastId,
        orderId: entry.id,
        shareMethod: method,
        utmRef: 'self_toast',
        userId: userId ?? undefined,
      }),
    }).catch(() => {})

    if (method === 'url_copy') {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {}
    } else if (method === 'twitter') {
      const msg = encodeURIComponent(`방금 ${entry.productName ?? 'print'} 주문했어요! ${shareUrl}`)
      window.open(`https://twitter.com/intent/tweet?text=${msg}`, '_blank')
    }
  }

  return (
    <div className="flex gap-1 mt-2">
      <button
        type="button"
        onClick={() => handleShare('url_copy')}
        className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md transition-colors"
        aria-label="링크 복사"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? '복사됨' : 'URL'}
      </button>
      <button
        type="button"
        onClick={() => handleShare('twitter')}
        className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md transition-colors"
        aria-label="X(트위터) 공유"
      >
        <Share2 className="w-3 h-3" />
        X
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────
// 메인 컴포넌트 (props-free: 세션/주문 ID 자가 로드)
// ──────────────────────────────────────────────
export default function SocialProofToast() {
  const [disabled, setDisabled] = useState(false)
  const [queue, setQueue] = useState<SocialProofItem[]>([])
  const [current, setCurrent] = useState<ToastEntry | null>(null)
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'leaving'>('hidden')
  const [userOrderIds, setUserOrderIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameRef = useRef<number>(0)
  const queueRef = useRef<SocialProofItem[]>([])
  const pageRef = useRef(0)
  const visibleRef = useRef(true)

  // 알림 끄기 상태 초기화
  useEffect(() => {
    setDisabled(isDisabled())
  }, [])

  // 로그인 사용자의 최근 주문 ID 로드 (self-recognition용)
  useEffect(() => {
    const supabase = createAuthBrowserClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      setUserId(session.user.id)
      // 최근 30일 주문 ID 조회
      const { data } = await supabase
        .from('print_orders')
        .select('id')
        .eq('customer_email', session.user.email ?? '')
        .in('status', ['paid', 'processing', 'shipped', 'delivered'])
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50)
      if (data) setUserOrderIds(data.map(r => r.id))
    }).catch(() => {})
  }, [])

  // 페이지 visibility 감지 — 백그라운드 탭에서 일시정지
  useEffect(() => {
    function onVisibility() { visibleRef.current = document.visibilityState === 'visible' }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 데이터 로드
  useEffect(() => {
    if (disabled) return
    async function loadQueue() {
      try {
        const res = await fetch('/api/social-proof/recent-orders')
        const data = await res.json()
        const items: SocialProofItem[] = data.toasts ?? []
        queueRef.current = items
        setQueue(items)
      } catch {}
    }
    loadQueue()
  }, [disabled])

  // 토스트 표시 로직
  const showNext = useCallback(() => {
    if (!visibleRef.current) {
      timerRef.current = setTimeout(showNext, 2000)
      return
    }
    if (disabled || isDisabled()) return
    if (pageRef.current >= PAGE_MAX) return

    const items = queueRef.current
    if (items.length === 0) return

    const idx = pageRef.current % items.length
    const item = items[idx]
    const isSelf = userOrderIds.includes(item.id)
    const toastId = genToastId()
    const entry: ToastEntry = { ...item, isSelf, toastId }

    if (isSelf) {
      saveSelfNotification(entry)
    }

    setPhase('entering')
    setCurrent(entry)
    pageRef.current += 1

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => setPhase('visible'))
    })

    const duration = isSelf ? SELF_DURATION_MS : NORMAL_DURATION_MS
    timerRef.current = setTimeout(() => dismiss(), duration)
  }, [disabled, userOrderIds])

  const dismiss = useCallback(() => {
    setPhase('leaving')
    setTimeout(() => {
      setPhase('hidden')
      setCurrent(null)
      // 30초 후 다음 토스트
      timerRef.current = setTimeout(showNext, INTERVAL_MS)
    }, 300)
  }, [showNext])

  // 초기 시작 (3초 지연)
  useEffect(() => {
    if (disabled || queue.length === 0) return
    timerRef.current = setTimeout(showNext, 3000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [queue, disabled, showNext])

  function toggleDisabled() {
    const next = !disabled
    setDisabled(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEY, '1')
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}
    if (next) dismiss()
  }

  if (disabled && !current) {
    // 알림 끄기 상태에서 작은 ON 버튼만 노출
    return (
      <button
        type="button"
        onClick={toggleDisabled}
        aria-label="실시간 알림 켜기"
        className="fixed bottom-4 right-4 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-md text-gray-400 hover:text-gray-600 transition-colors"
      >
        <BellOff className="w-4 h-4" />
      </button>
    )
  }

  if (phase === 'hidden' || !current) return null

  const { icon, text } = toastMessage(current)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] transition-all duration-300 ${
        phase === 'visible' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      <div
        className={`bg-white border rounded-2xl shadow-xl p-4 flex gap-3 ${
          current.isSelf
            ? 'border-blue-300 shadow-blue-100/60 ring-2 ring-blue-200'
            : 'border-gray-200 shadow-gray-200/60'
        }`}
      >
        {/* 아이콘 */}
        <div className="shrink-0 mt-0.5">{icon}</div>

        <div className="flex-1 min-w-0">
          {/* self-recognition 배지 */}
          {current.isSelf && (
            <p className="text-xs font-semibold text-blue-600 mb-1 flex items-center gap-1">
              🎉 내 주문이 노출됐어요!
            </p>
          )}

          <p className="text-sm text-gray-800 leading-snug">{text}</p>

          {/* self-recognition: 공유 버튼 */}
          {current.isSelf && (
            <ShareButtons entry={current} userId={userId} />
          )}
        </div>

        {/* 알림 끄기 + 닫기 */}
        <div className="shrink-0 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => { dismiss() }}
            aria-label="토스트 닫기"
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleDisabled}
            aria-label="실시간 알림 끄기"
            className="p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
