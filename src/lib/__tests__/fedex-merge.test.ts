// OMO-3458: 신/구 계약 요율 중 서비스별 최저가 cherry-pick 검증.
import { describe, it, expect } from 'vitest'
import { mergeCheapestByService, type FedexRateResult, type FedexRateOption } from '@/lib/fedex-api'

function opt(serviceType: string, charge: number): FedexRateOption {
  return { serviceType, serviceName: serviceType, totalNetCharge: charge, currency: 'KRW' }
}
function result(options: FedexRateOption[]): FedexRateResult {
  return { options, alerts: [], cheapest: options[0] ?? null }
}

describe('mergeCheapestByService (신/구 계약 최저가 cherry-pick)', () => {
  it('서비스별로 더 싼 계약을 고른다 (US=신계약 싸고, 한 서비스는 구계약 싸다)', () => {
    const newContract = result([opt('FEDEX_INTERNATIONAL_PRIORITY', 64920), opt('INTERNATIONAL_ECONOMY', 63660)])
    const oldContract = result([opt('FEDEX_INTERNATIONAL_PRIORITY', 101840), opt('INTERNATIONAL_ECONOMY', 50000)])
    const merged = mergeCheapestByService([newContract, oldContract])
    const byType = Object.fromEntries(merged.options.map((o) => [o.serviceType, o.totalNetCharge]))
    expect(byType['FEDEX_INTERNATIONAL_PRIORITY']).toBe(64920) // 신계약
    expect(byType['INTERNATIONAL_ECONOMY']).toBe(50000)        // 구계약
  })

  it('런던 케이스: 구계약(PRIORITY 38540)이 신계약(48410)보다 싸면 구계약 채택', () => {
    const newContract = result([opt('FEDEX_INTERNATIONAL_PRIORITY', 48410)])
    const oldContract = result([opt('FEDEX_INTERNATIONAL_PRIORITY', 38540)])
    const merged = mergeCheapestByService([newContract, oldContract])
    expect(merged.cheapest?.totalNetCharge).toBe(38540)
  })

  it('한 계약만 있으면 그 결과 그대로(구계약 미설정 시 기존 동작 보존)', () => {
    const only = result([opt('FEDEX_INTERNATIONAL_PRIORITY', 64920)])
    const merged = mergeCheapestByService([only])
    expect(merged.options).toHaveLength(1)
    expect(merged.cheapest?.totalNetCharge).toBe(64920)
  })

  it('전체 결과를 최저가 오름차순으로 정렬', () => {
    const a = result([opt('A', 300), opt('B', 100)])
    const b = result([opt('A', 250), opt('C', 50)])
    const merged = mergeCheapestByService([a, b])
    expect(merged.options.map((o) => o.totalNetCharge)).toEqual([50, 100, 250])
    expect(merged.cheapest?.serviceType).toBe('C')
  })
})
