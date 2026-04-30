'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ShoppingCart, Truck, BadgeCheck, Pencil } from 'lucide-react'
import { calculateItemPriceUsd, calculatePriceFromSwadpia } from '@/lib/pricing'
import type { PrintProduct, PrintProductOption, OptionType } from '@/types/database'
import type { SwadpiaPaper, SwadpiaPrintEntry, SwadpiaSize } from '@/lib/swadpia'

interface SwadpiaClientData {
  papers: SwadpiaPaper[]
  printEntries: SwadpiaPrintEntry[]
  sizes: SwadpiaSize[]
}

interface Props {
  product: PrintProduct
  options: PrintProductOption[]
  exchangeRate: number
  shippingUsd: number
  swadpiaData?: SwadpiaClientData
}

const OPTION_LABEL: Record<OptionType, string> = {
  quantity: 'Quantity',
  paper: 'Paper',
  coating: 'Coating',
  size: 'Size',
  finish: 'Finish',
}

/**
 * Look up cost from the Swadpia print price matrix.
 * If no exact quantity match, use the nearest higher quantity.
 */
function lookupSwadpiaCost(
  printEntries: SwadpiaPrintEntry[],
  paperCode: string,
  quantity: number,
): number | null {
  const entries = printEntries
    .filter(e => e.paper_code === paperCode)
    .sort((a, b) => a.quantity - b.quantity)

  if (entries.length === 0) return null

  const exact = entries.find(e => e.quantity === quantity)
  if (exact) return exact.print_unit2

  const upper = entries.find(e => e.quantity >= quantity)
  if (upper) return upper.print_unit2

  return entries[entries.length - 1].print_unit2
}

export default function ProductConfigurator({ product, options, exchangeRate, shippingUsd, swadpiaData }: Props) {
  // Group options by type
  const grouped = useMemo(() => {
    const map = new Map<OptionType, PrintProductOption[]>()
    for (const opt of options) {
      if (!map.has(opt.option_type)) map.set(opt.option_type, [])
      map.get(opt.option_type)!.push(opt)
    }
    return map
  }, [options])

  // Initialize defaults
  const defaultSelections = useMemo(() => {
    const sel: Record<string, string> = {}
    grouped.forEach((opts, type) => {
      const def = opts.find((o) => o.is_default) ?? opts[0]
      if (def) sel[type] = def.value
    })
    return sel
  }, [grouped])

  const [selections, setSelections] = useState<Record<string, string>>(defaultSelections)

  // Use real-time Swadpia pricing if available, otherwise fall back to DB-based pricing
  const useSwadpia = !!swadpiaData && swadpiaData.printEntries.length > 0

  // Selected quantity (from quantity option)
  const selectedQty = useMemo(() => {
    const qtyValue = selections['quantity']
    return qtyValue ? parseInt(qtyValue, 10) : 100
  }, [selections])

  // Determine paper_code for Swadpia print cost lookup
  // Map selected paper option to Swadpia paper_code
  const swadpiaPaperCode = useMemo(() => {
    if (!swadpiaData) return null
    // Use the first paper_code from print_info1 (default paper)
    const allCodes = [...new Set(swadpiaData.printEntries.map(e => e.paper_code))]
    return allCodes[0] ?? null
  }, [swadpiaData])

  const itemPriceUsd = useMemo(() => {
    if (useSwadpia && swadpiaPaperCode) {
      const costKrw = lookupSwadpiaCost(swadpiaData.printEntries, swadpiaPaperCode, selectedQty)
      if (costKrw !== null && costKrw > 0) {
        return calculatePriceFromSwadpia({
          swadpiaCostKrw: costKrw,
          marginMultiplier: product.margin_multiplier,
          exchangeRate,
        })
      }
    }

    // Fallback: DB-based calculation
    const extraPricesKrw = Array.from(grouped.entries()).map(([type, opts]) => {
      const selected = opts.find((o) => o.value === selections[type])
      return selected?.extra_price_krw ?? 0
    })

    return calculateItemPriceUsd({
      basePriceKrw: product.base_price_krw,
      marginMultiplier: product.margin_multiplier,
      extraPricesKrw,
      exchangeRate,
    })
  }, [product, grouped, selections, exchangeRate, useSwadpia, swadpiaData, swadpiaPaperCode, selectedQty])

  const totalUsd = itemPriceUsd + shippingUsd

  return (
    <div className="space-y-6">
      {/* Real-time wholesale pricing badge */}
      {useSwadpia && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <BadgeCheck className="w-4 h-4 shrink-0" />
          <span>Real-time wholesale pricing — updated hourly</span>
        </div>
      )}

      {/* Option Selection */}
      {Array.from(grouped.entries()).map(([type, opts]) => (
        <div key={type}>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {OPTION_LABEL[type] ?? type}
          </label>
          <div className="flex flex-wrap gap-2">
            {opts.map((opt) => {
              const isSelected = selections[type] === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelections((prev) => ({ ...prev, [type]: opt.value }))}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {opt.label_en}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Price Summary */}
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Print Cost ({selectedQty} pcs)</span>
          <span>${itemPriceUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Truck className="w-4 h-4" /> Shipping (US)
          </span>
          <span>${shippingUsd.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-blue-600">${totalUsd.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400">
          * Exchange rate: 1 KRW = ${exchangeRate.toFixed(6)} USD (live)
        </p>
      </div>

      {/* Order / Editor Buttons */}
      <div className="space-y-2">
        <Link
          href={`/design/${product.slug}?${new URLSearchParams(selections).toString()}`}
          className="block w-full text-center bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Design Online
          </span>
        </Link>
        <Link
          href={`/order?product=${product.slug}&${new URLSearchParams(selections).toString()}`}
          className="block w-full text-center bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Upload File & Order
          </span>
        </Link>
      </div>
    </div>
  )
}
