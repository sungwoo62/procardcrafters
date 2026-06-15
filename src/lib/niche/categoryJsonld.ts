// 제품군별 니치 페이지 구조화 데이터(OMO-3213) — 직업 니치 jsonld.ts 의 일반화.
// BreadcrumbList + Product/Offer + FAQPage.
// ⚠️ AggregateRating/review 절대 금지 — 신뢰 게이트(OMO-2383) 미통과.

import { BRAND, absoluteUrl } from '@/lib/site'
import type { NicheCategory, NicheEntry } from '@/lib/niche/categories'

export function buildCategoryNicheJsonLd(category: NicheCategory, entry: NicheEntry) {
  const pageUrl = absoluteUrl(`/${category.slug}/for/${entry.slug}`)

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: category.label,
        item: absoluteUrl(`/${category.slug}/for`),
      },
      { '@type': 'ListItem', position: 3, name: entry.audience, item: pageUrl },
    ],
  }

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: entry.h1,
    description: entry.metaDescription,
    brand: { '@type': 'Brand', name: BRAND.name },
    category: category.schemaCategory,
    url: pageUrl,
    // ⚠️ aggregateRating / review 의도적 제외 (OMO-2383).
    offers: {
      '@type': 'Offer',
      priceCurrency: BRAND.currency,
      price: entry.priceFrom,
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: BRAND.currency,
        price: entry.priceFrom,
        valueAddedTaxIncluded: false,
      },
      availability: 'https://schema.org/InStock',
      url: pageUrl,
    },
  }

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entry.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  return [breadcrumb, product, faqPage]
}
