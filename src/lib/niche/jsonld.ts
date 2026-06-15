// 니치 페이지 구조화 데이터 — 전 제품군 공유(OMO-3215, 기반 OMO-2971).
// BreadcrumbList + Product/Offer + FAQPage.
// ⚠️ AggregateRating 절대 금지 — 신뢰 게이트(OMO-2383) 통과 전까지 리뷰/평점 stat 미부착.

import { BRAND, absoluteUrl } from '@/lib/site'
import type { NicheContent } from '@/lib/niche/content'
import { getGroupLabel } from '@/lib/niche/content'

export function buildNicheJsonLd(c: NicheContent) {
  const pageUrl = absoluteUrl(`/${c.productGroup}/for/${c.slug}`)
  const groupLabel = getGroupLabel(c.productGroup)

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: groupLabel,
        item: absoluteUrl(`/${c.productGroup}/for`),
      },
      { '@type': 'ListItem', position: 3, name: c.title, item: pageUrl },
    ],
  }

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: c.h1,
    description: c.metaDescription,
    brand: { '@type': 'Brand', name: BRAND.name },
    category: groupLabel,
    url: pageUrl,
    // ⚠️ aggregateRating / review 필드 의도적으로 제외 (OMO-2383).
    offers: {
      '@type': 'Offer',
      priceCurrency: BRAND.currency,
      price: c.priceFrom,
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: BRAND.currency,
        price: c.priceFrom,
        valueAddedTaxIncluded: false,
      },
      availability: 'https://schema.org/InStock',
      url: pageUrl,
    },
  }

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  return [breadcrumb, product, faqPage]
}
