import { describe, it, expect } from 'vitest'
import {
  cardFoilWholesaleKrw,
  cardEmbossWholesaleKrw,
  cardDieCutWholesaleKrw,
  cardFinishingWholesaleKrw,
  CARD_MATRIX_FINISHINGS,
} from '../finishing-card-matrix'

// OMO-3567: 명함 후가공 세부옵션 매트릭스 엔진 — OMO-3566 표집/OMO-3511 RE 기준값 ±0 검증.

const AREA_50x30 = 50 * 30

describe('cardFoilWholesaleKrw (박: 종류×면×면적×수량)', () => {
  it('BKT02 단면(BKD10) 50×30 — 샘플 포인트 정확일치', () => {
    expect(cardFoilWholesaleKrw({ quantity: 500, areaMm2: AREA_50x30 })).toBe(22300)
    expect(cardFoilWholesaleKrw({ quantity: 1000, areaMm2: AREA_50x30 })).toBe(40100)
    expect(cardFoilWholesaleKrw({ quantity: 5000, areaMm2: AREA_50x30 })).toBe(182400)
    expect(cardFoilWholesaleKrw({ quantity: 50000, areaMm2: AREA_50x30 })).toBe(1783300)
  })

  it('BKT02 양면(BKD30) — 단면보다 비싸고 샘플 정확일치', () => {
    expect(cardFoilWholesaleKrw({ quantity: 500, areaMm2: AREA_50x30, side: 'BKD30' })).toBe(41100)
    expect(cardFoilWholesaleKrw({ quantity: 5000, areaMm2: AREA_50x30, side: 'BKD30' })).toBe(361200)
    // 양면 > 단면
    expect(cardFoilWholesaleKrw({ quantity: 5000, areaMm2: AREA_50x30, side: 'BKD30' }))
      .toBeGreaterThan(cardFoilWholesaleKrw({ quantity: 5000, areaMm2: AREA_50x30, side: 'BKD10' }))
  })

  it('BKD20(후면) = BKD10(전면) 동가 (OMO-3566)', () => {
    expect(cardFoilWholesaleKrw({ quantity: 1000, areaMm2: AREA_50x30, side: 'BKD20' }))
      .toBe(cardFoilWholesaleKrw({ quantity: 1000, areaMm2: AREA_50x30, side: 'BKD10' }))
  })

  it('수량 미지정/0 → 0 (수량 의존 단가)', () => {
    expect(cardFoilWholesaleKrw({ quantity: 0, areaMm2: AREA_50x30 })).toBe(0)
  })

  it('수량 브래킷 내부 선형보간 (1500 ∈ [1000,2000])', () => {
    const v = cardFoilWholesaleKrw({ quantity: 1500, areaMm2: AREA_50x30 })
    expect(v).toBe(Math.round((40100 + 75700) / 2)) // 57900
  })

  it('미지정 종류/면 → BKT02/BKD10 폴백 (회귀 없음)', () => {
    expect(cardFoilWholesaleKrw({ quantity: 1000, areaMm2: AREA_50x30, bakType: 'BKT99', side: 'XXX' }))
      .toBe(40100)
  })

  it('현행 정액모델 대비 고수량 과소청구 제거(수량 반영)', () => {
    const q1000 = cardFoilWholesaleKrw({ quantity: 1000, areaMm2: AREA_50x30 })
    const q50000 = cardFoilWholesaleKrw({ quantity: 50000, areaMm2: AREA_50x30 })
    expect(q50000).toBeGreaterThan(q1000 * 10)
  })
})

describe('cardEmbossWholesaleKrw (형압: 면적×수량)', () => {
  it('50×30 — OMO-3511 기준값 정확일치', () => {
    expect(cardEmbossWholesaleKrw({ quantity: 500, areaMm2: AREA_50x30 })).toBe(21400)
    expect(cardEmbossWholesaleKrw({ quantity: 1000, areaMm2: AREA_50x30 })).toBe(35800)
    expect(cardEmbossWholesaleKrw({ quantity: 5000, areaMm2: AREA_50x30 })).toBe(151000)
  })

  it('큰 면적(60×40)이 작은 면적(10×10)보다 비싸다(스냅)', () => {
    const small = cardEmbossWholesaleKrw({ quantity: 5000, areaMm2: 10 * 10 })
    const large = cardEmbossWholesaleKrw({ quantity: 5000, areaMm2: 60 * 40 })
    expect(large).toBeGreaterThan(small)
  })
})

describe('cardDieCutWholesaleKrw (도무송: 모양×개수×수량)', () => {
  it('DMT51 n1 — 샘플 정확일치', () => {
    expect(cardDieCutWholesaleKrw({ quantity: 500 })).toBe(21500)
    expect(cardDieCutWholesaleKrw({ quantity: 1000 })).toBe(30000)
    expect(cardDieCutWholesaleKrw({ quantity: 5000 })).toBe(106000)
  })

  it('개수 증가 → 단가 증가(n2 > n1)', () => {
    expect(cardDieCutWholesaleKrw({ quantity: 1000, num: 2 }))
      .toBeGreaterThan(cardDieCutWholesaleKrw({ quantity: 1000, num: 1 }))
  })

  it('개수 클램프 1~4', () => {
    expect(cardDieCutWholesaleKrw({ quantity: 1000, num: 99 }))
      .toBe(cardDieCutWholesaleKrw({ quantity: 1000, num: 4 }))
    expect(cardDieCutWholesaleKrw({ quantity: 1000, num: 0 }))
      .toBe(cardDieCutWholesaleKrw({ quantity: 1000, num: 1 }))
  })

  it('사물모양(DMT53)이 라운드(DMT51)보다 비싸다', () => {
    expect(cardDieCutWholesaleKrw({ quantity: 1000, shape: 'DMT53' }))
      .toBeGreaterThan(cardDieCutWholesaleKrw({ quantity: 1000, shape: 'DMT51' }))
  })
})

describe('cardFinishingWholesaleKrw dispatcher', () => {
  it('매트릭스 커버 value 만 산출, 그 외 0', () => {
    expect(CARD_MATRIX_FINISHINGS.has('foil_stamp')).toBe(true)
    expect(cardFinishingWholesaleKrw('foil_stamp', 1000, { areaMm2: AREA_50x30 })).toBe(40100)
    expect(cardFinishingWholesaleKrw('deboss_emboss', 1000, { areaMm2: AREA_50x30 })).toBe(35800)
    expect(cardFinishingWholesaleKrw('die_cut', 1000)).toBe(30000)
    expect(cardFinishingWholesaleKrw('epoxy', 1000)).toBe(0) // 매트릭스 미커버 → 폴백
    expect(cardFinishingWholesaleKrw('round_corner', 1000)).toBe(0)
  })
})
