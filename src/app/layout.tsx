import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
import FreeShippingBanner from '@/components/FreeShippingBanner'
import { createServerClient } from '@/lib/supabase'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Procardcrafters — Premium Print On Demand',
    template: '%s | Procardcrafters',
  },
  description: 'High-quality business cards, stickers, flyers, postcards, and posters — produced through our global production network and delivered worldwide with FedEx.',
  keywords: ['business cards', 'stickers', 'flyers', 'postcards', 'posters', 'print on demand'],
  openGraph: {
    type: 'website',
    siteName: 'Procardcrafters',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — global production, delivered worldwide with FedEx.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — global production, delivered worldwide with FedEx.',
  },
  robots: { index: true, follow: true },
}

export interface ProductCardData {
  image: string | null
  description: string | null
}

async function fetchProductCardData(): Promise<Record<string, ProductCardData>> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('print_products')
      .select('slug, hero_image_url, description_en')
      .eq('is_active', true)
    if (!data) return {}
    return Object.fromEntries(
      data.map(r => [r.slug, { image: r.hero_image_url ?? null, description: r.description_en ?? null }])
    )
  } catch {
    return {}
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const productData = await fetchProductCardData()
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">
        <FreeShippingBanner />
        <Header productData={productData} />
        <main className="flex-1">{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  )
}
