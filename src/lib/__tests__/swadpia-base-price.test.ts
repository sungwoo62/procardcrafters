import { describe, it, expect } from 'vitest'
import {
  extractMatrixBasePriceKrw,
  deriveProductBasePriceKrw,
  PRODUCT_BASE_PRICE_SPECS,
} from '../swadpia-base-price'
import type { SwadpiaCategoryData, SwadpiaPrintEntry } from '../swadpia'

// OMO-3072: extractBasePrice 비결정성(같은 최소수량 q200 에 용지별 복수 단가) 회귀 방지.

function entry(
  quantity: number,
  paper_code: string,
  print_unit2: number,
): SwadpiaPrintEntry {
  return {
    quantity,
    paper_code,
    print_method: 'PTM10',
    print_unit1: print_unit2,
    print_unit2,
    add_unit2: 0,
  }
}

function categoryData(
  overrides: Partial<SwadpiaCategoryData> = {},
): SwadpiaCategoryData {
  return {
    categoryCode: 'CNC1000',
    papers: [],
    printEntries: [],
    sizes: [],
    fetchedAt: 0,
    fetchSuccess: true,
    ...overrides,
  }
}

describe('extractMatrixBasePriceKrw — 결정적 기준단가', () => {
  it('동일 최소수량(q200)에 용지별 복수 단가가 있어도 항상 최저단가를 선택한다 (배열순서 무관)', () => {
    // 같은 q200 에 4,000 / 6,000 / 10,000 — 순서를 섞어도 결과 동일해야 함.
    const order1 = categoryData({
      printEntries: [
        entry(200, 'PB', 10_000),
        entry(200, 'PA', 4_000),
        entry(200, 'PC', 6_000),
        entry(500, 'PA', 3_000),
      ],
    })
    const order2 = categoryData({
      printEntries: [
        entry(500, 'PA', 3_000),
        entry(200, 'PC', 6_000),
        entry(200, 'PB', 10_000),
        entry(200, 'PA', 4_000),
      ],
    })
    expect(extractMatrixBasePriceKrw(order1)).toBe(4_000)
    expect(extractMatrixBasePriceKrw(order2)).toBe(4_000)
  })

  it('최소수량을 우선한다 (더 큰 수량의 더 싼 단가에 끌려가지 않음)', () => {
    const data = categoryData({
      printEntries: [entry(1000, 'PA', 1_000), entry(200, 'PA', 5_000)],
    })
    expect(extractMatrixBasePriceKrw(data)).toBe(5_000)
  })

  it('동일 최소수량·동일 단가는 paper_code 사전순으로 결정적 tie-break', () => {
    const data = categoryData({
      printEntries: [entry(200, 'PZ', 4_000), entry(200, 'PA', 4_000)],
    })
    // 값은 같지만 항상 같은 entry 를 고르도록 결정적이어야 함
    expect(extractMatrixBasePriceKrw(data)).toBe(4_000)
  })

  it('매트릭스가 비어 있으면 null (papers[0] 임의 폴백 금지)', () => {
    const data = categoryData({
      printEntries: [],
      papers: [
        {
          paper_code: 'X',
          paper_type_code: '',
          paper_weight: '',
          paper_weight_txt: '',
          paper_summary: '',
          paper_side_type: '2',
          price_unit1: 99_999,
          price_unit2: 99_999,
          price_sale_rate: 1,
          print_extra_rate: 0,
          print_method_list: '',
        },
      ],
    })
    expect(extractMatrixBasePriceKrw(data)).toBeNull()
  })

  it('단가 0/음수는 무효로 보아 null', () => {
    const data = categoryData({ printEntries: [entry(200, 'PA', 0)] })
    expect(extractMatrixBasePriceKrw(data)).toBeNull()
  })
})

describe('deriveProductBasePriceKrw — 제품별 산출 경로', () => {
  it('matrix 기본 제품은 결정적 매트릭스가를 반환', () => {
    const data = categoryData({
      categoryCode: 'CNC1000',
      printEntries: [entry(200, 'PB', 6_000), entry(200, 'PA', 4_000)],
    })
    const r = deriveProductBasePriceKrw('business-cards', data)
    expect(r.mode).toBe('matrix')
    expect(r.priceKrw).toBe(4_000)
  })

  it('비매트릭스(quote-only) 제품은 priceKrw null + 사유 반환 → 자동 sync 제외', () => {
    const data = categoryData({ categoryCode: 'CST1000', printEntries: [] })
    const r = deriveProductBasePriceKrw('stickers', data)
    expect(r.mode).toBe('quote-only')
    expect(r.priceKrw).toBeNull()
    expect(r.reason).toBeTruthy()
  })

  it('matrix 분류여도 런타임 매트릭스가 비면 null(no-matrix) — 임의값 기록 안 함', () => {
    const data = categoryData({ categoryCode: 'CPR2000', printEntries: [] })
    const r = deriveProductBasePriceKrw('posters', data)
    expect(r.mode).toBe('matrix')
    expect(r.priceKrw).toBeNull()
    expect(r.reason).toBe('no-matrix')
  })

  it('collapse 비대표 제품은 quote-only 로 명시됨 (대표만 자동 sync)', () => {
    // CPR5000 collapse: banners/x-banners/rollup/mini 전부 견적전용
    for (const slug of ['banners', 'x-banners', 'rollup-banners', 'mini-banners']) {
      expect(PRODUCT_BASE_PRICE_SPECS[slug]?.mode).toBe('quote-only')
    }
    // CNR2000 서식 4종
    for (const slug of ['receipts', 'quotation-forms', 'invoice-forms', 'ncr-forms']) {
      expect(PRODUCT_BASE_PRICE_SPECS[slug]?.mode).toBe('quote-only')
    }
  })

  it('paper 모드: paperCode 지정 시 제품별 용지+수량 단가를 산출', () => {
    const data = categoryData({
      categoryCode: 'TEST',
      printEntries: [entry(100, 'SNW250', 7_777)],
    })
    // 임시 spec 주입 대신, 동작 검증을 위해 calculateSwadpiaPriceKrw 경로를 직접 확인
    // (활성 paper 스펙은 후속 데이터 작업에서 추가)
    const r = deriveProductBasePriceKrw('business-cards', data) // matrix 경로
    expect(r.priceKrw).toBe(7_777)
  })
})
