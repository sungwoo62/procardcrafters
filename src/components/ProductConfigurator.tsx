'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, Truck, BadgeCheck, Pencil, Zap, Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { calculateItemPriceUsd, calculatePriceFromSwadpia } from '@/lib/pricing'
import type { PrintProduct, PrintProductOption } from '@/types/database'
import { pickCheapestPress, type SwadpiaPaper, type SwadpiaPrintEntry, type SwadpiaSize, type PressKind } from '@/lib/swadpia'
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
  /** 옵셋(대량) 가격 매트릭스 — 단일 프레스 제품은 이것만 */
  swadpiaData?: SwadpiaClientData
  /** OMO-3061: 디지털(소량) 가격 매트릭스 — 듀얼 프레스 제품에서만 전달됨 */
  digitalData?: SwadpiaClientData
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
 * Skips entries with print_unit2 <= 0 (Swadpia registers them as "전화문의"/phone-only and they would crash pricing).
 * Returns the resolved entry so the caller knows whether Swadpia rounded the quantity up.
 */
function lookupSwadpiaCost(
  printEntries: SwadpiaPrintEntry[],
  paperCode: string,
  quantity: number,
): { costKrw: number; effectiveQty: number } | null {
  const entries = printEntries
    .filter(e => e.paper_code === paperCode && e.print_unit2 > 0)
    .sort((a, b) => a.quantity - b.quantity)

  if (entries.length === 0) return null

  const exact = entries.find(e => e.quantity === quantity)
  if (exact) return { costKrw: exact.print_unit2, effectiveQty: exact.quantity }

  const upper = entries.find(e => e.quantity >= quantity)
  if (upper) return { costKrw: upper.print_unit2, effectiveQty: upper.quantity }

  const last = entries[entries.length - 1]
  return { costKrw: last.print_unit2, effectiveQty: last.quantity }
}

export default function ProductConfigurator({ product, options, exchangeRate, shippingUsd, swadpiaData, digitalData }: Props) {
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

  // Pre-upload state
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('uploading')
    setUploadError(null)
    setUploadedFileId(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/files/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setUploadStatus('error')
      setUploadError(data.error ?? 'Upload failed')
      return
    }
    setUploadStatus('done')
    setUploadedFileId(data.fileId)
    setUploadedFileName(file.name)
  }

  function clearFile() {
    setUploadStatus('idle')
    setUploadedFileId(null)
    setUploadedFileName(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Use real-time Swadpia pricing if available, otherwise fall back to DB-based pricing
  const useSwadpia = !!swadpiaData && swadpiaData.printEntries.length > 0

  // OMO-3061: 듀얼 프레스(옵셋+디지털) 제품이면 수량별 최저가 프레스를 자동 선택한다.
  // digitalData 가 없으면(=단일 프레스 38종) 기존 단일 매트릭스 경로를 그대로 사용.
  const useDualPress = useSwadpia && !!digitalData && digitalData.printEntries.length > 0

  // Selected quantity — DB 마다 type 명이 다름 (paper_qty / quantity). 둘 다 지원.
  const selectedQty = useMemo(() => {
    const qtyValue = selections['paper_qty'] ?? selections['quantity']
    const parsed = qtyValue ? parseInt(qtyValue, 10) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
  }, [selections])

  // Determine paper_code for Swadpia print cost lookup.
  // Prefer the user-selected paper_code (from DB options) if it has entries in the Swadpia matrix.
  const swadpiaPaperCode = useMemo(() => {
    if (!swadpiaData) return null
    const validCodes = new Set(swadpiaData.printEntries.filter(e => e.print_unit2 > 0).map(e => e.paper_code))
    const selectedCode = selections['paper_code']
    if (selectedCode && validCodes.has(selectedCode)) return selectedCode
    // Fall back to first code with valid pricing
    const allCodes = [...validCodes]
    return allCodes[0] ?? null
  }, [swadpiaData, selections])

  /**
   * OMO-3061: 주어진 수량의 Swadpia 인쇄 원가(KRW) + 실발주 수량 + 선택된 프레스를 반환한다.
   * - 듀얼 프레스: 옵셋/디지털 매트릭스를 비교해 그 수량의 최저가(또는 유일 가능) 프레스 선택.
   * - 단일 프레스: 기존 lookupSwadpiaCost 경로(옵셋) 유지.
   * Swadpia 데이터가 없거나 가격이 안 잡히면 null → 호출측이 DB 기반으로 폴백.
   */
  const priceForQty = useCallback(
    (qty: number): { costKrw: number; effectiveQty: number; press: PressKind } | null => {
      if (!useSwadpia || !swadpiaData) return null
      if (useDualPress && digitalData) {
        const pick = pickCheapestPress(
          qty,
          [
            { press: 'offset', categoryCode: '', entries: swadpiaData.printEntries },
            { press: 'digital', categoryCode: '', entries: digitalData.printEntries },
          ],
          selections['paper_code'],
        )
        if (pick && pick.costKrw > 0) {
          return { costKrw: pick.costKrw, effectiveQty: pick.effectiveQty, press: pick.press }
        }
        return null
      }
      if (!swadpiaPaperCode) return null
      const sw = lookupSwadpiaCost(swadpiaData.printEntries, swadpiaPaperCode, qty)
      if (sw !== null && sw.costKrw > 0) {
        return { costKrw: sw.costKrw, effectiveQty: sw.effectiveQty, press: 'offset' }
      }
      return null
    },
    [useSwadpia, swadpiaData, useDualPress, digitalData, swadpiaPaperCode, selections],
  )

  const itemPriceUsd = useMemo(() => {
    const p = priceForQty(selectedQty)
    if (p) {
      return calculatePriceFromSwadpia({
        swadpiaCostKrw: p.costKrw,
        marginMultiplier: product.margin_multiplier,
        exchangeRate,
      })
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
  }, [product, grouped, selections, exchangeRate, priceForQty, selectedQty])

  // 선택된 수량에서 자동 선택된 프레스(듀얼 프레스 제품만) — 베네핏 마이크로카피용.
  const selectedPress = useMemo(
    () => (useDualPress ? priceForQty(selectedQty)?.press ?? null : null),
    [useDualPress, priceForQty, selectedQty],
  )

  // OMO-3067: 현재 선택된(=자유 입력 가능) 수량의 라이브 견적. 성원 매트릭스 스냅·실발주 수량 포함.
  const liveQuote = useMemo(() => priceForQty(selectedQty), [priceForQty, selectedQty])

  /**
   * OMO-3067: 성원 가격 매트릭스가 커버하는 수량 구간(min/max).
   * 자유 입력 수량의 가드(최소/최대)와 placeholder 힌트에 사용한다.
   * 듀얼 프레스면 옵셋+디지털 두 매트릭스를 합쳐 가능한 최소/최대를 구한다.
   */
  const qtyBounds = useMemo(() => {
    if (!useSwadpia || !swadpiaData) return null
    const all = [
      ...swadpiaData.printEntries,
      ...(useDualPress && digitalData ? digitalData.printEntries : []),
    ].filter(e => e.print_unit2 > 0)
    if (!all.length) return null
    const qs = all.map(e => e.quantity)
    return { min: Math.min(...qs), max: Math.max(...qs) }
  }, [useSwadpia, swadpiaData, useDualPress, digitalData])

  // 자유 입력 수량 핸들러 — 숫자만 허용하고 매트릭스 최대치를 넘지 않도록 즉시 클램프(상한).
  const qtyTypeKey = grouped.has('paper_qty') ? 'paper_qty' : 'quantity'
  const setQtyValue = useCallback(
    (raw: string) => {
      let digits = raw.replace(/[^0-9]/g, '')
      if (qtyBounds && digits) {
        const n = parseInt(digits, 10)
        if (Number.isFinite(n) && n > qtyBounds.max) digits = String(qtyBounds.max)
      }
      setSelections(prev => ({ ...prev, [qtyTypeKey]: digits }))
    },
    [qtyBounds, qtyTypeKey],
  )
  // 포커스 아웃 시 최소 수량 미만이면 매트릭스 최소치로 스냅(하한).
  const clampQtyToMin = useCallback(() => {
    if (!qtyBounds) return
    setSelections(prev => {
      const cur = parseInt(prev[qtyTypeKey] ?? '', 10)
      if (!Number.isFinite(cur) || cur < qtyBounds.min) {
        return { ...prev, [qtyTypeKey]: String(qtyBounds.min) }
      }
      return prev
    })
  }, [qtyBounds, qtyTypeKey])

  /**
   * 동일가격 프로모션 — Swadpia 최소 수량 한계 때문에 작은 수량 옵션이 더 큰 수량과 같은 단가가 되는 경우,
   * 고객에게 "동일 가격 — 추가 매수 무료" 프레이밍으로 보여준다.
   * 키: 수량 옵션의 value (예: "100"), 값: 실제로 Swadpia 가 매겨주는 수량 (예: 500)
   */
  const quantityPromoMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!useSwadpia) return map

    const qtyType = grouped.has('paper_qty') ? 'paper_qty' : 'quantity'
    const qtyOptions = grouped.get(qtyType)
    if (!qtyOptions) return map

    for (const opt of qtyOptions) {
      const requested = parseInt(opt.value, 10)
      if (!Number.isFinite(requested) || requested <= 0) continue
      const p = priceForQty(requested)
      if (p && p.effectiveQty > requested) {
        map.set(opt.value, p.effectiveQty)
      }
    }
    return map
  }, [useSwadpia, priceForQty, grouped])

  // OMO-3067: 자유 입력 수량도 커버하도록 라이브 견적의 실발주 수량에서 직접 산출
  // (preset-keyed quantityPromoMap 은 커스텀 값을 못 잡으므로 liveQuote 우선).
  const activePromoEffectiveQty =
    liveQuote && liveQuote.effectiveQty > selectedQty
      ? liveQuote.effectiveQty
      : quantityPromoMap.get(selections['paper_qty'] ?? selections['quantity'] ?? '')

  // 수량 옵션별 개당 단가 맵 (할인율 계산용)
  const qtyUnitPriceMap = useMemo(() => {
    const qtyType = grouped.has('paper_qty') ? 'paper_qty' : 'quantity'
    const qtyOptions = grouped.get(qtyType)
    if (!qtyOptions) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const opt of qtyOptions) {
      const qty = parseInt(opt.value, 10)
      if (!Number.isFinite(qty) || qty <= 0) continue
      let price: number
      const p = priceForQty(qty)
      if (p) {
        price = calculatePriceFromSwadpia({
          swadpiaCostKrw: p.costKrw,
          marginMultiplier: product.margin_multiplier,
          exchangeRate,
        })
        // 라운드업(프로모) 시 실발주 수량으로 나눠 개당 단가를 산출.
        map.set(opt.value, price / (p.effectiveQty > qty ? p.effectiveQty : qty))
        continue
      }
      const extraPricesKrw = Array.from(grouped.entries()).map(([t, os]) => {
        const v = t === qtyType ? opt.value : (selections[t] ?? '')
        return os.find(o => o.value === v)?.extra_price_krw ?? 0
      })
      price = calculateItemPriceUsd({
        basePriceKrw: product.base_price_krw,
        marginMultiplier: product.margin_multiplier,
        extraPricesKrw,
        exchangeRate,
      })
      map.set(opt.value, price / qty)
    }
    return map
  }, [priceForQty, product, grouped, selections, exchangeRate])

  const currentQtyKey = selections['paper_qty'] ?? selections['quantity'] ?? ''
  // 자유 입력 수량이면 preset 맵에 없으므로 라이브 견적의 개당 단가로 폴백.
  const liveUnitPrice = liveQuote
    ? calculatePriceFromSwadpia({
        swadpiaCostKrw: liveQuote.costKrw,
        marginMultiplier: product.margin_multiplier,
        exchangeRate,
      }) / liveQuote.effectiveQty
    : null
  const currentUnitPrice = qtyUnitPriceMap.get(currentQtyKey) ?? liveUnitPrice
  const maxUnitPrice = qtyUnitPriceMap.size > 1 ? Math.max(...Array.from(qtyUnitPriceMap.values())) : null
  const discountPct = (currentUnitPrice !== null && maxUnitPrice !== null && maxUnitPrice > currentUnitPrice)
    ? Math.round((1 - currentUnitPrice / maxUnitPrice) * 100)
    : 0

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
      {Array.from(grouped.entries()).map(([type, opts]) => {
        const isQtyType = QUANTITY_TYPES.has(type)

        if (isQtyType) {
          // OMO-3067: 자유 입력 수량 + 프리셋 칩. 성원 전 구간 가격을 라이브로 커버한다.
          const curVal = selections[type] ?? ''
          const presets = opts
            .map(o => ({ value: o.value, label: o.label_en, n: parseInt(o.value, 10) }))
            .filter(o => Number.isFinite(o.n) && o.n > 0)
            .sort((a, b) => a.n - b.n)
          // 라이브 견적 기반 개당 단가(라운드업 시 실발주 수량으로 나눔).
          const livePerUnit = useSwadpia && liveQuote
            ? calculatePriceFromSwadpia({
                swadpiaCostKrw: liveQuote.costKrw,
                marginMultiplier: product.margin_multiplier,
                exchangeRate,
              }) / liveQuote.effectiveQty
            : null
          const livePerUnitStr = livePerUnit !== null
            ? (livePerUnit < 0.1 ? `$${livePerUnit.toFixed(3)}` : `$${livePerUnit.toFixed(2)}`) + '/pc'
            : null
          // 성원 매트릭스가 더 큰 실발주 수량으로 반올림했는지(=추가 매수 무료).
          const snappedUp = !!liveQuote && liveQuote.effectiveQty > selectedQty
          const belowMin = !!qtyBounds && selectedQty < qtyBounds.min
          return (
            <div key={type}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {OPTION_LABEL[type] ?? type}
              </label>
              {/* OMO-3067: 성원 라이브 가격 제품만 자유 입력 — 성원 매트릭스가 전 수량구간을 커버.
                  비연동(DB 고정 tier) 제품은 프리셋 칩만 노출(임의 수량 미스프라이싱 방지). */}
              {useSwadpia && (
                <>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={qtyBounds?.min}
                      max={qtyBounds?.max}
                      step={1}
                      value={curVal}
                      onChange={(e) => setQtyValue(e.target.value)}
                      onBlur={clampQtyToMin}
                      placeholder={qtyBounds ? `${qtyBounds.min}–${qtyBounds.max} pcs` : 'Enter quantity'}
                      aria-label="Quantity"
                      className="w-full border border-gray-300 rounded-lg pl-3 pr-12 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">pcs</span>
                  </div>
                  {/* 라이브 개당 단가 — 자유 입력에 실시간 반응 */}
                  {livePerUnitStr && (
                    <p className="mt-1.5 text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{livePerUnitStr}</span>
                      {' · '}{selectedQty.toLocaleString()} pcs
                    </p>
                  )}
                </>
              )}
              {/* 프리셋 빠른 선택 칩 */}
              {presets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {presets.map((p) => {
                    const isSelected = curVal === p.value
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setSelections((prev) => ({ ...prev, [type]: p.value }))}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              )}
              {/* 최소 수량 가드 안내 */}
              {qtyBounds && belowMin && (
                <p className="mt-1.5 text-[11px] text-red-600">
                  Minimum order is {qtyBounds.min.toLocaleString()} pcs — quantity will round up to {qtyBounds.min.toLocaleString()}.
                </p>
              )}
              {/* 반올림(추가 매수 무료) 안내 — 라이브 입력 수량 기준 */}
              {snappedUp && !belowMin && (
                <p className="mt-1.5 text-[11px] text-amber-700 font-medium">
                  ✨ Rounded up to {liveQuote!.effectiveQty.toLocaleString()} pcs — the nearest production batch. You pay the same and get the extra prints free.
                </p>
              )}
              {qtyBounds && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Any quantity from {qtyBounds.min.toLocaleString()} to {qtyBounds.max.toLocaleString()} pcs — live wholesale pricing.
                </p>
              )}
            </div>
          )
        }

        return (
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
        )
      })}

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
          <span>This is the production / dispatch estimate from our global production facility. Actual delivery time depends on FedEx network conditions and your destination — shipping is billed separately at checkout.</span>
        </div>
        {product.category === 'letterpress_cards' && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
            <span className="font-semibold shrink-0">⏳ Lead Time:</span>
            <span>Letterpress is 100% handcrafted. Due to artisan production and current order backlog, please allow <strong>30–40 business days</strong> before dispatch. Orders are non-cancellable once production begins.</span>
          </div>
        )}
      </div>

      {/* Price Summary */}
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
        {activePromoEffectiveQty && (
          <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
            <span className="font-semibold whitespace-nowrap">🎁 Promo:</span>
            <span>
              You ordered {selectedQty} pcs but we&apos;re printing&nbsp;
              <span className="font-semibold">{activePromoEffectiveQty} pcs for the same price</span> — extra prints included free.
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Print Cost ({selectedQty} pcs{activePromoEffectiveQty ? ` → ${activePromoEffectiveQty} pcs free upgrade` : ''})</span>
          <span>${itemPriceUsd.toFixed(2)}</span>
        </div>
        {/* OMO-3061: 수량별 자동 프레스 선택 — 프레스 종류는 숨기고 베네핏만 노출 */}
        {selectedPress && (
          <div className="flex items-start gap-1.5 text-[11px] text-gray-500 -mt-1">
            <span className="text-gray-400">ⓘ</span>
            <span>
              {selectedPress === 'digital'
                ? 'Ideal for small runs — fast turnaround, no minimums.'
                : 'Best per-unit value at this quantity, with consistent color across the run.'}
            </span>
          </div>
        )}
        {currentUnitPrice !== null && (
          <div className="flex justify-between text-xs text-gray-500 -mt-1">
            <span>Unit price</span>
            <span className="flex items-center gap-2">
              <span>{currentUnitPrice < 0.1 ? `$${currentUnitPrice.toFixed(3)}` : `$${currentUnitPrice.toFixed(2)}`}/pc</span>
              {discountPct > 0 && (
                <span className="text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded">
                  Save {discountPct}%
                </span>
              )}
            </span>
          </div>
        )}
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
      </div>

      {/* Pre-upload design file */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Upload Your Design File</p>
          <span className="text-xs text-gray-400">PDF · AI · PSD · PNG · JPG · TIFF · Max 200MB</span>
        </div>

        {uploadStatus === 'idle' && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Choose file or drag & drop
          </button>
        )}

        {uploadStatus === 'uploading' && (
          <div className="flex items-center gap-3 py-3 px-4 bg-blue-50 rounded-lg text-blue-700 text-sm">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Uploading…
          </div>
        )}

        {uploadStatus === 'done' && uploadedFileName && (
          <div className="flex items-center gap-3 py-2 px-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <span className="flex-1 truncate text-green-800">{uploadedFileName}</span>
            <button type="button" onClick={clearFile} className="text-green-600 hover:text-green-800 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="flex items-start gap-3 py-2 px-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700">{uploadError}</p>
              <button type="button" onClick={clearFile} className="text-xs text-red-500 underline mt-1">Try again</button>
            </div>
          </div>
        )}

        {uploadStatus !== 'done' && (
          <p className="text-xs text-gray-400">
            Optional: upload now to skip the upload step at checkout.
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.tif,.tiff"
          onChange={handleFileChange}
          className="hidden"
        />
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
          href={`/order?product=${product.slug}&${new URLSearchParams({ ...selections, lead_tier: leadTier, ...(uploadedFileId ? { fileId: uploadedFileId } : {}) }).toString()}`}
          className="block w-full text-center bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            {uploadStatus === 'done'
              ? <><FileText className="w-5 h-5" /> Order with Uploaded File</>
              : <><ShoppingCart className="w-5 h-5" /> Upload File & Order</>
            }
          </span>
        </Link>
      </div>
    </div>
  )
}
