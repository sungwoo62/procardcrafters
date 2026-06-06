import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase'
import { isPccfSlug } from '@/config/pccf-catalog'
import type { PrintProduct } from '@/types/database'
import TemplateBrowserClient from './TemplateBrowserClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_products')
    .select('name_en')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Templates' }
  return { title: `${data.name_en} Templates — Procardcrafters` }
}

export default async function TemplatesPage({ params }: Props) {
  const { slug } = await params
  if (!isPccfSlug(slug)) notFound()

  const supabase = createServerClient()
  const { data: productData } = await supabase
    .from('print_products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!productData) notFound()

  return <TemplateBrowserClient product={productData as PrintProduct} />
}
