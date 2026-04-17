import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { getShippingCost } from '@/lib/shipping'
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

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = createServerClient()

  const [{ data: productData }, exchangeRate] = await Promise.all([
    supabase
      .from('print_products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single(),
    getKrwToUsdRate(),
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

  // 기본 배송 국가 미국 기준
  const shippingUsd = getShippingCost('US')

  const PRODUCT_EMOJI: Record<string, string> = {
    business_cards: '🪪',
    stickers: '⭐',
    flyers: '📄',
    postcards: '💌',
    posters: '🖼️',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* 상품 이미지/정보 */}
        <div>
          <div className="h-72 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center text-8xl mb-6">
            {PRODUCT_EMOJI[product.category] ?? '📦'}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name_en}</h1>
          <p className="text-lg text-gray-500 mb-4">{product.name_ko}</p>
          {product.description_ko && (
            <p className="text-gray-600 leading-relaxed">{product.description_ko}</p>
          )}

          {/* 특징 요약 */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <div className="font-semibold text-blue-700 mb-1">한국 인쇄</div>
              <div className="text-blue-600">성원애드피아 파트너십</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-sm">
              <div className="font-semibold text-green-700 mb-1">전 세계 배송</div>
              <div className="text-green-600">FedEx / 기쿠리어</div>
            </div>
          </div>
        </div>

        {/* 옵션 선택 + 가격 계산 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">옵션 선택</h2>
          {options.length > 0 ? (
            <ProductConfigurator
              product={product}
              options={options}
              exchangeRate={exchangeRate}
              shippingUsd={shippingUsd}
            />
          ) : (
            <div className="text-gray-500 text-sm">
              이 상품은 현재 옵션 정보를 불러오는 중입니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
