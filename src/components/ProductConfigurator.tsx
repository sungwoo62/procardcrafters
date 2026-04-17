'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ShoppingCart, Truck } from 'lucide-react'
import { calculateItemPriceUsd } from '@/lib/pricing'
import type { PrintProduct, PrintProductOption, OptionType } from '@/types/database'

interface Props {
  product: PrintProduct
  options: PrintProductOption[]
  exchangeRate: number
  shippingUsd: number
}

const OPTION_LABEL: Record<OptionType, string> = {
  quantity: '수량',
  paper: '용지',
  coating: '코팅',
  size: '사이즈',
  finish: '마감',
}

export default function ProductConfigurator({ product, options, exchangeRate, shippingUsd }: Props) {
  // 옵션 타입별 그룹화
  const grouped = useMemo(() => {
    const map = new Map<OptionType, PrintProductOption[]>()
    for (const opt of options) {
      if (!map.has(opt.option_type)) map.set(opt.option_type, [])
      map.get(opt.option_type)!.push(opt)
    }
    return map
  }, [options])

  // 기본값 초기화: 각 옵션 타입에서 is_default=true인 항목
  const defaultSelections = useMemo(() => {
    const sel: Record<string, string> = {}
    grouped.forEach((opts, type) => {
      const def = opts.find((o) => o.is_default) ?? opts[0]
      if (def) sel[type] = def.value
    })
    return sel
  }, [grouped])

  const [selections, setSelections] = useState<Record<string, string>>(defaultSelections)

  // 선택된 옵션들의 추가 단가 합산
  const extraPricesKrw = useMemo(() => {
    return Array.from(grouped.entries()).map(([type, opts]) => {
      const selected = opts.find((o) => o.value === selections[type])
      return selected?.extra_price_krw ?? 0
    })
  }, [grouped, selections])

  const itemPriceUsd = useMemo(
    () =>
      calculateItemPriceUsd({
        basePriceKrw: product.base_price_krw,
        marginMultiplier: product.margin_multiplier,
        extraPricesKrw,
        exchangeRate,
      }),
    [product, extraPricesKrw, exchangeRate]
  )

  const totalUsd = itemPriceUsd + shippingUsd

  return (
    <div className="space-y-6">
      {/* 옵션 선택 */}
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
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {opt.label_en}
                  {opt.extra_price_krw > 0 && (
                    <span className="ml-1 text-xs text-gray-400">+₩{opt.extra_price_krw.toLocaleString()}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* 가격 요약 */}
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>인쇄 단가</span>
          <span>${itemPriceUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Truck className="w-4 h-4" /> 배송비 (미국 기준)
          </span>
          <span>${shippingUsd.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg">
          <span>합계</span>
          <span className="text-blue-600">${totalUsd.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400">
          * 환율 기준: 1 KRW ≈ ${exchangeRate.toFixed(6)} USD (당일 기준)
        </p>
      </div>

      {/* 주문 버튼 */}
      <Link
        href={`/order?product=${product.slug}&${new URLSearchParams(selections).toString()}`}
        className="block w-full text-center bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          파일 업로드 및 주문
        </span>
      </Link>
    </div>
  )
}
