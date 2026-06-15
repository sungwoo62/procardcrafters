// 제품군 일반화 니치 랜딩 라우트 /[group]/for/[slug] (OMO-3215).
// business-cards 포함 전 제품군(stickers/flyers/posters/labels)을 단일 엔진으로 구동.
// 기존 /business-cards/for/[profession] URL 을 동일 엔진으로 무회귀 재사용.
// Next 16 App Router — params 는 Promise.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getNicheGroups, getNicheByGroup, getNicheItem } from '@/lib/niche/content'
import { buildNicheJsonLd } from '@/lib/niche/jsonld'
import { absoluteUrl } from '@/lib/site'
import NicheLanding from '@/components/niche/NicheLanding'
import NicheProfessionLinks from '@/components/niche/NicheProfessionLinks'

export const revalidate = 3600
export const dynamicParams = true

type Params = { group: string; slug: string }

// 빌드 타임 정적 생성 + 신규 콘텐츠는 ISR(dynamicParams)로 자동 수용.
export async function generateStaticParams(): Promise<Params[]> {
  const groups = getNicheGroups()
  const all = await Promise.all(
    groups.map(async (g) => {
      const items = await getNicheByGroup(g.group)
      return items.map((c) => ({ group: g.group, slug: c.slug }))
    }),
  )
  return all.flat()
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { group, slug } = await params
  const c = await getNicheItem(group, slug)
  if (!c) return { title: 'Not found' }
  const url = absoluteUrl(`/${c.productGroup}/for/${c.slug}`)
  return {
    // absolute: 루트 layout 의 '%s | Procardcrafters' 템플릿 우회(브랜드 중복 방지). metaTitle 이미 브랜드 포함.
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    alternates: {
      canonical: url,
      languages: { 'en-US': url }, // hreflang=en-US (OMO-2383 패턴)
    },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url,
      type: 'website',
      locale: 'en_US',
    },
  }
}

export default async function NichePage(
  { params }: { params: Promise<Params> },
) {
  const { group, slug } = await params
  const c = await getNicheItem(group, slug)
  if (!c) notFound()

  const jsonLd = buildNicheJsonLd(c)

  return (
    <>
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      <NicheLanding content={c} />
      {/* business-cards 완전한 sibling 메시(OMO-2994): 현재 직업 제외한 나머지 직업 전부로 내부링크 */}
      {c.productGroup === 'business-cards' && (
        <NicheProfessionLinks
          excludeSlug={c.slug}
          heading="Business cards for other professions"
          subhead="Same premium finishes, tuned for a different line of work."
        />
      )}
    </>
  )
}
