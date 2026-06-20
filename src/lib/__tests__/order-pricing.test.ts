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

// OMO-3562: 플래그 ON → 청구가 = 매트릭스 표시가(buildSwadpiaPricingTable 와 동일 base) + 후가공.
//   과청구 legacy($116) 가 아닌 표시가($12.87) 로 청구됨을 증명(표시==청구).
import { vi } from 'vitest'
describe('computeOrderItemPriceUsd — 플래그 ON 매트릭스 일원화', () => {
  it('ON 시 청구가 = 매트릭스 base(표시가), legacy 과청구 아님', async () => {
    vi.resetModules()
    vi.stubEnv('ORDER_PRICE_MATRIX_ROUTING', 'on')
    vi.doMock('../swadpia', async (orig) => {
      const actual = (await orig()) as Record<string, unknown>
      return {
        ...actual,
        fetchSwadpiaCategoryData: async () => ({
          fetchSuccess: true,
          printEntries: [{ paper_code: 'SNW250W00', quantity: 1000, print_unit1: 0, print_unit2: 5950 }],
          papers: [], sizes: [], categoryCode: 'CNC1000', fetchedAt: 0,
        }),
      }
    })
    const { computeOrderItemPriceUsd: fn } = await import('../order-pricing')
    const { calculatePriceFromSwadpia, calculateItemPriceUsd: legacyFn } = await import('../pricing')
    const exchangeRate = 1 / 1525
    const product = { slug: 'business-cards', base_price_krw: 4000, margin_multiplier: 3.3 }
    const selectedOptions = { paper_code: 'SNW250W00', paper_qty: '1000' }
    const options = [{ option_type: 'paper_qty', value: '1000', extra_price_krw: 50000 }]
    const got = await fn({ product, selectedOptions, options, exchangeRate })
    const matrixDisplay = calculatePriceFromSwadpia({ swadpiaCostKrw: 5950, marginMultiplier: 3.3, exchangeRate })
    const legacyOvercharge = legacyFn({ basePriceKrw: 4000, marginMultiplier: 3.3, extraPricesKrw: [50000], exchangeRate })
    expect(got).toBe(matrixDisplay)           // == 표시가
    expect(got).toBeLessThan(legacyOvercharge) // legacy 과청구보다 낮음(~9×)
    vi.unstubAllEnvs()
    vi.doUnmock('../swadpia')
  })
})
