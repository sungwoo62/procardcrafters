import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, BadgeCheck, CheckCircle, Clock, Globe, ShieldCheck, Layers } from 'lucide-react'
import { PRINTCITY_PRODUCTS, getPrintcityProduct, startingSupplyKrw, withVat } from '@/lib/printcity-product'
import PrintcityProductConfigurator from './PrintcityProductConfigurator'
import { isPrintcityHidden } from '@/lib/printcity-hidden'

export const dynamic = 'force-static'

export function generateStaticParams() {
  // OMO-3482: 숨김 시 printcity 제품 상세를 프리렌더하지 않는다(데이터는 보존).
  if (isPrintcityHidden()) return []
  return PRINTCITY_PRODUCTS.map((p) => ({ id: p.id }))
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = getPrintcityProduct(id)
  if (!p) return { title: 'Product Not Found' }
  return {
    title: `${p.label} | Custom ${p.label} Printing · Procardcrafters`,
    description: `Order ${p.label} online — choose paper, size, coating, sides${p.hasFoil ? ', foil' : ''} and finishing. Full option mapping, fast worldwide delivery.`,
  }
}

const won = (n: number) => `₩${Math.round(n).toLocaleString('en-US')}`

const TRUST = [
  { icon: ShieldCheck, text: 'Quality Guaranteed' },
  { icon: Clock, text: '3–5 Day Production' },
  { icon: Globe, text: 'FedEx Worldwide' },
  { icon: Layers, text: 'Full Option Mapping' },
]

export default async function PrintcityProductPage({ params }: Props) {
  if (isPrintcityHidden()) notFound() // OMO-3482: printcity UI 숨김(데이터 보존)
  const { id } = await params
  const product = getPrintcityProduct(id)
  if (!product) notFound()

  const start = startingSupplyKrw(product)
  const startTotal = start ? withVat(start.krw).total : null
  const axisCount = Object.keys(product.axes).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/business-cards"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> All Business Cards
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: product info */}
          <div>
            <div className="aspect-[16/10] rounded-2xl bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 border border-gray-200 flex items-center justify-center mb-6">
              <div className="text-center">
                <BadgeCheck className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                <div className="text-sm font-semibold text-blue-900/70">{product.subEn ?? product.sub}</div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 mb-1">
              <h1 className="text-3xl font-bold text-gray-900">{product.label}</h1>
              {product.hasFoil && (
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                  {product.axes.foil?.options.length ?? 0} foil colors
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">{product.subEn ?? product.sub}</p>

            {startTotal != null && (
              <p className="text-gray-700 mb-5">
                <span className="text-gray-500 text-sm">From </span>
                <span className="text-2xl font-bold text-gray-900">{won(startTotal)}</span>
                <span className="text-gray-500 text-sm"> / {start?.qty.toLocaleString('en-US')} pcs incl. VAT</span>
              </p>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Options</h3>
              <ul className="space-y-2">
                {Object.entries(product.axes).map(([k, ax]) => (
                  <li key={k} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="font-medium">{ax.label}</span>
                    <span className="text-gray-400">— {ax.options.length} options</span>
                  </li>
                ))}
                <li className="flex items-center gap-2.5 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="font-medium">Quantity</span>
                  <span className="text-gray-400">— {product.quantities.length} tiers</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="font-semibold text-blue-800 text-sm mb-1">{axisCount + 1} option groups</div>
                <div className="text-blue-600 text-xs leading-relaxed">Every option selectable · real per-combo price</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="font-semibold text-green-800 text-sm mb-1">{product.table.length} combinations</div>
                <div className="text-green-600 text-xs leading-relaxed">Live pricing · no estimates</div>
              </div>
            </div>
          </div>

          {/* Right: configure & quote */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Configure &amp; Quote</h2>
            <PrintcityProductConfigurator product={product} />
          </div>
        </div>
      </div>

      {/* 신뢰 배지 */}
      <div className="bg-white border-t border-gray-100 py-8 px-4">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {TRUST.map((item) => (
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
