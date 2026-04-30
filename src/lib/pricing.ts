import { krwToUsd } from './exchange-rate'

/**
 * Swadpia-based price calculation (KRW to USD)
 *
 * Formula: (Swadpia print cost KRW) x margin_multiplier x exchange_rate + shipping
 *
 * - swadpiaPriceKrw: Swadpia print cost (per-quantity lookup)
 * - marginMultiplier: Margin multiplier (default 3.3)
 * - exchangeRate: KRW to USD exchange rate
 */
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

/**
 * Swadpia print cost matrix-based price calculation (USD)
 *
 * swadpiaCostKrw: Swadpia wholesale cost (print_info1 lookup result)
 * marginMultiplier: Margin multiplier (3.3)
 * exchangeRate: KRW to USD
 */
export function calculatePriceFromSwadpia(params: {
  swadpiaCostKrw: number
  marginMultiplier: number
  exchangeRate: number
}): number {
  const { swadpiaCostKrw, marginMultiplier, exchangeRate } = params
  const totalKrw = swadpiaCostKrw * marginMultiplier
  return krwToUsd(totalKrw, exchangeRate)
}
