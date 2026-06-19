import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// OMO-3567: FINISHING_MATRIX_ROUTING 플래그가 박/형압/도무송 청구가 경로를 매트릭스로 라우팅하는지 검증.
//   플래그는 모듈 로드시 env 평가 → resetModules + stubEnv + dynamic import 로 ON/OFF 양쪽 확인.

describe('finishingSurchargeKrwFromOptions — 매트릭스 라우팅 플래그', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('플래그 OFF(기본) → 현행 면적선형 정액(수량 무시)', async () => {
    vi.stubEnv('NEXT_PUBLIC_FINISHING_MATRIX_ROUTING', '')
    const mod = await import('../finishing-surcharge')
    const lowQty = mod.finishingSurchargeKrwFromOptions(
      { finishing: 'foil_stamp', paper_qty: '500', bak_x_size_1: '50', bak_y_size_1: '30' },
    )
    const highQty = mod.finishingSurchargeKrwFromOptions(
      { finishing: 'foil_stamp', paper_qty: '50000', bak_x_size_1: '50', bak_y_size_1: '30' },
    )
    // OFF: 수량 무관 동일(현행 정액 면적모델, 50×30 = 22,300)
    expect(lowQty).toBe(22300)
    expect(highQty).toBe(22300)
  })

  it('플래그 ON → 박 50×30 수량 매트릭스(±0)', async () => {
    vi.stubEnv('NEXT_PUBLIC_FINISHING_MATRIX_ROUTING', 'on')
    const mod = await import('../finishing-surcharge')
    expect(mod.FINISHING_MATRIX_ROUTING).toBe(true)
    const q5000 = mod.finishingSurchargeKrwFromOptions(
      { finishing: 'foil_stamp', paper_qty: '5000', bak_x_size_1: '50', bak_y_size_1: '30' },
    )
    expect(q5000).toBe(182400) // BKT02.BKD10 50×30 @5000 (OMO-3566)
  })

  it('플래그 ON → 도무송 개수×수량 매트릭스', async () => {
    vi.stubEnv('NEXT_PUBLIC_FINISHING_MATRIX_ROUTING', 'on')
    const mod = await import('../finishing-surcharge')
    const n1 = mod.finishingSurchargeKrwFromOptions({ finishing: 'die_cut', paper_qty: '1000', domusong_num: '1' })
    const n3 = mod.finishingSurchargeKrwFromOptions({ finishing: 'die_cut', paper_qty: '1000', domusong_num: '3' })
    expect(n1).toBe(30000) // DMT51.n1 @1000
    expect(n3).toBeGreaterThan(n1) // 개수 증가 → 단가 증가
  })

  it('플래그 ON 이어도 수량 미지정 → 매트릭스 미적용(폴백)', async () => {
    vi.stubEnv('NEXT_PUBLIC_FINISHING_MATRIX_ROUTING', 'on')
    const mod = await import('../finishing-surcharge')
    const noQty = mod.finishingSurchargeKrwFromOptions(
      { finishing: 'foil_stamp', bak_x_size_1: '50', bak_y_size_1: '30' },
    )
    expect(noQty).toBe(22300) // 수량 없음 → 현행 정액 폴백
  })

  // OMO-3567: 표시가(ProductConfigurator finishingUnitUsd)↔청구가(finishingSurchargeKrwFromOptions)
  //   이중경로 정합. 둘 다 동일 cardFinishingWholesaleKrw(value, qty, detail) 를 호출해야 한다.
  //   ([[procardcrafters-dual-price-path]] — 미정합 시 고객 표시가≠청구가)
  it('플래그 ON → 단일 박레이어 청구가 = 표시가 코어(동일 cardFinishingWholesaleKrw)', async () => {
    vi.stubEnv('NEXT_PUBLIC_FINISHING_MATRIX_ROUTING', 'on')
    const billing = await import('../finishing-surcharge')
    const matrix = await import('../finishing-card-matrix')
    const qty = 5000
    const areaMm2 = 50 * 30
    // 청구가 경로(서버): finishing=foil_stamp + 단일 레이어 50×30
    const billed = billing.finishingSurchargeKrwFromOptions(
      { finishing: 'foil_stamp', paper_qty: String(qty), bak_x_size_1: '50', bak_y_size_1: '30' },
    )
    // 표시가 경로(클라 finishingUnitUsd): 레이어별 cardFinishingWholesaleKrw(기본 세부옵션)
    const displayed = matrix.cardFinishingWholesaleKrw('foil_stamp', qty, { areaMm2 })
    expect(billed).toBe(displayed)
    expect(billed).toBe(182400)
  })
})
