import { describe, it, expect } from 'vitest'
import { computeOrderItemPriceUsd, ORDER_PRICE_MATRIX_ROUTING } from '../order-pricing'
import { calculateItemPriceUsd } from '../pricing'
import { buildOrderExtraPricesKrw } from '@/config/finishing-surcharge'

// OMO-3562: 플래그 OFF(기본) 시 청구가는 기존 base_price_krw + buildOrderExtraPricesKrw 와 동일(회귀 0).
describe('computeOrderItemPriceUsd — 플래그 OFF 하위호환', () => {
  it('기본값(OFF) 은 legacy 와 동일', async () => {
    expect(ORDER_PRICE_MATRIX_ROUTING).toBe(false) // 테스트 env 에서 미설정
    const product = { slug: 'business-cards', base_price_krw: 4000, margin_multiplier: 3.3 }
    const selectedOptions = { paper_code: 'SNW250W00', paper_qty: '1000', print_color_type: 'CTN40' }
    const options = [{ option_type: 'paper_qty', value: '1000', extra_price_krw: 50000 }]
    const exchangeRate = 1 / 1525
    const got = await computeOrderItemPriceUsd({ product, selectedOptions, options, exchangeRate })
    const legacy = calculateItemPriceUsd({
      basePriceKrw: 4000,
      marginMultiplier: 3.3,
      extraPricesKrw: buildOrderExtraPricesKrw(selectedOptions, options),
      exchangeRate,
    })
    expect(got).toBe(legacy)
  })
})
