import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import type { PrintProduct, PrintProductOption } from '@/types/database'
import EditorClient from './EditorClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function DesignPage({ params }: Props) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: productData } = await supabase
    .from('print_products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!productData) notFound()

  const product = productData as PrintProduct

  const { data: optionsData } = await supabase
    .from('print_product_options')
    .select('*')
    .eq('product_id', product.id)
    .order('sort_order', { ascending: true })

  const options = (optionsData as PrintProductOption[] | null) ?? []

  return <EditorClient product={product} options={options} />
}
