import type { MetadataRoute } from 'next'

// `||`: 빈 문자열 env 도 canonical 도메인으로 폴백 (OMO-2561 — `??` 는 ""를 통과시켜 잘못된 sitemap 경로 유발).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
