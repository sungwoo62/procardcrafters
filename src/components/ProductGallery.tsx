'use client'

import Image from 'next/image'
import { useState } from 'react'

interface Props {
  heroUrl: string | null
  galleryUrls: string[] | null
  alt: string
  fallback?: React.ReactNode
  gradientClass: string
}

export default function ProductGallery({ heroUrl, galleryUrls, alt, fallback, gradientClass }: Props) {
  const all = [heroUrl, ...(galleryUrls ?? [])].filter((u): u is string => Boolean(u))
  const [activeIdx, setActiveIdx] = useState(0)
  const active = all[activeIdx] ?? heroUrl

  return (
    <div>
      {/* Main view */}
      <div className={`relative h-80 bg-gradient-to-br ${gradientClass} rounded-2xl flex items-center justify-center mb-3 border border-white shadow-sm overflow-hidden`}>
        {active ? (
          <Image
            key={active}
            src={active}
            alt={alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-64 h-64">{fallback}</div>
        )}
      </div>

      {/* Thumbnail strip (only if >1 image) */}
      {all.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {all.slice(0, 5).map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                activeIdx === i
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image src={url} alt={`${alt} ${i + 1}`} fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
