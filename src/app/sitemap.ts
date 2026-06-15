import type { MetadataRoute } from 'next'
import { getAllProfessions } from '@/lib/niche/professions'
import { NICHE_CATEGORIES } from '@/lib/niche/categories'

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

  // 직업별 니치 랜딩(OMO-2971) — SEED + print_niche_pages DB row 자동 포함(drift 0).
  const professions = await getAllProfessions()
  const nichePages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/business-cards/for`, changeFrequency: 'weekly', priority: 0.7, lastModified: now },
    ...professions.map((p) => ({
      url: `${SITE_URL}/business-cards/for/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]

  // 제품군별 니치 랜딩(OMO-3213) — stickers/flyers/posters 허브 + 스포크. 카테고리 레지스트리 단일 소스.
  const categoryNichePages: MetadataRoute.Sitemap = NICHE_CATEGORIES.flatMap((c) => [
    {
      url: `${SITE_URL}/${c.slug}/for`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    ...c.entries.map((e) => ({
      url: `${SITE_URL}/${c.slug}/for/${e.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ])

  return [...staticPages, ...productPages, ...templatePages, ...nichePages, ...categoryNichePages]
}
