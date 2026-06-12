// 동적 직업별 니치 랜딩 라우트 /business-cards/for/[profession] (OMO-2971).
// Next 16 App Router — params 는 Promise.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllProfessions, getProfessionBySlug } from '@/lib/niche/professions'
import { buildNicheJsonLd } from '@/lib/niche/jsonld'
import { absoluteUrl } from '@/lib/site'
import NicheLanding from '@/components/niche/NicheLanding'
import NicheProfessionLinks from '@/components/niche/NicheProfessionLinks'

export const revalidate = 3600

type Params = { profession: string }

// 빌드 타임 정적 생성 + 신규 직업은 ISR(dynamicParams)로 자동 수용.
export async function generateStaticParams(): Promise<Params[]> {
  const all = await getAllProfessions()
  return all.map((p) => ({ profession: p.slug }))
}

export const dynamicParams = true

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { profession } = await params
  const p = await getProfessionBySlug(profession)
  if (!p) return { title: 'Not found' }
  const url = absoluteUrl(`/business-cards/for/${p.slug}`)
  return {
    // absolute: 루트 layout 의 '%s | Procardcrafters' 템플릿 우회(브랜드 중복 방지). metaTitle 이미 브랜드 포함.
    title: { absolute: p.metaTitle },
    description: p.metaDescription,
    alternates: {
      canonical: url,
      languages: { 'en-US': url }, // hreflang=en-US (OMO-2383 패턴)
    },
    openGraph: {
      title: p.metaTitle,
      description: p.metaDescription,
      url,
      type: 'website',
      locale: 'en_US',
    },
  }
}

export default async function ProfessionPage(
  { params }: { params: Promise<Params> },
) {
  const { profession } = await params
  const p = await getProfessionBySlug(profession)
  if (!p) notFound()

  const jsonLd = buildNicheJsonLd(p)

  return (
    <>
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      <NicheLanding p={p} />
      {/* 완전한 sibling 메시(OMO-2994): 현재 직업 제외한 나머지 직업 전부로 내부링크 */}
      <NicheProfessionLinks
        excludeSlug={p.slug}
        heading="Business cards for other professions"
        subhead="Same premium finishes, tuned for a different line of work."
      />
    </>
  )
}
