// 제품군 니치 허브 /flyers/for (OMO-3213). 단일 소스: src/lib/niche/categories.ts
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getNicheCategory } from '@/lib/niche/categories'
import { buildHubMetadata } from '@/lib/niche/categoryRoute'
import CategoryNicheHub from '@/components/niche/CategoryNicheHub'
import CategoryNicheLinks from '@/components/niche/CategoryNicheLinks'

const CATEGORY_SLUG = 'flyers'

export const revalidate = 3600
export const metadata: Metadata = buildHubMetadata(CATEGORY_SLUG)

export default function FlyersHubPage() {
  const category = getNicheCategory(CATEGORY_SLUG)
  if (!category) notFound()
  return (
    <>
      <CategoryNicheHub category={category} />
      <CategoryNicheLinks category={category} />
    </>
  )
}
