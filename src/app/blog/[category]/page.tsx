import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug, getPostsByCategory } from '@/lib/blog'
import { BLOG_PUBLIC } from '@/lib/blog-gate'
import JsonLd from '@/components/JsonLd'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

interface Props {
  params: Promise<{ category: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // OMO-3813: 게이트 닫힘 시 한글 카테고리명이 <title>/메타에 노출되지 않도록 영문 NotFound 메타 반환.
  if (!BLOG_PUBLIC) return { title: 'Not Found', robots: { index: false, follow: false } }
  const { category } = await params
  const cat = await getCategoryBySlug(category)
  if (!cat) return { title: 'Category Not Found' }
  const canonical = `${SITE_URL}/blog/${cat.slug}`
  const title = `${cat.name} — Printing Blog | Procardcrafters`
  const description = cat.description ?? `Articles and guides about ${cat.name.toLowerCase()} from the Procardcrafters printing blog.`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical, siteName: 'Procardcrafters' },
  }
}

export default async function BlogCategoryPage({ params }: Props) {
  // OMO-3813: 한글 블로그 콘텐츠는 영문화·승인 전까지 비공개(404).
  if (!BLOG_PUBLIC) notFound()
  const { category } = await params
  const cat = await getCategoryBySlug(category)
  if (!cat) notFound()

  const posts = await getPostsByCategory(cat.id)
  const canonical = `${SITE_URL}/blog/${cat.slug}`

  const breadcrumbJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: cat.name, item: canonical },
    ],
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <JsonLd data={breadcrumbJsonLd} />

      <section className="bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 px-4 py-16 text-center">
        <nav className="mb-4 text-sm text-gray-400">
          <Link href="/blog" className="hover:text-white">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">{cat.name}</span>
        </nav>
        <h1 className="mb-3 text-4xl font-bold text-white">{cat.name}</h1>
        {cat.description ? <p className="mx-auto max-w-xl text-gray-400">{cat.description}</p> : null}
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {posts.length === 0 ? (
          <p className="py-20 text-center text-gray-500">No posts in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${cat.slug}/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-lg"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                  {p.cover_image_url ? (
                    <Image src={p.cover_image_url} alt={p.title} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-4xl">📝</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="mb-2 text-lg font-bold text-gray-900 group-hover:text-blue-600">{p.title}</h3>
                  {p.excerpt ? <p className="line-clamp-2 text-sm text-gray-600">{p.excerpt}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
