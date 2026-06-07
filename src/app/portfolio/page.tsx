import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import PortfolioGallery from './PortfolioGallery'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sample Designs — Print Style Gallery',
  description: 'Browse sample designs showcasing our print styles, stocks, and finishes — business cards, stickers, flyers, postcards, and posters.',
  openGraph: {
    title: 'Sample Designs — Procardcrafters',
    description: 'Browse sample designs showcasing our print styles and finishes.',
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
    console.error('Portfolio load error:', error)
    return []
  }
  return data ?? []
}

export default async function PortfolioPage() {
  const items = await getPortfolioItems()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 py-20 px-4 text-center">
        <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-4">Design Samples</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
          Sample Designs &amp; Finishes
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Browse {items.length}+ sample designs showcasing the print styles, stocks, and finishes we offer.
        </p>
      </section>

      {/* Gallery (client component — filter + lightbox) */}
      <PortfolioGallery items={items} />
    </div>
  )
}
