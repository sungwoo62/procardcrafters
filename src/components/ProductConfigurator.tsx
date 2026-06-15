'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, Truck, BadgeCheck, Pencil, Zap, Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { assignVariant, trackImpression, trackClick } from '@/lib/experiments/client'
import { calculateItemPriceUsd, calculatePriceFromSwadpia } from '@/lib/pricing'
import {
  finishingSurchargeKrw,
  AREA_PRICED_FINISHINGS,
  FINISHING_DEFAULT_AREA_MM,
  FINISHING_SURCHARGE,
} from '@/config/finishing-surcharge'
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

/** Option types for 후가공(finishing) — rendered as a separate multi-select section (OMO-2664). */
const FINISHING_TYPES = new Set(['finishing', 'finish'])

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

export default function ProductConfigurator({ product, options, exchangeRate, shippingUsd, swadpiaData }: Props) {
  // Group options by type. 후가공(finishing)은 별도 멀티셀렉트 섹션으로 분리 — 기본 단가에
  // 포함하지 않고 surcharge 를 따로 계산(OMO-2664).
  const { grouped, finishingOptions } = useMemo(() => {
    const map = new Map<string, PrintProductOption[]>()
    const fin: PrintProductOption[] = []
    for (const opt of options) {
      if (FINISHING_TYPES.has(opt.option_type)) {
        // 고객가 surcharge 가 매핑된 후가공만 주문 옵션으로 노출(검증된 값만 — OMO-2647).
        if (FINISHING_SURCHARGE[opt.value]) fin.push(opt)
        continue
      }
      if (!map.has(opt.option_type)) map.set(opt.option_type, [])
      map.get(opt.option_type)!.push(opt)
    }
    return { grouped: map, finishingOptions: fin }
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

  // 후가공 선택 상태(멀티셀렉트) + 박/형압 면적(가로×세로 mm) — OMO-2664
  const [finishings, setFinishings] = useState<Set<string>>(new Set())
  const [areas, setAreas] = useState<Record<string, { w: number; h: number }>>({})

  function toggleFinishing(value: string) {
    setFinishings((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
        // 면적 비례 후가공은 기본 면적(50×30mm)으로 초기화 — 고객이 조정 가능.
        if ((AREA_PRICED_FINISHINGS as readonly string[]).includes(value) && !areas[value]) {
          setAreas((a) => ({ ...a, [value]: { w: FINISHING_DEFAULT_AREA_MM.width, h: FINISHING_DEFAULT_AREA_MM.height } }))
        }
      }
      return next
    })
  }

  function setArea(value: string, dim: 'w' | 'h', raw: string) {
    const n = parseInt(raw, 10)
    // OMO-2667(WARN): 무효입력(빈칸/0)은 0 저장 대신 기본면적으로 클램프한다.
    // 0 을 저장하면 가격은 기본면적(50×30)으로 표시되는데 직렬화는 `>0` 가드로 면적키를
    // 드롭해 표시가↔직렬화(결제/발주) 면적이 불일치할 수 있다. 양쪽 모두 기본값으로 정합.
    const fallback = dim === 'w' ? FINISHING_DEFAULT_AREA_MM.width : FINISHING_DEFAULT_AREA_MM.height
    setAreas((a) => ({
      ...a,
      [value]: {
        w: a[value]?.w ?? FINISHING_DEFAULT_AREA_MM.width,
        h: a[value]?.h ?? FINISHING_DEFAULT_AREA_MM.height,
        [dim]: Number.isFinite(n) && n > 0 ? n : fallback,
      },
    }))
  }

  // 딥링크 프리셋(OMO-3211): /products/...?finishing=foil_stamp,deboss_emboss
  // 니치 랜딩 "추천옵션대로 만들기" CTA 가 추천 후가공을 실어 보내면 마운트 시 1회 미리 선택.
  // 이 제품에 실제 존재하는 후가공만 적용(없는 값은 무시 — graceful).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = new URLSearchParams(window.location.search).get('finishing')
    if (!raw) return
    const available = new Set(finishingOptions.map((o) => o.value))
    const wanted = raw
      .split(',')
      .map((s) => s.trim())
      .filter((v) => v && available.has(v))
    if (wanted.length === 0) return
    setFinishings(new Set(wanted))
    setAreas((prev) => {
      const next = { ...prev }
      for (const v of wanted) {
        if ((AREA_PRICED_FINISHINGS as readonly string[]).includes(v) && !next[v]) {
          next[v] = { w: FINISHING_DEFAULT_AREA_MM.width, h: FINISHING_DEFAULT_AREA_MM.height }
        }
      }
      return next
    })
    // 마운트 1회만 — finishingOptions 는 제품별 고정(memoized).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 제너릭 옵션 프리셋(OMO-3215): /products/...?preset=size:3x3,material:vinyl
  // 니치 랜딩 ctaPresetHref 가 후가공 외 옵션(사이즈/소재 등)을 type:value 로 실어 보내면
  // 마운트 시 1회 초기 selections 에 주입. 이 제품에 실제 존재하는 type/value 만 적용(graceful).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = new URLSearchParams(window.location.search).get('preset')
    if (!raw) return
    const next: Record<string, string> = {}
    for (const pair of raw.split(',')) {
      const idx = pair.indexOf(':')
      if (idx < 0) continue
      const type = pair.slice(0, idx).trim()
      const value = pair.slice(idx + 1).trim()
      if (!type || !value) continue
      const opts = grouped.get(type)
      if (opts && opts.some((o) => o.value === value)) next[type] = value
    }
    if (Object.keys(next).length === 0) return
    setSelections((prev) => ({ ...prev, ...next }))
    // 마운트 1회만 — grouped 는 제품별 고정(memoized).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pre-upload state
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── A/B 실험: PDP 1차 CTA 카피 (OMO-2610). 미배정/오류 시 현행 카피 폴백 ──
  const EXPERIMENT_KEY = 'pdp_cta_copy'
  const [ctaVariantKey, setCtaVariantKey] = useState<string | null>(null)
  const [ctaLabel, setCtaLabel] = useState('Design Online')
  useEffect(() => {
    let cancelled = false
    assignVariant(EXPERIMENT_KEY).then((variant) => {
      if (cancelled || !variant) return
      setCtaVariantKey(variant.key)
      const label = variant.config?.ctaLabel
      if (typeof label === 'string' && label) setCtaLabel(label)
      // 노출 1회 기록 (배정된 세션 한정)
      trackImpression(EXPERIMENT_KEY, variant.key)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  const itemPriceUsd = useMemo(() => {
    if (useSwadpia && swadpiaPaperCode) {
      const swadpia = lookupSwadpiaCost(swadpiaData.printEntries, swadpiaPaperCode, selectedQty)
      if (swadpia !== null && swadpia.costKrw > 0) {
        return calculatePriceFromSwadpia({
          swadpiaCostKrw: swadpia.costKrw,
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

  /**
   * 동일가격 프로모션 — Swadpia 최소 수량 한계 때문에 작은 수량 옵션이 더 큰 수량과 같은 단가가 되는 경우,
   * 고객에게 "동일 가격 — 추가 매수 무료" 프레이밍으로 보여준다.
   * 키: 수량 옵션의 value (예: "100"), 값: 실제로 Swadpia 가 매겨주는 수량 (예: 500)
   */
  const quantityPromoMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!useSwadpia || !swadpiaPaperCode) return map

    const qtyType = grouped.has('paper_qty') ? 'paper_qty' : 'quantity'
    const qtyOptions = grouped.get(qtyType)
    if (!qtyOptions) return map

    for (const opt of qtyOptions) {
      const requested = parseInt(opt.value, 10)
      if (!Number.isFinite(requested) || requested <= 0) continue
      const swadpia = lookupSwadpiaCost(swadpiaData.printEntries, swadpiaPaperCode, requested)
      if (swadpia && swadpia.effectiveQty > requested) {
        map.set(opt.value, swadpia.effectiveQty)
      }
    }
    return map
  }, [useSwadpia, swadpiaData, swadpiaPaperCode, grouped])

  const activePromoEffectiveQty = quantityPromoMap.get(
    selections['paper_qty'] ?? selections['quantity'] ?? '',
  )

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
      if (useSwadpia && swadpiaPaperCode && swadpiaData) {
        const sw = lookupSwadpiaCost(swadpiaData.printEntries, swadpiaPaperCode, qty)
        if (sw !== null && sw.costKrw > 0) {
          price = calculatePriceFromSwadpia({
            swadpiaCostKrw: sw.costKrw,
            marginMultiplier: product.margin_multiplier,
            exchangeRate,
          })
          map.set(opt.value, price / (quantityPromoMap.get(opt.value) ?? qty))
          continue
        }
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
  }, [useSwadpia, swadpiaData, swadpiaPaperCode, product, grouped, selections, exchangeRate, quantityPromoMap])

  const currentQtyKey = selections['paper_qty'] ?? selections['quantity'] ?? ''
  const currentUnitPrice = qtyUnitPriceMap.get(currentQtyKey) ?? null
  const maxUnitPrice = qtyUnitPriceMap.size > 1 ? Math.max(...Array.from(qtyUnitPriceMap.values())) : null
  const discountPct = (currentUnitPrice !== null && maxUnitPrice !== null && maxUnitPrice > currentUnitPrice)
    ? Math.round((1 - currentUnitPrice / maxUnitPrice) * 100)
    : 0

  const rushUsd = useMemo(() => rushSurcharge(itemPriceUsd, leadTier), [itemPriceUsd, leadTier])

  // 후가공 surcharge(고객가, USD) — 도매 KRW × margin_multiplier × 환율 (OMO-2664).
  const finishingUnitUsd = useCallback(
    (value: string, areaMm2?: number) => {
      const krw = finishingSurchargeKrw(value, areaMm2)
      if (krw <= 0) return 0
      return calculatePriceFromSwadpia({
        swadpiaCostKrw: krw,
        marginMultiplier: product.margin_multiplier,
        exchangeRate,
      })
    },
    [product.margin_multiplier, exchangeRate],
  )

  const finishingSurchargeUsd = useMemo(() => {
    let total = 0
    for (const v of finishings) {
      const area = areas[v]
      total += finishingUnitUsd(v, area ? area.w * area.h : undefined)
    }
    return total
  }, [finishings, areas, finishingUnitUsd])

  // 선택된 후가공을 성원 자동발주 필드명으로 직렬화(URL 파라미터). expandFinishingToSwadpiaFields 가 소비.
  const finishingParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (finishings.size === 0) return p
    p.finishing = Array.from(finishings).join(',')
    const fa = areas['foil_stamp']
    if (finishings.has('foil_stamp') && fa && fa.w > 0 && fa.h > 0) {
      p.bak_x_size_1 = String(fa.w)
      p.bak_y_size_1 = String(fa.h)
    }
    const ea = areas['deboss_emboss']
    if (finishings.has('deboss_emboss') && ea && ea.w > 0 && ea.h > 0) {
      p.ap_x_size_1 = String(ea.w)
      p.ap_y_size_1 = String(ea.h)
    }
    return p
  }, [finishings, areas])

  const totalUsd = itemPriceUsd + rushUsd + finishingSurchargeUsd + shippingUsd
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
          const currentPromo = quantityPromoMap.get(selections[type] ?? '')
          return (
            <div key={type}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {OPTION_LABEL[type] ?? type}
              </label>
              <select
                value={selections[type] ?? ''}
                onChange={(e) => setSelections((prev) => ({ ...prev, [type]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-colors"
              >
                {opts.map((opt) => {
                  const promoQty = quantityPromoMap.get(opt.value)
                  const perUnit = qtyUnitPriceMap.get(opt.value)
                  const perUnitStr = perUnit !== undefined
                    ? (perUnit < 0.1 ? `$${perUnit.toFixed(3)}` : `$${perUnit.toFixed(2)}`) + '/pc'
                    : ''
                  const optDiscount = (perUnit !== undefined && maxUnitPrice !== null && maxUnitPrice > perUnit + 0.0001)
                    ? ` -${Math.round((1 - perUnit / maxUnitPrice) * 100)}%`
                    : ''
                  return (
                    <option key={opt.value} value={opt.value}>
                      {opt.label_en}{perUnitStr ? ` — ${perUnitStr}${optDiscount}` : ''}{promoQty ? ` (→ ${promoQty} pcs free)` : ''}
                    </option>
                  )
                })}
              </select>
              {quantityPromoMap.size > 0 && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                  💡 Low-quantity orders are <span className="font-semibold">priced like the next available batch</span> — you pay the same and get extra prints free.
                </p>
              )}
              {currentPromo && (
                <p className="mt-1 text-[11px] text-amber-700 font-medium">
                  ✨ Selected quantity gets upgraded to {currentPromo} pcs at no extra cost.
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

      {/* Finishing (후가공) — multi-select with margin-reflected surcharge (OMO-2664) */}
      {finishingOptions.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Finishing <span className="text-xs font-normal text-gray-400">(optional add-ons)</span>
          </label>
          <div className="space-y-2">
            {finishingOptions.map((opt) => {
              const selected = finishings.has(opt.value)
              const isArea = (AREA_PRICED_FINISHINGS as readonly string[]).includes(opt.value)
              const area = areas[opt.value]
              const usd = finishingUnitUsd(opt.value, isArea && area ? area.w * area.h : undefined)
              return (
                <div
                  key={opt.value}
                  className={`border rounded-lg transition-all ${
                    selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFinishing(opt.value)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {selected && <CheckCircle className="w-3 h-3 text-white" />}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{opt.label_en}</span>
                    </span>
                    <span className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-gray-500'}`}>
                      + ${usd.toFixed(2)}
                    </span>
                  </button>
                  {selected && isArea && (
                    <div className="px-3 pb-3 -mt-0.5">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-medium">Area (mm):</span>
                        <input
                          type="number"
                          min={1}
                          value={area?.w ?? ''}
                          onChange={(e) => setArea(opt.value, 'w', e.target.value)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          aria-label="width mm"
                        />
                        <span className="text-gray-400">×</span>
                        <input
                          type="number"
                          min={1}
                          value={area?.h ?? ''}
                          onChange={(e) => setArea(opt.value, 'h', e.target.value)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          aria-label="height mm"
                        />
                        <span className="text-gray-400">(W × H of the stamped area)</span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Price scales with area. Final amount is confirmed by our production system.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
        {finishingSurchargeUsd > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Finishing ({finishings.size} selected)</span>
            <span>+ ${finishingSurchargeUsd.toFixed(2)}</span>
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
          href={`/design/${product.slug}?${new URLSearchParams({ ...selections, ...finishingParams, lead_tier: leadTier }).toString()}`}
          onClick={() => {
            if (ctaVariantKey) trackClick(EXPERIMENT_KEY, ctaVariantKey)
          }}
          className="block w-full text-center bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {ctaLabel}
          </span>
        </Link>
        <Link
          href={`/order?product=${product.slug}&${new URLSearchParams({ ...selections, ...finishingParams, lead_tier: leadTier, ...(uploadedFileId ? { fileId: uploadedFileId } : {}) }).toString()}`}
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
