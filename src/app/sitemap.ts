import type { MetadataRoute } from 'next'
import { getNicheGroups, getNicheByGroup } from '@/lib/niche/content'

// `||`: 빈 문자열 env 도 canonical 도메인으로 폴백 (`??` 는 ""를 통과시켜 상대경로/교차도메인 sitemap 유발).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

// DB fetch 실패 시 최소한의 핵심 제품은 항상 sitemap 에 남도록 폴백.
const FALLBACK_PRODUCT_SLUGS = ['business-cards', 'stickers', 'flyers', 'postcards', 'posters', 'brochures']

interface ProductRow {
  slug: string
  updated_at: string | null
}

// 활성 제품 슬러그를 DB 에서 직접 조회 (layout.tsx 의 REST 패턴 재사용).
// 88개 활성 제품 전체가 sitemap 에 포함되도록 하드코딩 목록을 대체한다.
async function fetchActiveProducts(): Promise<ProductRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return FALLBACK_PRODUCT_SLUGS.map((slug) => ({ slug, updated_at: null }))
  try {
    const res = await fetch(
      `${url}/rest/v1/print_products?select=slug,updated_at&is_active=eq.true&order=sort_order`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // 하루 단위로 재생성 — 신제품/비활성 변경 반영하되 매 요청 DB 부하 방지.
        next: { revalidate: 86400 },
      },
    )
    if (!res.ok) throw new Error(`sitemap fetch ${res.status}`)
    const data = (await res.json()) as ProductRow[]
    if (!Array.isArray(data) || data.length === 0) {
      return FALLBACK_PRODUCT_SLUGS.map((slug) => ({ slug, updated_at: null }))
    }
    return data
  } catch {
    return FALLBACK_PRODUCT_SLUGS.map((slug) => ({ slug, updated_at: null }))
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const products = await fetchActiveProducts()

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1.0, lastModified: now },
    { url: `${SITE_URL}/products`, changeFrequency: 'daily', priority: 0.9, lastModified: now },
    { url: `${SITE_URL}/promotions`, changeFrequency: 'weekly', priority: 0.7, lastModified: now },
    { url: `${SITE_URL}/portfolio`, changeFrequency: 'weekly', priority: 0.6, lastModified: now },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: `${SITE_URL}/faq`, changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4, lastModified: now },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: `${SITE_URL}/refund`, changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: `${SITE_URL}/shipping`, changeFrequency: 'yearly', priority: 0.3, lastModified: now },
  ]

  // 제품 상세 — 핵심 랭킹 타깃. updated_at 을 lastModified 로 노출해 크롤 신선도 신호 제공.
  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // 템플릿 랜딩 — "free business card templates" 류 롱테일 키워드 타깃.
  const templatePages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/templates/${p.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  // 니치 랜딩(OMO-3215 일반화) — 전 제품군 루프. 그룹별 SEED + print_niche_pages DB row 자동 포함(drift 0).
  // 콘텐츠가 1개 이상인 그룹만 hub/item 을 노출(빈 그룹 thin-page 회피).
  const nicheByGroup = await Promise.all(
    getNicheGroups().map(async (g) => ({ group: g.group, items: await getNicheByGroup(g.group) })),
  )
  const nichePages: MetadataRoute.Sitemap = nicheByGroup
    .filter((g) => g.items.length > 0)
    .flatMap((g) => [
      { url: `${SITE_URL}/${g.group}/for`, changeFrequency: 'weekly' as const, priority: 0.7, lastModified: now },
      ...g.items.map((c) => ({
        url: `${SITE_URL}/${g.group}/for/${c.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ])

  return [...staticPages, ...productPages, ...templatePages, ...nichePages]
}
