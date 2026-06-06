'use client'

import { useState, useEffect } from 'react'
import { Bell, Clock, Package, RefreshCw } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'

interface NotificationItem {
  id: string
  toastType: string
  orderId: string | null
  productName: string | null
  viewedAt: string
  pagePath: string | null
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}시간 전`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}일 전`
}

// 마이페이지에서 사용하는 내 알림 패널
export default function MyNotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadNotifications() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createAuthBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('로그인이 필요합니다.')
        return
      }

      const res = await fetch('/api/social-proof/my-notifications', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        setError('알림을 불러오지 못했습니다.')
        return
      }
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch {
      setError('알림을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // localStorage 이력도 함께 병합 (오프라인 이력)
  function loadLocalNotifications(): NotificationItem[] {
    try {
      const raw = localStorage.getItem('pccf_self_notifications') ?? '[]'
      const arr = JSON.parse(raw) as Array<{
        id: string; type: string; productName?: string; createdAt?: string; toastId: string
      }>
      return arr.map(e => ({
        id: e.toastId,
        toastType: e.type,
        orderId: e.id,
        productName: e.productName ?? null,
        viewedAt: e.createdAt ?? new Date().toISOString(),
        pagePath: null,
      }))
    } catch {
      return []
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const localItems = loadLocalNotifications()
  const merged = [
    ...notifications,
    ...localItems.filter(l => !notifications.find(n => n.orderId === l.orderId)),
  ].sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-500" />
          내 주문 알림 이력
        </h3>
        <button
          type="button"
          onClick={loadNotifications}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          aria-label="새로고침"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 p-4">{error}</p>
      )}

      {!loading && merged.length === 0 && (
        <div className="p-8 text-center text-sm text-gray-400">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>아직 노출된 알림이 없어요.</p>
          <p className="text-xs mt-1">주문 후 사이트에서 내 주문 토스트를 확인하세요.</p>
        </div>
      )}

      {merged.length > 0 && (
        <ul className="divide-y divide-gray-50">
          {merged.map((n, i) => (
            <li key={`${n.id}-${i}`} className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">
                  {n.productName ? (
                    <>내 <span className="font-medium">{n.productName}</span> 주문이 노출됐어요</>
                  ) : (
                    '내 주문이 사이트에 노출됐어요'
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {relativeTime(n.viewedAt)}
                </p>
              </div>
              <span className="text-xs text-blue-600 font-medium shrink-0 mt-0.5">🎉</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
