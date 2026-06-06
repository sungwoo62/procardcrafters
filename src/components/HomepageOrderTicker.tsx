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
  { id: '1', maskedName: 'J. Kim', city: 'Seoul', productName: 'Business Cards 500pcs', relativeTime: '3 min ago' },
  { id: '2', maskedName: 'L. Park', city: 'Los Angeles', productName: 'Stickers 1,000pcs', relativeTime: '8 min ago' },
  { id: '3', maskedName: 'S. Lee', city: 'Busan', productName: 'Stickers 200pcs', relativeTime: '12 min ago' },
  { id: '4', maskedName: 'J. Kim', city: 'New York', productName: 'Business Cards 500pcs', relativeTime: '19 min ago' },
  { id: '5', maskedName: 'M. Park', city: 'Daejeon', productName: 'Flyers 1,000pcs', relativeTime: '25 min ago' },
  { id: '6', maskedName: 'M. Chen', city: 'Toronto', productName: 'Postcards 200pcs', relativeTime: '31 min ago' },
  { id: '7', maskedName: 'H. Choi', city: 'Incheon', productName: 'Premium Cards 300pcs', relativeTime: '38 min ago' },
  { id: '8', maskedName: 'S. Lee', city: 'London', productName: 'Flyers 500pcs', relativeTime: '44 min ago' },
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
