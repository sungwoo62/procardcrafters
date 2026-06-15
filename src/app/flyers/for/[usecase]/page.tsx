// 동적 제품군 니치 스포크 /flyers/for/[usecase] (OMO-3213).
// Next 16 App Router — params 는 Promise. 단일 소스: src/lib/niche/categories.ts
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getNicheCategory, getNicheEntry, getCategoryEntrySlugs } from '@/lib/niche/categories'
import { buildEntryMetadata } from '@/lib/niche/categoryRoute'
import { buildCategoryNicheJsonLd } from '@/lib/niche/categoryJsonld'
import CategoryNicheLanding from '@/components/niche/CategoryNicheLanding'
import CategoryNicheLinks from '@/components/niche/CategoryNicheLinks'

const CATEGORY_SLUG = 'flyers'

export const revalidate = 3600
export const dynamicParams = false

type Params = { usecase: string }

export function generateStaticParams(): Params[] {
  return getCategoryEntrySlugs(CATEGORY_SLUG).map((usecase) => ({ usecase }))
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { usecase } = await params
  return buildEntryMetadata(CATEGORY_SLUG, usecase)
}

export default async function FlyersNichePage(
  { params }: { params: Promise<Params> },
) {
  const { usecase } = await params
  const category = getNicheCategory(CATEGORY_SLUG)
  const entry = getNicheEntry(CATEGORY_SLUG, usecase)
  if (!category || !entry) notFound()

  const jsonLd = buildCategoryNicheJsonLd(category, entry)

  return (
    <>
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      <CategoryNicheLanding category={category} entry={entry} />
      <CategoryNicheLinks
        category={category}
        excludeSlug={entry.slug}
        heading={`More ${category.label.toLowerCase()}`}
        subhead="Same quality printing, tuned for a different job."
      />
    </>
  )
}
