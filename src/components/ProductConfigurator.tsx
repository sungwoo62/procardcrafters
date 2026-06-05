'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ShoppingCart, Truck, BadgeCheck, Pencil, Zap } from 'lucide-react'
import { calculateItemPriceUsd, calculatePriceFromSwadpia } from '@/lib/pricing'
import type { PrintProduct, PrintProductOption } from '@/types/database'
import type { SwadpiaPaper, SwadpiaPrintEntry, SwadpiaSize } from '@/lib/swadpia'
import PaperPopup from '@/components/PaperPopup'
import { LEAD_TIME_TIERS, formatProductionWindow, rushSurcharge, type LeadTimeTier } from '@/config/lead-time'

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

const OPTION_LABEL: Record<string, string> = {
  quantity: 'Quantity',
  paper_qty: 'Quantity',
  paper: 'Paper',
  paper_code: 'Paper',
  paper_size: 'Size',
  coating: 'Coating',
  size: 'Size',
  finish: 'Finishing',
  finishing: 'Finishing',
  corners: 'Corners',
  sides: 'Sides',
  pages: 'Pages',
  print_color_type: 'Print',
}

/** Option types that should show a hover preview popup (paper texture / finishing image). */
const RICH_PREVIEW_TYPES = new Set(['paper', 'paper_code', 'finish', 'finishing'])

/** Option types that represent quantity (so the selected qty is parsed from this). */
const QUANTITY_TYPES = new Set(['quantity', 'paper_qty'])

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
    const map = new Map<string, PrintProductOption[]>()
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
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null)
  const [leadTier, setLeadTier] = useState<LeadTimeTier>('standard')

  // Use real-time Swadpia pricing if available, otherwise fall back to DB-based pricing
  const useSwadpia = !!swadpiaData && swadpiaData.printEntries.length > 0

  // Selected quantity — DB 마다 type 명이 다름 (paper_qty / quantity). 둘 다 지원.
  const selectedQty = useMemo(() => {
    const qtyValue = selections['paper_qty'] ?? selections['quantity']
    const parsed = qtyValue ? parseInt(qtyValue, 10) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
  }, [selections])

  // Determine paper_code for Swadpia print cost lookup
  const swadpiaPaperCode = useMemo(() => {
    if (!swadpiaData) return null
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

  const rushUsd = useMemo(() => rushSurcharge(itemPriceUsd, leadTier), [itemPriceUsd, leadTier])
  const totalUsd = itemPriceUsd + rushUsd + shippingUsd
  const productionWindow = formatProductionWindow(product, leadTier)

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
              const hasPreview = RICH_PREVIEW_TYPES.has(type)
              const hoverKey = `${type}:${opt.value}`

              return (
                <div key={opt.value} className="relative">
                  {hasPreview && hoveredPaper === hoverKey && (
                    <PaperPopup option={opt} />
                  )}

                  <button
                    onClick={() => setSelections((prev) => ({ ...prev, [type]: opt.value }))}
                    onMouseEnter={() => hasPreview && setHoveredPaper(hoverKey)}
                    onMouseLeave={() => hasPreview && setHoveredPaper(null)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {opt.label_en}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Production speed */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Production Speed
        </label>
        <div className="grid grid-cols-2 gap-2">
          {LEAD_TIME_TIERS.map(tier => {
            const isSelected = leadTier === tier.key
            const [tMin, tMax] = (() => {
              const min = (product.production_days_min ?? 2) + tier.bufferDays
              const max = (product.production_days_max ?? 4) + tier.bufferDays
              return [min, max]
            })()
            const surcharge = rushSurcharge(itemPriceUsd, tier.key)
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => setLeadTier(tier.key)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-orange-400 bg-orange-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {tier.key === 'express' && <Zap className="w-3.5 h-3.5 text-orange-600" />}
                  <span className={`text-sm font-semibold ${isSelected ? 'text-orange-700' : 'text-gray-800'}`}>
                    {tier.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {tMin === tMax ? `${tMax} business days` : `${tMin}–${tMax} business days`}
                </div>
                <div className={`text-xs mt-1 ${surcharge > 0 ? 'text-orange-700 font-medium' : 'text-green-700'}`}>
                  {surcharge > 0 ? `+ $${surcharge.toFixed(2)} surcharge` : 'No surcharge'}
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Production starts after we approve your file (typically within 24 h).
        </p>
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <span className="font-semibold">Note:</span>
          <span>This is the production / dispatch estimate from our LA facility. Actual delivery time depends on FedEx network conditions and your destination — shipping is billed separately at checkout.</span>
        </div>
      </div>

      {/* Price Summary */}
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Print Cost ({selectedQty} pcs)</span>
          <span>${itemPriceUsd.toFixed(2)}</span>
        </div>
        {rushUsd > 0 && (
          <div className="flex justify-between text-sm text-orange-700">
            <span className="flex items-center gap-1">
              <Zap className="w-4 h-4" /> Express upgrade
            </span>
            <span>+ ${rushUsd.toFixed(2)}</span>
          </div>
        )}
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
        <div className="text-xs text-gray-500 border-t border-gray-200 pt-2">
          Production: <span className="font-medium text-gray-700">{productionWindow}</span> · then ships separately
        </div>
        <p className="text-[11px] text-gray-400">
          Exchange rate: 1 KRW = ${exchangeRate.toFixed(6)} USD (live)
        </p>
      </div>

      {/* Order / Editor Buttons */}
      <div className="space-y-2">
        <Link
          href={`/design/${product.slug}?${new URLSearchParams({ ...selections, lead_tier: leadTier }).toString()}`}
          className="block w-full text-center bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Design Online
          </span>
        </Link>
        <Link
          href={`/order?product=${product.slug}&${new URLSearchParams({ ...selections, lead_tier: leadTier }).toString()}`}
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
