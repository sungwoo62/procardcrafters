import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'

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
  description: 'High-quality business cards, stickers, flyers, postcards, and posters printed in Korea and delivered worldwide.',
  keywords: ['business cards', 'stickers', 'flyers', 'postcards', 'posters', 'print on demand', 'Korean printing'],
  openGraph: {
    type: 'website',
    siteName: 'Procardcrafters',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — printed with Korean precision and delivered worldwide.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — printed with Korean precision and delivered worldwide.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  )
}
