'use client'

import { useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface LightboxItem {
  id: string
  image_url: string
  title: string
  description?: string | null
  category: string
  tags?: string[]
}

interface LightboxProps {
  items: LightboxItem[]
  activeIndex: number | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  business_cards: 'Business Cards',
  stickers: 'Stickers',
  flyers: 'Flyers',
  postcards: 'Postcards',
  posters: 'Posters',
  other: 'Other',
}

export default function Lightbox({ items, activeIndex, onClose, onPrev, onNext }: LightboxProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') onPrev()
    if (e.key === 'ArrowRight') onNext()
  }, [onClose, onPrev, onNext])

  useEffect(() => {
    if (activeIndex === null) return
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [activeIndex, handleKeyDown])

  if (activeIndex === null) return null

  const item = items[activeIndex]
  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
        aria-label="닫기"
      >
        <X className="w-6 h-6" />
      </button>

      {/* 이전 버튼 */}
      {items.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 z-10 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="이전"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* 다음 버튼 */}
      {items.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 z-10 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="다음"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* 콘텐츠 */}
      <div
        className="relative max-w-5xl w-full mx-4 sm:mx-12 flex flex-col md:flex-row gap-4 items-start"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 이미지 */}
        <div className="relative w-full md:flex-1 aspect-[4/3] rounded-xl overflow-hidden bg-gray-900 shrink-0">
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 70vw"
            priority
          />
        </div>

        {/* 정보 패널 */}
        <div className="md:w-64 shrink-0 text-white">
          <span className="inline-block text-xs font-semibold bg-blue-500/30 text-blue-200 px-2.5 py-1 rounded-full mb-3">
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
          <h3 className="text-xl font-bold mb-2 leading-snug">{item.title}</h3>
          {item.description && (
            <p className="text-sm text-white/70 leading-relaxed mb-4">{item.description}</p>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag} className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* 인덱스 표시 */}
          <p className="text-xs text-white/40 mt-6">
            {activeIndex + 1} / {items.length}
          </p>
        </div>
      </div>
    </div>
  )
}
