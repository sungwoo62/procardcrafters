import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { getShippingCost } from '@/lib/shipping'
import { calculateItemPriceUsd } from '@/lib/pricing'
import OrderForm from './OrderForm'
import type { PrintProduct, PrintProductOption } from '@/types/database'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

async function OrderPageContent({ searchParams }: PageProps) {
  const params = await searchParams
  const productSlug = params.product

  if (!productSlug) notFound()

  const supabase = createServerClient()

  const [{ data: productData }, exchangeRate] = await Promise.all([
    supabase
      .from('print_products')
      .select('*')
      .eq('slug', productSlug)
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
    .order('sort_order', { ascending: true })

  const options = (optionsData as PrintProductOption[] | null) ?? []

  // Restore selected options from URL parameters
  const selectedOptions: Record<string, string> = {}
  for (const opt of options) {
    if (params[opt.option_type]) {
      selectedOptions[opt.option_type] = params[opt.option_type]
    }
  }
  // OMO-3196: 후가공은 DB option_type 행이 아니라 카탈로그 기반 선택이므로 위 루프가
  // 잡지 못한다. `finishing`(콤마구분 value) 을 그대로 전달해 자동발주 파이프라인
  // (expandFinishingToSwadpiaFields) 이 성원 폼 필드로 확장하도록 한다.
  if (params.finishing) {
    selectedOptions.finishing = params.finishing
  }

  const extraPricesKrw = options
    .filter((o) => selectedOptions[o.option_type] === o.value)
    .map((o) => o.extra_price_krw)

  const itemPriceUsd = calculateItemPriceUsd({
    basePriceKrw: product.base_price_krw,
    marginMultiplier: product.margin_multiplier,
    extraPricesKrw,
    exchangeRate,
  })

  const shippingUsd = getShippingCost('US')

  return (
    <OrderForm
      product={product}
      selectedOptions={selectedOptions}
      itemPriceUsd={itemPriceUsd}
      shippingUsd={shippingUsd}
      exchangeRate={exchangeRate}
      preloadedFileId={params.fileId ?? null}
    />
  )
}

export default function OrderPage(props: PageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading...</div>}>
        <OrderPageContent {...props} />
      </Suspense>
    </div>
  )
}
