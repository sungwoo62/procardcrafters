import type { MetadataRoute } from 'next'
import { BLOG_PUBLIC } from '@/lib/blog-gate'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'

export default function robots(): MetadataRoute.Robots {
  // OMO-3813: 블로그 게이트가 닫혀 있으면 크롤러에 /blog 차단(한글 콘텐츠 인덱싱 방지).
  const disallow = ['/admin/', '/api/']
  if (!BLOG_PUBLIC) disallow.push('/blog')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
