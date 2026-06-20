// OMO-3562: 청구 경로(order page + create-order/PayPal)를 제품페이지 표시가와 **일원화**한다.
//
// 배경(OMO-3520 라이브 확인): 제품페이지 표시가는 성원 가격매트릭스(lookupSwadpiaCost,
//   용지×수량 실원가)로 산출되는데, 청구 경로는 `base_price_krw(정액) + paper_qty extra
//   (용지무관 정액)` 로 산출돼 **두 값이 desync**(business-cards q1,000 표시 $29 vs 청구 $116,
//   ~9× 과청구). 원인: 청구가 매트릭스를 안 쓰고 정액 base+extra 를 씀.
//
// 본 모듈은 청구 itemPriceUsd 를 표시가와 **동일 연산**(매트릭스 base + 후가공 surcharge)으로
// 산출해 표시=청구를 보장한다.
//
// ⚠️ 고객 청구가 변경 = **보드 가격 승인 게이트**. 기본 OFF(dormant) — 검증 후 env 로 활성화.
//   NEXT_PUBLIC_ 아님(서버 전용 청구 경로). 활성화: ORDER_PRICE_MATRIX_ROUTING=on.

import { fetchSwadpiaCategoryData } from './swadpia'
import { lookupSwadpiaCost, calculatePriceFromSwadpia, calculateItemPriceUsd } from './pricing'
import {
  buildOrderExtraPricesKrw,
  finishingSurchargeKrwFromOptions,
} from '@/config/finishing-surcharge'

export const ORDER_PRICE_MATRIX_ROUTING = process.env.ORDER_PRICE_MATRIX_ROUTING === 'on'

interface ProductLike {
  slug: string
  base_price_krw: number
  margin_multiplier: number
}

type OptionRow = { option_type: string; value: string; extra_price_krw: number }

/**
 * 주문 1건(아이템)의 고객 청구가 USD.
 *  - 플래그 OFF(기본): 기존 `base_price_krw + buildOrderExtraPricesKrw`(하위호환, 회귀 0).
 *  - 플래그 ON: 성원 매트릭스 base(용지×수량) + 후가공 surcharge → 제품페이지 표시가와 동일.
 *    매트릭스 미적용(데이터없음/용지·수량 미상/룩업실패) 시 안전하게 legacy 로 폴백.
 */
export async function computeOrderItemPriceUsd(args: {
  product: ProductLike
  selectedOptions: Record<string, string>
  options: OptionRow[]
  exchangeRate: number
}): Promise<number> {
  const { product, selectedOptions, options, exchangeRate } = args

  const legacy = () =>
    calculateItemPriceUsd({
      basePriceKrw: product.base_price_krw,
      marginMultiplier: product.margin_multiplier,
      extraPricesKrw: buildOrderExtraPricesKrw(selectedOptions, options),
      exchangeRate,
    })

  if (!ORDER_PRICE_MATRIX_ROUTING) return legacy()

  const paperCode = selectedOptions.paper_code
  const qty = Number(selectedOptions.paper_qty ?? selectedOptions.quantity)
  if (!paperCode || !Number.isFinite(qty) || qty <= 0) return legacy()

  try {
    const data = await fetchSwadpiaCategoryData(product.slug)
    if (!data.fetchSuccess || data.printEntries.length === 0) return legacy()
    const r = lookupSwadpiaCost(data.printEntries, paperCode, qty)
    if (!r || r.costKrw <= 0) return legacy()

    // 매트릭스 base(USD) — 제품페이지 표시가(buildSwadpiaPricingTable)와 비트단위 동일 연산.
    const baseUsd = calculatePriceFromSwadpia({
      swadpiaCostKrw: r.costKrw,
      marginMultiplier: product.margin_multiplier,
      exchangeRate,
    })
    // 후가공 surcharge(USD) — OMO-3567 매트릭스/수량 라우팅 포함(paper_qty 자동파생).
    const finKrw = finishingSurchargeKrwFromOptions(selectedOptions, qty)
    const finUsd =
      finKrw > 0
        ? calculatePriceFromSwadpia({
            swadpiaCostKrw: finKrw,
            marginMultiplier: product.margin_multiplier,
            exchangeRate,
          })
        : 0
    return Math.round((baseUsd + finUsd) * 100) / 100
  } catch {
    return legacy()
  }
}
