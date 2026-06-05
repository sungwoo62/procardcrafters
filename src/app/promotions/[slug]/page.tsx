import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Tag, Package } from 'lucide-react'
import { getCampaignBySlug } from '@/lib/promotion-engine'
import CampaignHero from '@/components/CampaignHero'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ promo?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const campaign = await getCampaignBySlug(slug).catch(() => null)

  if (!campaign) return { title: 'Promotion Not Found' }

  const headline = campaign.headline_en ?? campaign.calendar.name_en
  const cutoffLabel = campaign.order_cutoff_at
    ? new Date(campaign.order_cutoff_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null
  const codeHint = campaign.promoCode ? ` Use code ${campaign.promoCode.code} at checkout.` : ''
  const cutoffHint = cutoffLabel ? ` Order by ${cutoffLabel}.` : ''
  const description = `Save on ${campaign.calendar.name_en} print products at Procardcrafters.${codeHint}${cutoffHint}`

  return {
    title: `${headline} — Procardcrafters`,
    description,
    openGraph: {
      title: `${headline} — Procardcrafters`,
      description,
      url: `${SITE_URL}/promotions/${slug}`,
      images: campaign.hero_image_url ? [{ url: campaign.hero_image_url }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${headline} — Procardcrafters`,
      description,
    },
  }
}

export default async function PromotionPage({ params, searchParams }: Props) {
  const [{ slug }, { promo: urlPromo }] = await Promise.all([params, searchParams])
  const campaign = await getCampaignBySlug(slug).catch(() => null)

  if (!campaign) notFound()

  const promoCode = campaign.promoCode?.code ?? urlPromo ?? null

  return (
    <>
      <CampaignHero
        campaignKey={campaign.calendar.key}
        campaignSlug={slug}
        headlineEn={campaign.headline_en ?? campaign.calendar.name_en}
        heroImageUrl={campaign.hero_image_url ?? null}
        promoCode={promoCode}
        cutoffAt={campaign.order_cutoff_at ?? null}
      />

      {/* 캠페인 대상 상품 그리드 */}
      {campaign.productDetails.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">
              <Tag className="w-4 h-4" /> Sale Products
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Products in This Sale</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              {promoCode
                ? `Enter code ${promoCode} at checkout to save.`
                : 'Discounted during this promotion period.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {campaign.productDetails.map(product => {
              const href = `/products/${product.slug}${promoCode ? `?promo=${encodeURIComponent(promoCode)}` : ''}`
              return (
                <Link
                  key={product.slug}
                  href={href}
                  className="group relative border border-gray-200 rounded-2xl overflow-hidden bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="h-40 bg-gray-100 relative overflow-hidden">
                    {product.hero_image_url ? (
                      <Image
                        src={product.hero_image_url}
                        alt={product.name_en}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                        <Package className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-base mb-1">
                      {product.name_en}
                    </h3>
                    {product.description_en && (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {product.description_en}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-1 text-sm text-blue-600 font-semibold">
                      Order <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* 코드 사용법 */}
      {promoCode && (
        <section className="bg-blue-50 border-y border-blue-100 py-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">How to Use Your Code</h2>
            <ol className="space-y-4 text-left max-w-sm mx-auto">
              {[
                'Choose a product from the sale list above',
                'Configure size, quantity, and finish options',
                `Enter code ${promoCode} at checkout`,
                'Discount applies automatically to eligible items',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Link
              href="/products"
              className="mt-10 inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-gray-400 hover:bg-white transition-all text-sm"
            >
              Browse All Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* 상품 없는 캠페인: All Products CTA */}
      {campaign.productDetails.length === 0 && (
        <section className="py-20 px-4 text-center">
          <div className="max-w-xl mx-auto">
            <p className="text-gray-500 text-lg mb-6">
              Browse our full catalog and apply your promo code at checkout.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-base shadow-lg shadow-blue-200"
            >
              Browse Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}
    </>
  )
}
