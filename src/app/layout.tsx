import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
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
  description: 'High-quality business cards, stickers, flyers, postcards, and posters distributed from Los Angeles and delivered worldwide.',
  keywords: ['business cards', 'stickers', 'flyers', 'postcards', 'posters', 'print on demand'],
  openGraph: {
    type: 'website',
    siteName: 'Procardcrafters',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — distributed from LA and delivered worldwide.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — distributed from LA and delivered worldwide.',
  },
  robots: { index: true, follow: true },
}

async function fetchProductImages(): Promise<Record<string, string>> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('print_products')
      .select('slug, hero_image_url')
      .eq('is_active', true)
      .not('hero_image_url', 'is', null)
    if (!data) return {}
    return Object.fromEntries(
      data.filter(r => r.hero_image_url).map(r => [r.slug, r.hero_image_url as string])
    )
  } catch {
    return {}
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const productImages = await fetchProductImages()
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">
        <Header productImages={productImages} />
        <main className="flex-1">{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  )
}
