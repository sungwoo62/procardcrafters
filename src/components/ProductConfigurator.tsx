'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, Truck, BadgeCheck, Pencil, Zap, Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { calculateItemPriceUsd, calculatePriceFromSwadpia } from '@/lib/pricing'
import type { PrintProduct, PrintProductOption } from '@/types/database'
import { pickCheapestPress, type SwadpiaPaper, type SwadpiaPrintEntry, type SwadpiaSize, type PressKind } from '@/lib/swadpia'
import PaperPopup from '@/components/PaperPopup'
import SizePopup from '@/components/SizePopup'
import { finishingsForCategory } from '@/config/finishing-catalog'
import { finishingSurchargeKrw } from '@/config/finishing-surcharge'
import { paperDisplay } from '@/config/paper-display'
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

/** Option types that represent quantity (so the selected qty is parsed from this). */
const QUANTITY_TYPES = new Set(['quantity', 'paper_qty'])

/** OMO-3196 (보드): 인쇄 옵션(단면/양면) 설명 — hover 툴팁용. */
function printColorDesc(label: string): string | null {
  const l = (label ?? '').toLowerCase()
  const uv = /uv/.test(l)
  if (/double|양면/.test(l)) {
    return uv
      ? 'Full color on both the front and back, plus a protective UV gloss coating.'
      : 'Full-color printing on both the front and back.'
  }
  if (/single|단면/.test(l)) {
    return uv
      ? 'Full color on the front only (back left blank), plus a protective UV gloss coating.'
      : 'Full-color printing on the front only — the back is left blank.'
  }
  return null
}

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
  // OMO-3196 (보드): 흑백(Black & White) 인쇄 옵션 제거.
  const visibleOptions = useMemo(
    () => options.filter(
      (o) => !(o.option_type === 'print_color_type' && /black\s*&?\s*white|black_white|흑백|\bb\s*&\s*w\b|mono/i.test(`${o.value} ${o.label_en} ${o.label_ko}`)),
    ),
    [options],
  )
  // Group options by type
  const grouped = useMemo(() => {
    const map = new Map<string, PrintProductOption[]>()
    for (const opt of visibleOptions) {
      if (!map.has(opt.option_type)) map.set(opt.option_type, [])
      map.get(opt.option_type)!.push(opt)
    }
    return map
  }, [visibleOptions])

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

  // OMO-3196: 후가공 선택 — 카탈로그(제품 카테고리에 맞는 후가공)에서 가져온다.
  // DB option 행이 아니라 카탈로그 기반이라, 후가공이 항상 노출되고 hover 팝업으로
  // 맞는 이미지/설명을 보여준다. 선택은 콤마구분 `finishing` 으로 주문/에디터 URL 에 실린다.
  // 컨피규레이터에는 실가격(또는 Included)이 잡히는 후가공만 노출 → "quote" 제거(OMO-3196).
  const finishingOptions = useMemo(
    () => finishingsForCategory(product.category).filter(
      (f) => finishingSurchargeKrw(f.value, product.category, 1000) !== null,
    ),
    [product.category],
  )
  const [finishSel, setFinishSel] = useState<Set<string>>(new Set())
  const finishingCsv = Array.from(finishSel).join(',')

  // OMO-3196: 후가공 surcharge(성원 calcuEstimate probe 기반) → USD(마진·환율 반영).
  const finishUsd = useCallback(
    (krw: number) =>
      calculatePriceFromSwadpia({ swadpiaCostKrw: krw, marginMultiplier: product.margin_multiplier, exchangeRate }),
    [product.margin_multiplier, exchangeRate],
  )

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

  // OMO-3196: 선택 후가공 surcharge 합 → USD. 수량(selectedQty)에 따라 변동(성원 매트릭스).
  const finishingUsd = useMemo(() => {
    let krw = 0
    for (const v of finishSel) {
      const s = finishingSurchargeKrw(v, product.category, selectedQty)
      if (s) krw += s
    }
    return krw > 0 ? finishUsd(krw) : 0
  }, [finishSel, product.category, selectedQty, finishUsd])

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
  const currentUnitPrice = qtyUnitPriceMap.get(currentQtyKey) ?? null
  const maxUnitPrice = qtyUnitPriceMap.size > 1 ? Math.max(...Array.from(qtyUnitPriceMap.values())) : null
  const discountPct = (currentUnitPrice !== null && maxUnitPrice !== null && maxUnitPrice > currentUnitPrice)
    ? Math.round((1 - currentUnitPrice / maxUnitPrice) * 100)
    : 0

  const rushUsd = useMemo(() => rushSurcharge(itemPriceUsd, leadTier), [itemPriceUsd, leadTier])
  const totalUsd = itemPriceUsd + rushUsd + shippingUsd + finishingUsd
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
        // OMO-3196: DB 의 finish/finishing 옵션은 아래 카탈로그 기반 후가공 섹션이 단일 처리한다(중복 방지).
        if (type === 'finish' || type === 'finishing') return null

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

        // OMO-3196: 용지는 칩 나열(지저분) 대신 드롭다운 + 선택 용지 미리보기 카드로 정리.
        const isPaper = type === 'paper' || type === 'paper_code'
        if (isPaper) {
          const selectedOpt = opts.find((o) => o.value === selections[type]) ?? opts[0]
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
                  // OMO-3196: 미국 고객용 표시명 + 이름 옆 짧은 특징 2~3개.
                  const disp = paperDisplay(`${opt.label_en ?? ''} ${opt.label_ko ?? ''}`)
                  const name = disp?.name ?? opt.label_en
                  const feats = disp?.features?.slice(0, 3).join(' · ')
                  return (
                    <option key={opt.value} value={opt.value}>
                      {feats ? `${name} — ${feats}` : name}
                    </option>
                  )
                })}
              </select>
              {selectedOpt && (
                <div className="mt-2">
                  <PaperPopup option={selectedOpt} inline />
                </div>
              )}
            </div>
          )
        }

        // 사이즈는 신용카드 비교 팝업, DB 후가공(finish/finishing)은 카탈로그 미리보기 팝업.
        const isSize = type === 'paper_size' || type === 'size'
        const isFinishOpt = type === 'finish' || type === 'finishing'
        const isPrintColor = type === 'print_color_type'
        const typeHasPreview = isSize || isFinishOpt || isPrintColor
        return (
          <div key={type}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {OPTION_LABEL[type] ?? type}
            </label>
            <div className="flex flex-wrap gap-2">
              {opts.map((opt) => {
                const isSelected = selections[type] === opt.value
                const hoverKey = `${type}:${opt.value}`
                const printDesc = isPrintColor ? printColorDesc(opt.label_en) : null

                return (
                  <div key={opt.value} className="relative">
                    {isSize && hoveredPaper === hoverKey && <SizePopup option={opt} />}
                    {isFinishOpt && hoveredPaper === hoverKey && <PaperPopup option={opt} />}
                    {isPrintColor && hoveredPaper === hoverKey && printDesc && (
                      <div className="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
                        <p className="text-xs font-semibold text-gray-900 mb-1">{opt.label_en}</p>
                        <p className="text-[11px] text-gray-600 leading-snug">{printDesc}</p>
                      </div>
                    )}

                    <button
                      // OMO-3195: tapping also opens the preview so touch users (no hover) can see it.
                      onClick={() => {
                        setSelections((prev) => ({ ...prev, [type]: opt.value }))
                        if (typeHasPreview) setHoveredPaper((prev) => (prev === hoverKey ? null : hoverKey))
                      }}
                      onMouseEnter={() => typeHasPreview && setHoveredPaper(hoverKey)}
                      onMouseLeave={() => typeHasPreview && setHoveredPaper(null)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {opt.label_en}
                      {typeHasPreview && <span className="ml-1.5 text-gray-400">ⓘ</span>}
                    </button>
                  </div>
                )
              })}
            </div>
            {isSize && (
              <p className="mt-1.5 text-[11px] text-gray-500">
                💡 Tap or hover ⓘ to compare this size with a credit card.
              </p>
            )}
            {isFinishOpt && (
              <p className="mt-1.5 text-[11px] text-gray-500">
                💡 Tap or hover ⓘ to preview the finish.
              </p>
            )}
            {isPrintColor && (
              <p className="mt-1.5 text-[11px] text-gray-500">
                💡 Tap or hover ⓘ to see what each print option means.
              </p>
            )}
          </div>
        )
      })}

      {/* Finishing options (OMO-3196) — multi-select chips with hover preview popup */}
      {finishingOptions.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Finishing <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {finishingOptions.map((f) => {
              const isSelected = finishSel.has(f.value)
              const hoverKey = `finishing:${f.value}`
              const sKrw = finishingSurchargeKrw(f.value, product.category, selectedQty)
              const sUsd = sKrw && sKrw > 0 ? finishUsd(sKrw) : null
              return (
                <div key={f.value} className="relative">
                  {hoveredPaper === hoverKey && (
                    <PaperPopup
                      option={{
                        value: f.value,
                        label_en: f.label_en,
                        label_ko: f.label_ko,
                        image_url: f.image_url,
                        description_en: f.description_en,
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFinishSel((prev) => {
                        const next = new Set(prev)
                        if (next.has(f.value)) next.delete(f.value)
                        else next.add(f.value)
                        return next
                      })
                      setHoveredPaper((prev) => (prev === hoverKey ? null : hoverKey))
                    }}
                    onMouseEnter={() => setHoveredPaper(hoverKey)}
                    onMouseLeave={() => setHoveredPaper(null)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {f.label_en}
                    <span className={`ml-1.5 text-xs ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                      {sUsd ? `+$${sUsd.toFixed(2)}` : 'Included'}
                    </span>
                    <span className="ml-1 text-gray-400">ⓘ</span>
                  </button>
                </div>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">
            💡 Tap or hover ⓘ to preview each finish. Prices update with your quantity. &quot;Included&quot; means it&apos;s built into the paper/print at no extra cost.
          </p>
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
        {/* OMO-3196: 선택 후가공을 항목별 옵션가로 itemize — 최종 비용에 각 옵션가 확인 */}
        {finishSel.size > 0 && (
          <div className="border-t border-gray-200 pt-2 space-y-1">
            {finishingOptions
              .filter((f) => finishSel.has(f.value))
              .map((f) => {
                const krw = finishingSurchargeKrw(f.value, product.category, selectedQty)
                const usd = krw && krw > 0 ? finishUsd(krw) : null
                return (
                  <div key={f.value} className="flex justify-between text-xs text-gray-500">
                    <span>+ {f.label_en}</span>
                    <span className={usd ? '' : 'text-gray-400'}>{usd ? `+ $${usd.toFixed(2)}` : 'Included'}</span>
                  </div>
                )
              })}
            {finishingUsd > 0 && (
              <div className="flex justify-between text-sm text-gray-700 font-medium">
                <span>Finishing subtotal</span>
                <span>+ ${finishingUsd.toFixed(2)}</span>
              </div>
            )}
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
          href={`/design/${product.slug}?${new URLSearchParams({ ...selections, lead_tier: leadTier, ...(finishingCsv ? { finishing: finishingCsv } : {}) }).toString()}`}
          className="block w-full text-center bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Design Online
          </span>
        </Link>
        <Link
          href={`/order?product=${product.slug}&${new URLSearchParams({ ...selections, lead_tier: leadTier, ...(finishingCsv ? { finishing: finishingCsv } : {}), ...(uploadedFileId ? { fileId: uploadedFileId } : {}) }).toString()}`}
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
