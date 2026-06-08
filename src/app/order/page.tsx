import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { getShippingCost } from '@/lib/shipping'
import { calculateItemPriceUsd } from '@/lib/pricing'
import { FINISHING_PASSTHROUGH_KEYS, finishingSurchargeKrwFromOptions } from '@/config/finishing-surcharge'
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

  // OMO-2667: 후가공 직렬화 키(finishing + 박/형압 면적)는 option_type 화이트리스트에 없어
  // 위 루프가 드롭한다. 별도 패스스루로 selected_options 에 보존 → 결제 surcharge 재계산 및
  // 자동발주(expandFinishingToSwadpiaFields) 면적단가에 반영.
  for (const key of FINISHING_PASSTHROUGH_KEYS) {
    if (params[key]) selectedOptions[key] = params[key]
  }

  const extraPricesKrw = options
    .filter((o) => selectedOptions[o.option_type] === o.value)
    .map((o) => o.extra_price_krw)

  // OMO-2667: 후가공 surcharge 를 서버 권위로 재계산해 합산(다중·면적 반영). 구성기 표시가와 일치.
  const finishingSurchargeKrw = finishingSurchargeKrwFromOptions(selectedOptions)

  const itemPriceUsd = calculateItemPriceUsd({
    basePriceKrw: product.base_price_krw,
    marginMultiplier: product.margin_multiplier,
    extraPricesKrw: finishingSurchargeKrw > 0 ? [...extraPricesKrw, finishingSurchargeKrw] : extraPricesKrw,
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
