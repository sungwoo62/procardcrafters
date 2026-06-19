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
  FINISHING_MATRIX_ROUTING,
} from '@/config/finishing-surcharge'
import { CARD_MATRIX_FINISHINGS, cardFinishingWholesaleKrw } from '@/config/finishing-card-matrix'
import {
  MAX_FOIL_LAYERS,
  validateFoilLayers,
  foilLayersToFields,
  resolveFoilPaperCut,
  type FoilLayer,
} from '@/config/swadpia-finishing-fields'
import {
  FINISHING_GATE_ENABLED,
  FINISHING_VALUE_TO_TOKEN,
  TOKEN_TO_FINISHING_VALUE,
  evaluateFinishingGate,
  type FinishingToken,
} from '@/config/finishing-gate'
import { CATEGORY_MAP } from '@/lib/swadpia'
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

  // 후가공 선택 상태(멀티셀렉트) + 형압 면적(가로×세로 mm) — OMO-2664
  const [finishings, setFinishings] = useState<Set<string>>(new Set())
  const [areas, setAreas] = useState<Record<string, { w: number; h: number }>>({})
  // OMO-3257: 박(foil)은 최대 3 레이어(면적 합산). foil 만 별도 레이어 배열로 관리.
  const [foilLayers, setFoilLayers] = useState<{ w: number; h: number }[]>([])
  const FOIL = 'foil_stamp'
  const defaultFoilLayer = () => ({ w: FINISHING_DEFAULT_AREA_MM.width, h: FINISHING_DEFAULT_AREA_MM.height })

  function toggleFinishing(value: string) {
    setFinishings((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
        if (value === FOIL) {
          // 박은 최소 1 레이어로 초기화(기본 면적 50×30mm). [+] 로 최대 3 레이어.
          setFoilLayers((ls) => (ls.length === 0 ? [defaultFoilLayer()] : ls))
        } else if ((AREA_PRICED_FINISHINGS as readonly string[]).includes(value) && !areas[value]) {
          // 면적 비례 후가공(형압)은 기본 면적(50×30mm)으로 초기화 — 고객이 조정 가능.
          setAreas((a) => ({ ...a, [value]: { w: FINISHING_DEFAULT_AREA_MM.width, h: FINISHING_DEFAULT_AREA_MM.height } }))
        }
      }
      return next
    })
  }

  // OMO-3257 박 레이어 조작 ([+] 최대 3, 삭제, 가로/세로 입력).
  function addFoilLayer() {
    setFoilLayers((ls) => (ls.length >= MAX_FOIL_LAYERS ? ls : [...ls, defaultFoilLayer()]))
  }
  function removeFoilLayer(idx: number) {
    setFoilLayers((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)))
  }
  function setFoilLayerDim(idx: number, dim: 'w' | 'h', raw: string) {
    const n = parseInt(raw, 10)
    const fallback = dim === 'w' ? FINISHING_DEFAULT_AREA_MM.width : FINISHING_DEFAULT_AREA_MM.height
    setFoilLayers((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, [dim]: Number.isFinite(n) && n > 0 ? n : fallback } : l)),
    )
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
    if (wanted.includes(FOIL)) {
      setFoilLayers((ls) => (ls.length === 0 ? [defaultFoilLayer()] : ls))
    }
    setAreas((prev) => {
      const next = { ...prev }
      for (const v of wanted) {
        if (v !== FOIL && (AREA_PRICED_FINISHINGS as readonly string[]).includes(v) && !next[v]) {
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
  // OMO-3567: 플래그 ON 시 박/형압/도무송은 수량·세부옵션 매트릭스로 라우팅(표시가↔청구가 동일 코어).
  //   세부옵션 selector 부재 시 기본값(BKT02/BKD10/DMT51/n1) — 서버 청구 경로와 동일 기본값이라 정합.
  const finishingUnitUsd = useCallback(
    (value: string, areaMm2?: number) => {
      const krw =
        FINISHING_MATRIX_ROUTING && selectedQty > 0 && CARD_MATRIX_FINISHINGS.has(value)
          ? cardFinishingWholesaleKrw(value, selectedQty, { areaMm2 })
          : finishingSurchargeKrw(value, areaMm2)
      if (krw <= 0) return 0
      return calculatePriceFromSwadpia({
        swadpiaCostKrw: krw,
        marginMultiplier: product.margin_multiplier,
        exchangeRate,
      })
    },
    [product.margin_multiplier, exchangeRate, selectedQty],
  )

  const finishingSurchargeUsd = useMemo(() => {
    let total = 0
    for (const v of finishings) {
      if (v === FOIL) {
        // OMO-3257: 박은 레이어별 면적 단가 합산(최대 3). 성원 setPPBakAmtSum 과 동일 합산.
        for (const l of foilLayers) {
          total += finishingUnitUsd(v, l.w > 0 && l.h > 0 ? l.w * l.h : undefined)
        }
        continue
      }
      const area = areas[v]
      total += finishingUnitUsd(v, area ? area.w * area.h : undefined)
    }
    return total
  }, [finishings, areas, foilLayers, finishingUnitUsd])

  // OMO-3264 박 사이즈 가드: 선택된 용지 규격(size_info)의 cut 치수(mm)를 해석.
  //   성원 ppBak.getCutXSize/getCutYSize 와 동일한 cut_norm_x/y_size 권위 소스.
  const foilPaperCut = useMemo(
    () => resolveFoilPaperCut(swadpiaData?.sizes, selections['paper_size'] ?? selections['size']),
    [swadpiaData, selections],
  )

  // OMO-3264 박 검증(성원 chk_size_high: 용지규격 대비 per-axis 상한, 0<x≤cutX && 0<y≤cutY).
  //   용지 cut 치수를 알면 per-axis 로 차단, 모르면 양수 검사만(거짓거부 방지). UI 경고/차단용.
  const foilValidation = useMemo(
    () => validateFoilLayers(foilLayers.map((l) => ({ x_size: l.w, y_size: l.h })), foilPaperCut),
    [foilLayers, foilPaperCut],
  )
  // 박 선택 + 검증 실패 시 주문/에디터 진행 차단.
  const foilBlocksOrder = finishings.has(FOIL) && foilLayers.length > 0 && !foilValidation.ok

  // OMO-3567: 조합제약 UI 가드(성원 chkPostPress 규칙). 플래그 OFF 시 빈 맵(회귀 0).
  //   block→비활성/경고, force_on→필수 체크고정, popup→안내. 카테고리/용지 컨텍스트로 평가.
  const finishingGate = useMemo(() => {
    const blocked = new Map<string, string>()
    const forced = new Map<string, string>()
    const popup = new Map<string, string>()
    if (!FINISHING_GATE_ENABLED) return { blocked, forced, popup }
    const categoryCode = CATEGORY_MAP[product.slug] ?? ''
    const paperCode = swadpiaPaperCode ?? ''
    const selectedTokens = new Set<FinishingToken>()
    for (const v of finishings) {
      const t = FINISHING_VALUE_TO_TOKEN[v]
      if (t) selectedTokens.add(t)
    }
    const verdicts = evaluateFinishingGate({
      categoryCode,
      paperCode,
      sizeType: selections['size_type'] ?? selections['size'],
      selected: selectedTokens,
    })
    const available = new Set(finishingOptions.map((o) => o.value))
    for (const v of verdicts) {
      const value = TOKEN_TO_FINISHING_VALUE[v.token]
      if (!value || !available.has(value)) continue // 우리 카탈로그에 없는 후가공은 가드 비대상
      const msg = v.message ?? ''
      if (v.action === 'block') blocked.set(value, msg)
      else if (v.action === 'force_on') forced.set(value, msg)
      else if (v.action === 'popup') popup.set(value, msg)
    }
    return { blocked, forced, popup }
  }, [finishings, selections, swadpiaPaperCode, product.slug, finishingOptions])

  // OMO-3567: 가드 강제 — 차단 후가공 자동 해제 + 필수 후가공 자동 선택(플래그 ON 시만).
  useEffect(() => {
    if (!FINISHING_GATE_ENABLED) return
    if (finishingGate.blocked.size === 0 && finishingGate.forced.size === 0) return
    setFinishings((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const v of finishingGate.blocked.keys()) {
        if (next.has(v)) { next.delete(v); changed = true }
      }
      for (const v of finishingGate.forced.keys()) {
        if (!next.has(v)) { next.add(v); changed = true }
      }
      return changed ? next : prev
    })
  }, [finishingGate])

  // 선택된 후가공을 성원 자동발주 필드명으로 직렬화(URL 파라미터). expandFinishingToSwadpiaFields 가 소비.
  const finishingParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (finishings.size === 0) return p
    p.finishing = Array.from(finishings).join(',')
    // OMO-3257: 박 레이어(최대 3) → 성원 발주 필드코드(bak_*_N). 유효 면적 레이어만 직렬화.
    if (finishings.has(FOIL)) {
      const layers: FoilLayer[] = foilLayers
        .filter((l) => l.w > 0 && l.h > 0)
        .map((l) => ({ x_size: l.w, y_size: l.h }))
      Object.assign(p, foilLayersToFields(layers))
    }
    const ea = areas['deboss_emboss']
    if (finishings.has('deboss_emboss') && ea && ea.w > 0 && ea.h > 0) {
      p.ap_x_size_1 = String(ea.w)
      p.ap_y_size_1 = String(ea.h)
    }
    return p
  }, [finishings, areas, foilLayers])

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
              const isFoil = opt.value === FOIL
              const isArea = (AREA_PRICED_FINISHINGS as readonly string[]).includes(opt.value)
              const area = areas[opt.value]
              // OMO-3567: 조합제약 가드(플래그 ON 시만 비어있지 않음).
              const blockedMsg = finishingGate.blocked.get(opt.value)
              const forcedMsg = finishingGate.forced.get(opt.value)
              const popupMsg = finishingGate.popup.get(opt.value)
              const isBlocked = blockedMsg !== undefined
              const isForced = forcedMsg !== undefined
              const usd = isFoil
                ? foilLayers.reduce(
                    (s, l) => s + finishingUnitUsd(opt.value, l.w > 0 && l.h > 0 ? l.w * l.h : undefined),
                    0,
                  )
                : finishingUnitUsd(opt.value, isArea && area ? area.w * area.h : undefined)
              return (
                <div
                  key={opt.value}
                  className={`border rounded-lg transition-all ${
                    isBlocked
                      ? 'border-gray-200 bg-gray-50 opacity-60'
                      : selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => { if (isBlocked || isForced) return; toggleFinishing(opt.value) }}
                    disabled={isBlocked}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left ${
                      isBlocked ? 'cursor-not-allowed' : ''
                    }`}
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
                      {isForced && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-100 rounded px-1.5 py-0.5">
                          Required
                        </span>
                      )}
                    </span>
                    <span className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-gray-500'}`}>
                      + ${usd.toFixed(2)}
                    </span>
                  </button>
                  {/* OMO-3567: 가드 메시지 — 차단(빨강)/필수(파랑)/안내(주황). */}
                  {isBlocked && blockedMsg && (
                    <p className="px-3 pb-2 -mt-1 text-[11px] text-red-500">{blockedMsg}</p>
                  )}
                  {isForced && forcedMsg && (
                    <p className="px-3 pb-2 -mt-1 text-[11px] text-blue-600">{forcedMsg}</p>
                  )}
                  {!isBlocked && selected && popupMsg && (
                    <p className="px-3 pb-2 -mt-1 text-[11px] text-amber-600">{popupMsg}</p>
                  )}
                  {/* OMO-3257: 박(foil)은 레이어별 가로×세로 입력 + [+] 최대 3 레이어 합산 */}
                  {selected && isFoil && (
                    <div className="px-3 pb-3 -mt-0.5 space-y-2">
                      {foilLayers.map((l, i) => {
                        // OMO-3264: 양수 + 용지규격 대비 per-axis 상한(cut 치수 해석 시). 가로/세로
                        // 각각 용지 cut 을 넘으면 해당 입력칸을 강조. 최종 권위는 성원 calcuEstimate.
                        const wOver = l.w <= 0 || (!!foilPaperCut && l.w > foilPaperCut.cutX)
                        const hOver = l.h <= 0 || (!!foilPaperCut && l.h > foilPaperCut.cutY)
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-medium w-14 shrink-0">Layer {i + 1}</span>
                            <input
                              type="number"
                              min={1}
                              value={l.w || ''}
                              onChange={(e) => setFoilLayerDim(i, 'w', e.target.value)}
                              className={`w-16 border rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                wOver ? 'border-red-400' : 'border-gray-300'
                              }`}
                              aria-label={`layer ${i + 1} width mm`}
                            />
                            <span className="text-gray-400">×</span>
                            <input
                              type="number"
                              min={1}
                              value={l.h || ''}
                              onChange={(e) => setFoilLayerDim(i, 'h', e.target.value)}
                              className={`w-16 border rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                hOver ? 'border-red-400' : 'border-gray-300'
                              }`}
                              aria-label={`layer ${i + 1} height mm`}
                            />
                            <span className="text-gray-400">mm</span>
                            {foilLayers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeFoilLayer(i)}
                                className="ml-1 text-gray-400 hover:text-red-500"
                                aria-label={`remove layer ${i + 1}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {foilLayers.length < MAX_FOIL_LAYERS && (
                        <button
                          type="button"
                          onClick={addFoilLayer}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          + Add foil layer (up to {MAX_FOIL_LAYERS})
                        </button>
                      )}
                      {!foilValidation.ok && (
                        <p className="text-[11px] text-red-500">{foilValidation.errors[0]}</p>
                      )}
                      {foilPaperCut && (
                        <p className="text-[11px] text-gray-400">
                          Each foil layer must fit within the paper size ({foilPaperCut.cutX} × {foilPaperCut.cutY} mm).
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400">
                        Foil price = sum of each layer&apos;s area. Final amount is confirmed by our production system.
                      </p>
                    </div>
                  )}
                  {selected && isArea && !isFoil && (
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
        {/* OMO-3264: 박 사이즈 가드 위반 시 진행 차단(용지규격 초과 발주 방지). */}
        {foilBlocksOrder && (
          <p className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{foilValidation.errors[0] ?? 'Please fix the foil layer dimensions before ordering.'}</span>
          </p>
        )}
        {foilBlocksOrder ? (
          <button
            type="button"
            disabled
            className="block w-full text-center bg-indigo-300 text-white px-6 py-3.5 rounded-xl font-semibold cursor-not-allowed"
          >
            <span className="inline-flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              {ctaLabel}
            </span>
          </button>
        ) : (
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
        )}
        {foilBlocksOrder ? (
          <button
            type="button"
            disabled
            className="block w-full text-center bg-blue-300 text-white px-6 py-3.5 rounded-xl font-semibold cursor-not-allowed"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {uploadStatus === 'done' ? 'Order with Uploaded File' : 'Upload File & Order'}
            </span>
          </button>
        ) : (
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
        )}
      </div>
    </div>
  )
}
