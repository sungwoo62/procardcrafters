import type { MetadataRoute } from 'next'

// `||`: 빈 문자열 env 도 canonical 도메인으로 폴백 (OMO-2561 — `??` 는 ""를 통과시켜 상대경로/교차도메인 sitemap 유발).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

const PRODUCT_SLUGS = ['business-cards', 'stickers', 'flyers', 'postcards', 'posters']

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: SITE_URL, priority: 1.0 },
    { url: `${SITE_URL}/products`, priority: 0.9 },
    { url: `${SITE_URL}/about`, priority: 0.6 },
    { url: `${SITE_URL}/faq`, priority: 0.6 },
    { url: `${SITE_URL}/contact`, priority: 0.5 },
  ]

  const productPages = PRODUCT_SLUGS.map((slug) => ({
    url: `${SITE_URL}/products/${slug}`,
    priority: 0.8,
  }))

  return [...staticPages, ...productPages].map((p) => ({
    url: p.url,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: p.priority,
  }))
}
