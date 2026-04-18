import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import { CheckCircle, Clock, Globe, Shield, Star } from 'lucide-react'

export const dynamic = 'force-dynamic'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { getShippingCost } from '@/lib/shipping'
import { fetchSwadpiaCategoryData } from '@/lib/swadpia'
import ProductConfigurator from '@/components/ProductConfigurator'
import type { PrintProduct, PrintProductOption } from '@/types/database'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_products')
    .select('name_en, description_ko')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: '상품 없음' }

  return {
    title: `${data.name_en} — Procardcrafters`,
    description: data.description_ko ?? undefined,
  }
}

const PRODUCT_EMOJI: Record<string, string> = {
  business_cards: '🪪',
  premium_business_cards: '💎',
  stickers: '⭐',
  die_cut_stickers: '✂️',
  flyers: '📄',
  brochures: '📖',
  postcards: '💌',
  posters: '🖼️',
  banners: '🏳️',
}

const PRODUCT_GRADIENT: Record<string, string> = {
  business_cards: 'from-blue-100 via-indigo-50 to-blue-50',
  premium_business_cards: 'from-indigo-100 via-slate-50 to-indigo-50',
  stickers: 'from-yellow-100 via-orange-50 to-yellow-50',
  die_cut_stickers: 'from-amber-100 via-yellow-50 to-amber-50',
  flyers: 'from-green-100 via-emerald-50 to-green-50',
  brochures: 'from-teal-100 via-cyan-50 to-teal-50',
  postcards: 'from-pink-100 via-rose-50 to-pink-50',
  posters: 'from-purple-100 via-violet-50 to-purple-50',
  banners: 'from-red-100 via-orange-50 to-red-50',
}

const PRODUCT_FEATURES: Record<string, string[]> = {
  business_cards: ['Premium 350gsm cardstock', 'Matte or gloss lamination', 'Standard & custom sizes', 'UV spot finishing available'],
  premium_business_cards: ['Linen 350gsm or Pearl 300gsm stock', 'Luxury texture and finish', 'Embossing & foil options', 'Premium uncoated feel'],
  stickers: ['Weatherproof vinyl material', 'Custom die-cut shapes', 'Outdoor durable (3+ years)', 'Removable or permanent adhesive'],
  die_cut_stickers: ['Custom shape cutting', 'Contour-cut to your design', 'Durable adhesive vinyl', 'Indoor & outdoor use'],
  flyers: ['100–170gsm coated paper', 'Single or double-sided', 'A4, A5, DL sizes', 'Full-bleed printing available'],
  brochures: ['Folded A4 or A5 formats', 'Tri-fold & saddle-stitch binding', 'Premium coated paper', 'Full-color both sides'],
  postcards: ['300gsm premium stock', 'Gloss or soft-touch finish', 'Perfect for direct mail', 'Standard & large formats'],
  posters: ['170gsm satin poster paper', 'Large format up to A0', 'Vivid color reproduction', 'Rolled or flat delivery'],
  banners: ['Mini banner 60×160cm or 80×200cm', 'Durable PVC material', 'Indoor & outdoor use', 'Retractable stand available'],
}

const TRUST_ITEMS = [
  { icon: Shield, text: 'Quality Guaranteed' },
  { icon: Clock, text: '3–5 Day Production' },
  { icon: Globe, text: 'FedEx Worldwide' },
  { icon: Star, text: '4.9★ Rating' },
]

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = createServerClient()

  const [{ data: productData }, exchangeRate, swadpiaData] = await Promise.all([
    supabase
      .from('print_products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single(),
    getKrwToUsdRate(),
    fetchSwadpiaCategoryData(slug),
  ])

  if (!productData) notFound()

  const product = productData as PrintProduct

  const { data: optionsData } = await supabase
    .from('print_product_options')
    .select('*')
    .eq('product_id', product.id)
    .order('option_type', { ascending: true })
    .order('sort_order', { ascending: true })

  const options = (optionsData as PrintProductOption[] | null) ?? []

  const shippingUsd = getShippingCost('US')
  const features = PRODUCT_FEATURES[product.category] ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상품 메인 섹션 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* 좌측: 상품 정보 */}
          <div>
            {/* 상품 비주얼 */}
            <div className={`h-80 bg-gradient-to-br ${PRODUCT_GRADIENT[product.category] ?? 'from-blue-50 to-indigo-100'} rounded-2xl flex items-center justify-center mb-6 border border-white shadow-sm`}>
              <span className="text-9xl drop-shadow-sm">
                {PRODUCT_EMOJI[product.category] ?? '📦'}
              </span>
            </div>

            {/* 상품 이름 */}
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{product.name_en}</h1>
            <p className="text-base text-gray-400 mb-4 font-medium">{product.name_ko}</p>

            {product.description_ko && (
              <p className="text-gray-600 leading-relaxed mb-6">{product.description_ko}</p>
            )}

            {/* 상품 특징 리스트 */}
            {features.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Product Specs</h3>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 파트너십 하이라이트 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="font-semibold text-blue-800 text-sm mb-1">LA Distribution</div>
                <div className="text-blue-600 text-xs leading-relaxed">Fast fulfillment from our Los Angeles distribution center</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="font-semibold text-green-800 text-sm mb-1">Global Delivery</div>
                <div className="text-green-600 text-xs leading-relaxed">FedEx International Priority — 40+ countries</div>
              </div>
            </div>
          </div>

          {/* 우측: 옵션 선택 + 가격 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Configure Your Order</h2>
            {options.length > 0 ? (
              <ProductConfigurator
                product={product}
                options={options}
                exchangeRate={exchangeRate}
                shippingUsd={shippingUsd}
                swadpiaData={swadpiaData.fetchSuccess ? {
                  papers: swadpiaData.papers,
                  printEntries: swadpiaData.printEntries,
                  sizes: swadpiaData.sizes,
                } : undefined}
              />
            ) : (
              <div className="text-gray-500 text-sm py-8 text-center">
                옵션 정보를 불러오는 중입니다...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 신뢰 배지 */}
      <div className="bg-white border-t border-gray-100 py-8 px-4 mt-6">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <item.icon className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
