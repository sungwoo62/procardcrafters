// 직업별 니치 페이지 구조화 데이터(OMO-2971).
// BreadcrumbList + Product/Offer + FAQPage.
// ⚠️ AggregateRating 절대 금지 — 신뢰 게이트(OMO-2383) 통과 전까지 리뷰/평점 stat 미부착.

import { BRAND, absoluteUrl } from '@/lib/site'
import type { ProfessionContent } from '@/lib/niche/professions'

export function buildNicheJsonLd(p: ProfessionContent) {
  const pageUrl = absoluteUrl(`/business-cards/for/${p.slug}`)

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Business Cards',
        item: absoluteUrl('/business-cards/for'),
      },
      { '@type': 'ListItem', position: 3, name: p.profession, item: pageUrl },
    ],
  }

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.h1,
    description: p.metaDescription,
    brand: { '@type': 'Brand', name: BRAND.name },
    category: 'Business Cards',
    url: pageUrl,
    // ⚠️ aggregateRating / review 필드 의도적으로 제외 (OMO-2383).
    offers: {
      '@type': 'Offer',
      priceCurrency: BRAND.currency,
      price: p.priceFrom,
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: BRAND.currency,
        price: p.priceFrom,
        valueAddedTaxIncluded: false,
      },
      availability: 'https://schema.org/InStock',
      url: pageUrl,
    },
  }

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  return [breadcrumb, product, faqPage]
}
