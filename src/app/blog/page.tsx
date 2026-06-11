import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getCategories, getPublishedPosts } from '@/lib/blog'
import JsonLd from '@/components/JsonLd'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

export const metadata: Metadata = {
  title: 'Printing Blog — Guides, Tips & Inspiration',
  description:
    'Expert guides on custom printing — business cards, stickers, flyers, paper stocks, finishes, and design tips to make your print projects stand out.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    title: 'Printing Blog — Procardcrafters',
    description: 'Expert guides on custom printing, paper stocks, finishes, and design.',
    url: `${SITE_URL}/blog`,
    siteName: 'Procardcrafters',
  },
}

function PostCard({ post, href }: { post: { title: string; excerpt: string | null; cover_image_url: string | null; published_at: string | null; tags: string[] }; href: string }) {
  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-lg">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
        {post.cover_image_url ? (
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-4xl">📝</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="mb-2 text-lg font-bold text-gray-900 group-hover:text-blue-600">{post.title}</h3>
        {post.excerpt ? <p className="mb-3 line-clamp-2 flex-1 text-sm text-gray-600">{post.excerpt}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-gray-400">
          {post.published_at ? <time>{new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time> : null}
          {post.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">#{t}</span>
          ))}
        </div>
      </div>
    </Link>
  )
}

export default async function BlogIndexPage() {
  const [categories, posts] = await Promise.all([getCategories(), getPublishedPosts(30)])
  const catBySlugMap = new Map(categories.map((c) => [c.id, c.slug]))

  const blogJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Procardcrafters Printing Blog',
    url: `${SITE_URL}/blog`,
    description: 'Expert guides on custom printing, paper stocks, finishes, and design.',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <JsonLd data={blogJsonLd} />

      <section className="bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 px-4 py-20 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">Procardcrafters Blog</p>
        <h1 className="mb-4 text-4xl font-bold leading-tight text-white sm:text-5xl">Printing Guides &amp; Inspiration</h1>
        <p className="mx-auto max-w-xl text-lg text-gray-400">
          Tips on stocks, finishes, and design to make every print project look its best.
        </p>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {categories.length > 0 && (
          <nav className="mb-10 flex flex-wrap justify-center gap-3">
            {categories.map((c) => (
              <Link key={c.id} href={`/blog/${c.slug}`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-400 hover:text-blue-600">
                {c.name}
              </Link>
            ))}
          </nav>
        )}

        {posts.length === 0 ? (
          <p className="py-20 text-center text-gray-500">아직 발행된 글이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => {
              const catSlug = p.category_id ? catBySlugMap.get(p.category_id) : undefined
              const href = catSlug ? `/blog/${catSlug}/${p.slug}` : `/blog/${p.slug}`
              return <PostCard key={p.id} post={p} href={href} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}
