import type { MetadataRoute } from 'next'

// `||`: 빈 문자열 env 도 canonical 도메인으로 폴백 (`??` 는 ""를 통과시켜 상대경로/교차도메인 sitemap 유발).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

// DB fetch 실패 시 최소한의 핵심 제품은 항상 sitemap 에 남도록 폴백.
const FALLBACK_PRODUCT_SLUGS = ['business-cards', 'stickers', 'flyers', 'postcards', 'posters', 'brochures']

interface ProductRow {
  slug: string
  updated_at: string | null
}

interface BlogCategoryRow {
  id: string
  slug: string
}

interface BlogPostRow {
  slug: string
  category_id: string | null
  updated_at: string | null
}

// 발행 블로그 글 + 카테고리 조회 — sitemap 의 /blog/[category]/[slug] canonical URL 구성용.
async function fetchBlogData(): Promise<{ categories: BlogCategoryRow[]; posts: BlogPostRow[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { categories: [], posts: [] }
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const [catRes, postRes] = await Promise.all([
      fetch(`${url}/rest/v1/print_blog_categories?select=id,slug`, { headers, next: { revalidate: 86400 } }),
      fetch(`${url}/rest/v1/print_blog_posts?select=slug,category_id,updated_at&is_published=eq.true`, {
        headers,
        next: { revalidate: 86400 },
      }),
    ])
    const categories = catRes.ok ? ((await catRes.json()) as BlogCategoryRow[]) : []
    const posts = postRes.ok ? ((await postRes.json()) as BlogPostRow[]) : []
    return {
      categories: Array.isArray(categories) ? categories : [],
      posts: Array.isArray(posts) ? posts : [],
    }
  } catch {
    return { categories: [], posts: [] }
  }
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
  const [products, blog] = await Promise.all([fetchActiveProducts(), fetchBlogData()])

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1.0, lastModified: now },
    { url: `${SITE_URL}/products`, changeFrequency: 'daily', priority: 0.9, lastModified: now },
    { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.7, lastModified: now },
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

  // 블로그 — 카테고리 아카이브 + 글 본문. 글 URL 은 canonical /blog/[category]/[slug] 형태.
  const catSlugById = new Map(blog.categories.map((c) => [c.id, c.slug]))
  const blogCategoryPages: MetadataRoute.Sitemap = blog.categories.map((c) => ({
    url: `${SITE_URL}/blog/${c.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))
  const blogPostPages: MetadataRoute.Sitemap = blog.posts.map((p) => {
    const catSlug = p.category_id ? catSlugById.get(p.category_id) ?? 'general' : 'general'
    return {
      url: `${SITE_URL}/blog/${catSlug}/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }
  })

  return [...staticPages, ...productPages, ...templatePages, ...blogCategoryPages, ...blogPostPages]
}
