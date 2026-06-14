// OMO-3159: 견적서용 서버사이드 가격 산출.
//
// 목표: 제품 상세 페이지의 `ProductConfigurator` 가 보여주는 가격과 **완전히 동일한**
// 숫자를 서버에서 재현한다. 그래서 신규 가격로직을 만들지 않고, 컨피규레이터가 쓰는
// 동일 1차 함수(calculatePriceFromSwadpia / calculateItemPriceUsd)와 동일 데이터
// 페처(fetchSwadpiaCategoryData)만 사용한다.
//
// 참고 parity 소스: src/components/ProductConfigurator.tsx (itemPriceUsd useMemo),
//                   src/app/products/[slug]/page.tsx (서버 데이터 로딩).
//
// 주: main 의 가격 경로는 단일 프레스(성원 옵셋 매트릭스)다. 듀얼 프레스(OMO-3061)는
//     아직 main 미머지이므로 본 모듈도 단일 프레스만 사용한다(=배포본과 parity).
//     듀얼 프레스 머지 후엔 pickCheapestPress 경로를 후속으로 추가한다.

import { calculateItemPriceUsd, calculatePriceFromSwadpia } from './pricing'
import { getKrwToUsdRate } from './exchange-rate'
import { getShippingCost } from './shipping'
import { fetchSwadpiaCategoryData, type SwadpiaPrintEntry } from './swadpia'
import type { PrintProduct, PrintProductOption } from '@/types/database'

/** 수량 옵션 type 후보 (configurator 와 동일). */
const QUANTITY_TYPES = ['paper_qty', 'quantity'] as const

/**
 * Swadpia 인쇄 원가 매트릭스 단일 조회 — ProductConfigurator.lookupSwadpiaCost 의 서버 미러.
 * print_unit2(양면) > 0 인 엔트리만, 요청 수량 이상 최소 단계로 라운드업.
 */
function lookupSwadpiaCost(
  printEntries: SwadpiaPrintEntry[],
  paperCode: string,
  quantity: number,
): { costKrw: number; effectiveQty: number } | null {
  const entries = printEntries
    .filter((e) => e.paper_code === paperCode && e.print_unit2 > 0)
    .sort((a, b) => a.quantity - b.quantity)
  if (entries.length === 0) return null
  const exact = entries.find((e) => e.quantity === quantity)
  if (exact) return { costKrw: exact.print_unit2, effectiveQty: exact.quantity }
  const upper = entries.find((e) => e.quantity >= quantity)
  if (upper) return { costKrw: upper.print_unit2, effectiveQty: upper.quantity }
  const last = entries[entries.length - 1]
  return { costKrw: last.print_unit2, effectiveQty: last.quantity }
}

export interface QuoteSelectionLine {
  optionType: string
  labelEn: string
  value: string
}

export interface QuoteResult {
  product: { slug: string; nameEn: string; category: string }
  selections: QuoteSelectionLine[]
  quantity: number
  /** Swadpia 가 실제로 받는 발주 수량(요청보다 클 수 있음 — 라운드업). */
  effectiveQty: number
  /** 프레스 표기(현재 단일 프레스이므로 항상 null). 듀얼 프레스 머지 후 사용. */
  press: string | null
  unitPriceUsd: number
  itemPriceUsd: number
  shippingUsd: number
  totalUsd: number
  exchangeRate: number
  /** Swadpia 라이브 매트릭스 사용 여부(false=DB 기반 폴백). */
  usedSwadpia: boolean
  productionDays: { min: number; max: number }
}

export interface BuildQuoteInput {
  product: PrintProduct
  options: PrintProductOption[]
  /** option_type → 선택된 value. (configurator selections 와 동일 형식) */
  selections: Record<string, string>
  /** 명시 수량. 미지정 시 selections 의 수량 옵션에서 파싱. */
  quantity?: number
  /** 배송 국가코드(기본 US). */
  countryCode?: string
}

/**
 * 견적 1건을 서버에서 산출한다. 제품 페이지와 동일한 페처/계산기를 사용하므로
 * 결과 숫자는 라이브 사이트 견적과 일치한다.
 */
export async function buildQuote(input: BuildQuoteInput): Promise<QuoteResult> {
  const { product, options, selections, countryCode = 'US' } = input

  // 수량 결정 — 명시값 우선, 없으면 selections 의 수량옵션, 그래도 없으면 100(configurator 기본).
  const qtyFromSel = QUANTITY_TYPES.map((t) => selections[t]).find(Boolean)
  const parsedSel = qtyFromSel ? parseInt(qtyFromSel, 10) : NaN
  const quantity =
    input.quantity && input.quantity > 0
      ? input.quantity
      : Number.isFinite(parsedSel) && parsedSel > 0
        ? parsedSel
        : 100

  const [exchangeRate, swadpiaData] = await Promise.all([
    getKrwToUsdRate(),
    fetchSwadpiaCategoryData(product.slug),
  ])

  const useSwadpia = swadpiaData.fetchSuccess && swadpiaData.printEntries.length > 0

  // 선택된 paper_code 가 매트릭스에 유효하면 그것, 아니면 첫 유효 코드(configurator 동일).
  const validCodes = useSwadpia
    ? new Set(swadpiaData.printEntries.filter((e) => e.print_unit2 > 0).map((e) => e.paper_code))
    : new Set<string>()
  const selectedCode = selections['paper_code']
  const swadpiaPaperCode: string | null =
    selectedCode && validCodes.has(selectedCode) ? selectedCode : ([...validCodes][0] ?? null)

  // 가격 산출 — 라이브 매트릭스 우선, 실패 시 DB 기반 폴백(configurator itemPriceUsd 미러).
  let itemPriceUsd: number
  let effectiveQty = quantity
  let usedSwadpia = false

  const swadpiaPick =
    useSwadpia && swadpiaPaperCode
      ? lookupSwadpiaCost(swadpiaData.printEntries, swadpiaPaperCode, quantity)
      : null

  if (swadpiaPick && swadpiaPick.costKrw > 0) {
    itemPriceUsd = calculatePriceFromSwadpia({
      swadpiaCostKrw: swadpiaPick.costKrw,
      marginMultiplier: product.margin_multiplier,
      exchangeRate,
    })
    effectiveQty = swadpiaPick.effectiveQty
    usedSwadpia = true
  } else {
    // DB 폴백 — 각 옵션그룹의 extra_price_krw 합산(configurator fallback 동일).
    const grouped = new Map<string, PrintProductOption[]>()
    for (const opt of options) {
      if (!grouped.has(opt.option_type)) grouped.set(opt.option_type, [])
      grouped.get(opt.option_type)!.push(opt)
    }
    const extraPricesKrw = Array.from(grouped.entries()).map(([type, opts]) => {
      const selected = opts.find((o) => o.value === selections[type])
      return selected?.extra_price_krw ?? 0
    })
    itemPriceUsd = calculateItemPriceUsd({
      basePriceKrw: product.base_price_krw,
      marginMultiplier: product.margin_multiplier,
      extraPricesKrw,
      exchangeRate,
    })
  }

  // 제품 상세 페이지와 동일하게 항상 운임을 계산한다(parity).
  const shippingUsd = getShippingCost(countryCode)
  const totalUsd = Math.round((itemPriceUsd + shippingUsd) * 100) / 100
  const unitPriceUsd = Math.round((itemPriceUsd / effectiveQty) * 100) / 100

  // 선택 라벨 정리 — 표시용(영문). 옵션 type 순.
  const labelByValue = new Map<string, PrintProductOption>()
  for (const o of options) labelByValue.set(`${o.option_type}:${o.value}`, o)
  const selectionLines: QuoteSelectionLine[] = Object.entries(selections)
    .filter(([, v]) => v != null && v !== '')
    .map(([type, value]) => {
      const opt = labelByValue.get(`${type}:${value}`)
      return { optionType: type, labelEn: opt?.label_en || value, value }
    })

  return {
    product: { slug: product.slug, nameEn: product.name_en, category: product.category },
    selections: selectionLines,
    quantity,
    effectiveQty,
    press: null,
    unitPriceUsd,
    itemPriceUsd,
    shippingUsd,
    totalUsd,
    exchangeRate,
    usedSwadpia,
    productionDays: { min: product.production_days_min, max: product.production_days_max },
  }
}
