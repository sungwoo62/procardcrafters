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

const STATIC_FALLBACK: TickerItem[] = [
  { id: '1', maskedName: '김○○', city: '서울', productName: '명함 500장', relativeTime: '3분 전' },
  { id: '2', maskedName: 'L. Park', city: 'Los Angeles', productName: 'Stickers 1,000pcs', relativeTime: '8분 전' },
  { id: '3', maskedName: '이○○', city: '부산', productName: '스티커 200장', relativeTime: '12분 전' },
  { id: '4', maskedName: 'J. Kim', city: 'New York', productName: 'Business Cards 500pcs', relativeTime: '19분 전' },
  { id: '5', maskedName: '박○○', city: '대전', productName: '전단지 1,000장', relativeTime: '25분 전' },
  { id: '6', maskedName: 'M. Chen', city: 'Toronto', productName: 'Postcards 200pcs', relativeTime: '31분 전' },
  { id: '7', maskedName: '최○○', city: '인천', productName: '프리미엄 명함 300장', relativeTime: '38분 전' },
  { id: '8', maskedName: 'S. Lee', city: 'London', productName: 'Flyers 500pcs', relativeTime: '44분 전' },
]

export default function HomepageOrderTicker() {
  const [items, setItems] = useState<TickerItem[]>(STATIC_FALLBACK)
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
            <span className="font-medium text-white">{item.maskedName ?? '고객'}</span>
            <span>님이</span>
            <span className="text-blue-300">{item.relativeTime ?? '방금'}</span>
            <span className="font-medium text-white">{item.productName ?? '제품'}</span>
            <span>주문</span>
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
