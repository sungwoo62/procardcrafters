import { createServerClient } from '@/lib/supabase'
import type { BlogImageMeta } from '@/components/BlogMarkdown'

// 블로그 데이터 액세스 — 서버 전용. createServerClient(service_role) 사용하되
// RLS 와 무관하게 항상 is_published=true 필터를 명시해 미발행 글 노출 방지.

export interface BlogCategory {
  id: string
  slug: string
  name: string
  description: string | null
  sort_order: number
}

export interface BlogPostSummary {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  tags: string[]
  published_at: string | null
  category_id: string | null
}

export interface BlogPost extends BlogPostSummary {
  body_md: string
  body_images: BlogImageMeta[]
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  updated_at: string | null
}

const SUMMARY_COLS = 'id, slug, title, excerpt, cover_image_url, tags, published_at, category_id'
const FULL_COLS = `${SUMMARY_COLS}, body_md, body_images, seo_title, seo_description, og_image_url, updated_at`

export async function getCategories(): Promise<BlogCategory[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_blog_categories')
    .select('id, slug, name, description, sort_order')
    .order('sort_order', { ascending: true })
  if (error) return []
  return data ?? []
}

export async function getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_blog_categories')
    .select('id, slug, name, description, sort_order')
    .eq('slug', slug)
    .maybeSingle()
  return data ?? null
}

export async function getPublishedPosts(limit?: number): Promise<BlogPostSummary[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('print_blog_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) return []
  return data ?? []
}

export async function getPostsByCategory(categoryId: string): Promise<BlogPostSummary[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_blog_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .eq('category_id', categoryId)
    .order('published_at', { ascending: false, nullsFirst: false })
  if (error) return []
  return data ?? []
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_blog_posts')
    .select(FULL_COLS)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  if (!data) return null
  return {
    ...data,
    body_images: Array.isArray(data.body_images) ? (data.body_images as BlogImageMeta[]) : [],
    tags: data.tags ?? [],
  } as BlogPost
}

// 관련글 — 같은 카테고리 우선, 부족하면 최신글로 보충. 현재 글 제외.
export async function getRelatedPosts(post: BlogPost, limit = 3): Promise<BlogPostSummary[]> {
  const supabase = createServerClient()
  const out: BlogPostSummary[] = []
  if (post.category_id) {
    const { data } = await supabase
      .from('print_blog_posts')
      .select(SUMMARY_COLS)
      .eq('is_published', true)
      .eq('category_id', post.category_id)
      .neq('id', post.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (data) out.push(...data)
  }
  if (out.length < limit) {
    const { data } = await supabase
      .from('print_blog_posts')
      .select(SUMMARY_COLS)
      .eq('is_published', true)
      .neq('id', post.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit + 1)
    if (data) {
      for (const p of data) {
        if (out.length >= limit) break
        if (!out.some((o) => o.id === p.id)) out.push(p)
      }
    }
  }
  return out.slice(0, limit)
}
