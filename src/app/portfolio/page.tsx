import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import PortfolioGallery from './PortfolioGallery'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Portfolio — Print Work Gallery',
  description: 'Browse our portfolio of premium print work — business cards, stickers, flyers, postcards, and posters printed with precision.',
  openGraph: {
    title: 'Portfolio — Procardcrafters',
    description: 'Browse our portfolio of premium print work.',
  },
}

export interface PortfolioItem {
  id: string
  title: string
  description: string | null
  category: string
  image_url: string
  thumbnail_url: string | null
  tags: string[]
  is_featured: boolean
}

async function getPortfolioItems(): Promise<PortfolioItem[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_portfolio')
    .select('id, title, description, category, image_url, thumbnail_url, tags, is_featured')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('포트폴리오 로드 오류:', error)
    return []
  }
  return data ?? []
}

export default async function PortfolioPage() {
  const items = await getPortfolioItems()

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <section className="bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 py-20 px-4 text-center">
        <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-4">Our Work</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
          Print Portfolio
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Real projects, real quality. Browse {items.length}+ samples of premium print work delivered worldwide.
        </p>
      </section>

      {/* 갤러리 (클라이언트 컴포넌트 — 필터 + 라이트박스) */}
      <PortfolioGallery items={items} />
    </div>
  )
}
