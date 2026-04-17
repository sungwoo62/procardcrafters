import { krwToUsd } from './exchange-rate'

// 상품 기본가 + 옵션 추가가 합산 후 KRW → USD 변환
// 공식: (base_price_krw + sum(extra_price_krw)) × margin_multiplier × exchange_rate
export function calculateItemPriceUsd(params: {
  basePriceKrw: number
  marginMultiplier: number
  extraPricesKrw: number[]
  exchangeRate: number
}): number {
  const { basePriceKrw, marginMultiplier, extraPricesKrw, exchangeRate } = params

  const totalKrw =
    (basePriceKrw + extraPricesKrw.reduce((sum, p) => sum + p, 0)) * marginMultiplier

  return krwToUsd(totalKrw, exchangeRate)
}
