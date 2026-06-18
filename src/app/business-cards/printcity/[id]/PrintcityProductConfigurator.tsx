'use client'

// OMO-3452: printcity 명함 실제 제품 페이지 구성기(클라이언트).
//   모든 옵션축(용지·사이즈·코팅·도수·박·부분코팅·에폭)을 선택 가능하게 노출하고,
//   선택 조합+수량의 printcity 공급가(KRW)를 priceTable 직독으로 산출한다.
//   고객가(USD·마진)·체크아웃 컷오버는 보드 게이트 — 본 구성기는 printcity 공급가+VAT 견적까지.

import { useMemo, useState } from 'react'
import { Database, ShieldCheck, Info } from 'lucide-react'
import {
  resolveSupplyKrw,
  defaultSelection,
  withVat,
  wonKR,
  type PrintcityProductData,
} from '@/lib/printcity-product'

// 축 표시 순서(가격영향 큰 순). 알 수 없는 키는 뒤에 자동 추가.
const AXIS_ORDER = ['material', 'size', 'coating', 'color', 'foil', 'PCS', 'EPS']

function orderedAxisKeys(axes: Record<string, unknown>): string[] {
  const keys = Object.keys(axes)
  const known = AXIS_ORDER.filter((k) => keys.includes(k))
  const rest = keys.filter((k) => !AXIS_ORDER.includes(k))
  return [...known, ...rest]
}

export default function PrintcityProductConfigurator({ product }: { product: PrintcityProductData }) {
  const axisKeys = useMemo(() => orderedAxisKeys(product.axes), [product])
  const initial = useMemo(() => defaultSelection(product), [product])

  // 기본값 = 실제 가격이 있는 대표 조합(첫 옵션 단순조합은 미가격일 수 있어 priced row 에서 도출)
  const [codes, setCodes] = useState<Record<string, string>>(initial.codes)
  const [qty, setQty] = useState<number>(initial.qty)

  const supply = resolveSupplyKrw(product, { codes, qty })
  const money = supply != null ? withVat(supply) : null
  const unit = supply != null && qty > 0 ? supply / qty : null

  const pick = (axisKey: string, code: string) => setCodes((prev) => ({ ...prev, [axisKey]: code }))

  return (
    <div className="space-y-5">
      {axisKeys.map((key) => {
        const axis = product.axes[key]
        if (!axis || axis.options.length === 0) return null
        const isChips = axis.options.length <= 6
        return (
          <div key={key}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {axis.label}
              {axis.options.length === 1 && (
                <span className="ml-2 text-[11px] font-normal text-gray-400">(고정)</span>
              )}
            </label>
            {isChips ? (
              <div className="flex flex-wrap gap-2">
                {axis.options.map((o) => {
                  const active = codes[key] === o.code
                  return (
                    <button
                      key={o.code}
                      type="button"
                      onClick={() => pick(key, o.code)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {o.ko}
                    </button>
                  )
                })}
              </div>
            ) : (
              <select
                value={codes[key]}
                onChange={(e) => pick(key, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {axis.options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.ko}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}

      {/* 수량 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">수량 Quantity</label>
        <select
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {product.quantities.map((q) => (
            <option key={q} value={q}>
              {q.toLocaleString('ko-KR')}매
            </option>
          ))}
        </select>
      </div>

      {/* 견적 — printcity 공개 GET JSON 직독 */}
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-2.5">
        {money ? (
          <>
            <div className="flex justify-between text-sm text-gray-600">
              <span>printcity 공급가 ({qty.toLocaleString('ko-KR')}매)</span>
              <span>{wonKR(money.supply)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>부가세 (10%)</span>
              <span>{wonKR(money.vat)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2.5">
              <span>합계 (VAT 포함)</span>
              <span>{wonKR(money.total)}</span>
            </div>
            {unit != null && (
              <div className="text-right text-[11px] text-gray-400">
                1매당 {wonKR(unit)} (공급가 기준)
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-2 text-sm text-gray-500">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
            <span>선택한 옵션 조합은 printcity 가격표에 없는 구성입니다. 다른 용지·사이즈·수량을 선택해 주세요.</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Database className="h-3.5 w-3.5" /> printcity 공개 API 직독 · 옵션 누락 0
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> 고객가(USD)·결제 컷오버는 보드 승인 게이트
        </span>
      </div>
    </div>
  )
}
