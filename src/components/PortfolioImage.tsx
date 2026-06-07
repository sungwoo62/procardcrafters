'use client'

import { useState } from 'react'
import Image from 'next/image'
import ProductImage from './ProductImage'

/**
 * 포트폴리오 썸네일 — 외부 이미지(Unsplash 등) 로드 실패 시
 * 카테고리별 브랜드 일러스트(ProductImage)로 graceful 폴백.
 * 깨진 이미지 아이콘/콘솔 400 노출을 막아 런칭 첫인상 보호. (OMO-2629)
 */
export default function PortfolioImage({
  src,
  alt,
  category,
  className = '',
  sizes,
}: {
  src: string | null | undefined
  alt: string
  category: string
  className?: string
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-200">
        <ProductImage category={category} className="w-full h-full" />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  )
}
