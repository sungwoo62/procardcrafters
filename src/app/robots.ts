import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'

// AI 검색/인덱싱 봇 명시 허용(OMO-4026 AEO): 와일드카드로도 허용되지만,
// ChatGPT·Perplexity·Claude·Google AI Overview 가 크롤을 명시적으로 인정하도록 별도 룰을 둔다.
const AI_CRAWLERS = [
  'GPTBot',          // OpenAI 인덱싱
  'OAI-SearchBot',   // ChatGPT search
  'ChatGPT-User',    // ChatGPT 실시간 fetch
  'PerplexityBot',   // Perplexity 인덱싱
  'Perplexity-User', // Perplexity 실시간 fetch
  'ClaudeBot',       // Anthropic 인덱싱
  'Claude-User',     // Claude 실시간 fetch
  'Google-Extended', // Google AI Overview / Gemini grounding
  'Applebot-Extended',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
      // AI 봇은 관리/내부 API 제외 전 페이지 허용(인용 자산 노출 극대화).
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
