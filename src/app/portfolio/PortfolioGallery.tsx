'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { ZoomIn, Star } from 'lucide-react'
import Lightbox from '@/components/Lightbox'
import type { PortfolioItem } from './page'

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'business_cards', label: 'Business Cards' },
  { value: 'stickers', label: 'Stickers' },
  { value: 'flyers', label: 'Flyers' },
  { value: 'postcards', label: 'Postcards' },
  { value: 'posters', label: 'Posters' },
]

interface Props {
  items: PortfolioItem[]
}

export default function PortfolioGallery({ items }: Props) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return items
    return items.filter((item) => item.category === activeCategory)
  }, [items, activeCategory])

  const openLightbox = (idx: number) => setLightboxIndex(idx)
  const closeLightbox = () => setLightboxIndex(null)
  const prevItem = () => setLightboxIndex((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length))
  const nextItem = () => setLightboxIndex((i) => (i === null ? null : (i + 1) % filtered.length))

  const lightboxItems = filtered.map((item) => ({
    id: item.id,
    image_url: item.image_url,
    title: item.title,
    description: item.description,
    category: item.category,
    tags: item.tags,
  }))

  return (
    <>
      {/* Category Filter */}
      <section className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm py-4 px-4">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setActiveCategory(cat.value); setLightboxIndex(null) }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.value
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label}
              {cat.value !== 'all' && (
                <span className={`ml-1.5 text-xs ${activeCategory === cat.value ? 'text-blue-200' : 'text-gray-400'}`}>
                  ({items.filter((i) => i.category === cat.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No items in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => openLightbox(idx)}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Image
                  src={item.thumbnail_url ?? item.image_url}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <ZoomIn className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white/80" />
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  {item.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="inline-block text-xs text-white/60 mt-0.5">
                      #{tag}
                    </span>
                  ))}
                </div>
                {/* Featured Badge */}
                {item.is_featured && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-400/90 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                    <Star className="w-3 h-3 fill-current" /> Featured
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      <Lightbox
        items={lightboxItems}
        activeIndex={lightboxIndex}
        onClose={closeLightbox}
        onPrev={prevItem}
        onNext={nextItem}
      />
    </>
  )
}
