import { krwToUsd } from './exchange-rate'

/**
 * 성원 기반 가격 계산 (KRW → USD)
 *
 * 공식: (성원 인쇄비 KRW) × margin_multiplier × exchange_rate + 배송비
 *
 * - swadpiaPriceKrw: 성원 인쇄비 (수량별 조회값)
 * - marginMultiplier: 마진 배율 (기본 3.3)
 * - exchangeRate: KRW → USD 환율
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
 * 성원 인쇄비 매트릭스 기반 가격 계산 (USD)
 *
 * swadpiaCostKrw: 성원 도매가 (print_info1 조회 결과)
 * marginMultiplier: 마진 배율 (3.3)
 * exchangeRate: KRW → USD
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
