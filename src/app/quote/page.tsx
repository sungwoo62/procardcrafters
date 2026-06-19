// OMO-3159: 비회원 견적서 페이지 (/quote).
// 제품/옵션 선택 → 라이브 가격 → 팬톤 테마 견적서 PDF 다운로드. 로그인 불필요.

import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import { isPccfSlug } from '@/config/pccf-catalog'
import type { PrintProduct, PrintProductOption } from '@/types/database'
import QuoteBuilder, { type QuoteProduct } from '@/components/QuoteBuilder'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

export const metadata: Metadata = {
  title: 'Instant Quote | Procardcrafters',
  description:
    'Build an instant price estimate for custom printing and download a professional PDF quotation. No sign-up required.',
  alternates: { canonical: `${SITE_URL}/quote` },
}

export default async function QuotePage() {
  const supabase = createServerClient()

  const { data: productsData } = await supabase
    .from('print_products')
    .select('id, slug, name_en, category, min_order_quantity, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const activeProducts = ((productsData as Pick<
    PrintProduct,
    'id' | 'slug' | 'name_en' | 'category' | 'min_order_quantity'
  >[] | null) ?? []).filter((p) => isPccfSlug(p.slug))

  // 옵션 일괄 조회 후 제품별 그룹.
  const ids = activeProducts.map((p) => p.id)
  const { data: optionsData } = ids.length
    ? await supabase
        .from('print_product_options')
        .select('product_id, option_type, label_en, value, is_default, sort_order')
        .in('product_id', ids)
        .order('option_type', { ascending: true })
        .order('sort_order', { ascending: true })
    : { data: [] }

  const optionsByProduct = new Map<string, PrintProductOption[]>()
  for (const o of (optionsData as PrintProductOption[] | null) ?? []) {
    if (!optionsByProduct.has(o.product_id)) optionsByProduct.set(o.product_id, [])
    optionsByProduct.get(o.product_id)!.push(o)
  }

  const products: QuoteProduct[] = activeProducts.map((p) => ({
    slug: p.slug,
    name_en: p.name_en,
    category: p.category,
    min_order_quantity: p.min_order_quantity,
    options: (optionsByProduct.get(p.id) ?? []).map((o) => ({
      option_type: o.option_type,
      label_en: o.label_en,
      value: o.value,
      is_default: o.is_default,
    })),
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="mb-10 text-center">
        <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          Instant Estimate
        </span>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">Build Your Quote</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-500">
          Choose your product and options to see live USD pricing, then download a professional PDF
          quotation with a recommended Pantone color mix. No account needed.
        </p>
      </div>

      {products.length > 0 ? (
        <QuoteBuilder products={products} />
      ) : (
        <p className="text-center text-gray-500">Quoting is temporarily unavailable. Please check back soon.</p>
      )}
    </div>
  )
}
