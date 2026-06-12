'use client'

import { useState, useEffect, useRef } from 'react'
import { TrendingUp } from 'lucide-react'

interface TickerItem {
  id: string
  maskedName?: string
  city?: string
  productName?: string
  relativeTime?: string
}

// ⚠️ 정직화(OMO-2975): 조작된 주문 활동 fallback 금지. 실주문 데이터가 충분할 때만 렌더.
export default function HomepageOrderTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/social-proof/recent-orders')
      .then(r => r.json())
      .then(d => {
        const loaded: TickerItem[] = (d.toasts ?? [])
          .filter((t: { type: string }) => t.type === 'recent_order')
          .slice(0, 12)
        if (loaded.length >= 4) setItems(loaded)
      })
      .catch(() => {})
  }, [])

  // 실주문이 부족하면 티커 자체를 숨김(가짜 활동 노출 금지)
  if (items.length === 0) return null

  const doubled = [...items, ...items]

  return (
    <div className="bg-blue-950/80 border-y border-blue-900/40 py-2.5 overflow-hidden select-none">
      <div
        ref={trackRef}
        className="flex gap-0 animate-ticker whitespace-nowrap"
        style={{ width: 'max-content' }}
      >
        {doubled.map((item, i) => (
          <span
            key={`${item.id}-${i}`}
            className="inline-flex items-center gap-1.5 text-blue-200 text-xs px-6"
          >
            <TrendingUp className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="font-medium text-white">{item.maskedName ?? 'Customer'}</span>
            <span>ordered</span>
            <span className="font-medium text-white">{item.productName ?? 'products'}</span>
            <span className="text-blue-300">{item.relativeTime ?? 'just now'}</span>
            {item.city && <span className="text-blue-400">({item.city})</span>}
            <span className="text-blue-700 mx-2">•</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 40s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
