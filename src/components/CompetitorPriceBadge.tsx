'use client'

import { useState } from 'react'
import { X, TrendingDown, Info } from 'lucide-react'
import type { CompetitorPriceSummary } from '@/types/database'

interface Props {
  prices: CompetitorPriceSummary[]
}

export default function CompetitorPriceBadge({ prices }: Props) {
  const [open, setOpen] = useState(false)

  // 신선하고 실제로 저렴한 데이터만 (is_fresh + savings_pct > 0 는 view에서 이미 필터됨)
  const fresh = prices.filter(p => p.is_fresh && p.savings_pct > 0)
  if (fresh.length === 0) return null

  // 절감률 최대 항목을 배지 숫자로 사용
  const maxSavings = Math.max(...fresh.map(p => p.savings_pct))

  return (
    <>
      {/* 배지 칩 — 경쟁사 브랜드명 미노출 */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Save up to ${maxSavings}% vs. major brands — see details`}
        className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer"
      >
        <TrendingDown className="w-3 h-3" />
        Save up to {maxSavings}% vs. major print brands
        <Info className="w-3 h-3 opacity-60" />
      </button>

      {/* 비교 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-1">Why We&apos;re Different</h3>
            <p className="text-sm text-gray-500 mb-5">
              Same specs, better value — compared to mainstream print brands.
            </p>

            <div className="space-y-4">
              {fresh.map(p => (
                <div key={p.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700 text-sm">
                      {p.sku_variant}
                    </span>
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      Save {p.savings_pct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
                      <div className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider">
                        Major Brands (avg.)
                      </div>
                      <div className="text-lg font-bold text-gray-500 line-through decoration-red-400">
                        ${p.competitor_price_usd.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-center">
                      <div className="text-[10px] text-emerald-600 mb-1 uppercase tracking-wider font-semibold">
                        Procardcrafters
                      </div>
                      <div className="text-lg font-bold text-emerald-700">
                        ${p.our_price_usd.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {p.spec_notes && (
                    <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-2.5 leading-relaxed">
                      <span className="font-semibold text-blue-700">What you get more: </span>
                      {p.spec_notes}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 mt-2">
                    Price data captured {p.captured_date}
                  </div>
                </div>
              ))}
            </div>

            {/* 법적 고지 — 브랜드명 불필요, 일반 고지만 */}
            <p className="text-[10px] text-gray-400 mt-5 leading-relaxed border-t border-gray-100 pt-4">
              Comparison reflects publicly listed prices from major print providers on the dates shown.
              Prices and specifications may vary by configuration, region, and promotions.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
