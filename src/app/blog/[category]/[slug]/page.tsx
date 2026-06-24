import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getPostBySlug, getCategoryBySlug, getRelatedPosts, getCategories } from '@/lib/blog'
import BlogMarkdown from '@/components/BlogMarkdown'
import JsonLd from '@/components/JsonLd'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

interface Props {
  params: Promise<{ category: string; slug: string }>
}

// 글의 canonical 카테고리 슬러그 — category_id 매핑. 없으면 'general'.
async function resolveCategorySlug(categoryId: string | null): Promise<string> {
  if (!categoryId) return 'general'
  const cats = await getCategories()
  return cats.find((c) => c.id === categoryId)?.slug ?? 'general'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: 'Article Not Found' }

  const catSlug = await resolveCategorySlug(post.category_id)
  const canonical = `${SITE_URL}/blog/${catSlug}/${post.slug}`
  const title = post.seo_title ?? `${post.title} | Procardcrafters Blog`
  const description = post.seo_description ?? post.excerpt ?? `${post.title} — printing tips and guides from Procardcrafters.`
  const ogImage = post.og_image_url ?? post.cover_image_url ?? undefined

  return {
    title,
    description,
    keywords: post.tags,
    // OMO-3810/OMO-3813: 블로그 DB 콘텐츠 영문화 완료 전까지 검색 비노출(런칭 게이트). 영문화 후 해제.
    robots: { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      siteName: 'Procardcrafters',
      images: ogImage ? [{ url: ogImage, alt: post.title }] : undefined,
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
      ...(post.updated_at ? { modifiedTime: post.updated_at } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function BlogArticlePage({ params }: Props) {
  const { category, slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const catSlug = await resolveCategorySlug(post.category_id)
  // URL 의 카테고리가 글의 실제 카테고리와 다르면 canonical 경로로 308 영구 리다이렉트 — 중복 인덱싱 방지.
  if (category !== catSlug) permanentRedirect(`/blog/${catSlug}/${post.slug}`)

  const cat = post.category_id ? await getCategoryBySlug(catSlug) : null
  const related = await getRelatedPosts(post, 3)
  const canonical = `${SITE_URL}/blog/${catSlug}/${post.slug}`
  const ogImage = post.og_image_url ?? post.cover_image_url ?? undefined

  const articleJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seo_description ?? post.excerpt ?? undefined,
    ...(ogImage ? { image: [ogImage] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    ...(post.updated_at ? { dateModified: post.updated_at } : {}),
    author: { '@type': 'Organization', name: 'Procardcrafters' },
    publisher: { '@type': 'Organization', name: 'Procardcrafters' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    ...(post.tags.length > 0 ? { keywords: post.tags.join(', ') } : {}),
  }

  const breadcrumbJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: cat?.name ?? 'Articles', item: `${SITE_URL}/blog/${catSlug}` },
      { '@type': 'ListItem', position: 4, name: post.title, item: canonical },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[articleJsonLd, breadcrumbJsonLd]} />

      <article className="mx-auto max-w-3xl px-4 py-12">
        {/* 빵부스러기 */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link href="/blog" className="hover:text-blue-600">Blog</Link>
          <span className="mx-2">/</span>
          <Link href={`/blog/${catSlug}`} className="hover:text-blue-600">{cat?.name ?? 'Articles'}</Link>
        </nav>

        <header className="mb-8">
          <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            {post.published_at ? (
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            ) : null}
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">#{t}</span>
            ))}
          </div>
        </header>

        {post.cover_image_url ? (
          <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-100">
            <Image src={post.cover_image_url} alt={post.title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" priority />
          </div>
        ) : null}

        <BlogMarkdown body={post.body_md} images={post.body_images} />

        {/* 관련글 내부링크 */}
        {related.length > 0 && (
          <aside className="mt-16 border-t border-gray-200 pt-10">
            <h2 className="mb-6 text-xl font-bold text-gray-900">Related Articles</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link key={r.id} href={`/blog/${catSlug}/${r.slug}`} className="group rounded-xl border border-gray-200 p-4 transition hover:border-blue-300 hover:shadow-sm">
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 group-hover:text-blue-600">{r.title}</h3>
                  {r.excerpt ? <p className="line-clamp-2 text-xs text-gray-500">{r.excerpt}</p> : null}
                </Link>
              ))}
            </div>
          </aside>
        )}

        <div className="mt-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 text-center">
          <p className="mb-3 text-gray-700">Ready to bring your design to life?</p>
          <Link href="/products" className="inline-block rounded-full bg-blue-600 px-6 py-2.5 font-semibold text-white transition hover:bg-blue-700">
            Browse Products
          </Link>
        </div>
      </article>
    </div>
  )
}
