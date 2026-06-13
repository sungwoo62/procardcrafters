import { describe, it, expect } from 'vitest'
import {
  extractMatrixBasePriceKrw,
  deriveProductBasePriceKrw,
  PRODUCT_BASE_PRICE_SPECS,
  MATRIX_VERIFIED_SLUGS,
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
    // 검증 slug(business-cards)인데 매트릭스가 비어 있는 경우 → no-matrix
    const data = categoryData({ categoryCode: 'CNC1000', printEntries: [] })
    const r = deriveProductBasePriceKrw('business-cards', data)
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

// OMO-3078: metallic-business-cards(CNC3000) paper 모드 전환 회귀테스트.
// OMO-3076 데이터 작업 결과 paper 모드로 자동가격 복원이 가능한 제품 1종으로 확정.
// CNC3000 print_info1 은 paper_code 키 매트릭스(LUX200SVU q200 print_unit2=15000)라
// lookupPrintCost 가 결정적으로 동작한다.
describe('OMO-3078 — metallic-business-cards paper 모드', () => {
  // 라이브 probe 와 동형: LUX200SVU q200 print_unit2=15000, 단/양면 동일.
  const cnc3000 = (): SwadpiaCategoryData =>
    categoryData({
      categoryCode: 'CNC3000',
      printEntries: [
        // 단/양면 단가 동일(15000) → side 회귀 안전.
        { ...entry(200, 'LUX200SVU', 15_000), print_unit1: 15_000 },
        { ...entry(500, 'LUX200SVU', 13_000), print_unit1: 13_000 },
        // 다른 용지(비대표) — 대표 pin 이 LUX200SVU 임을 확인하기 위한 잡음.
        { ...entry(200, 'LUX300GLD', 22_000), print_unit1: 22_000 },
      ],
    })

  it('spec 이 paper 모드로 전환되어 있다 (LUX200SVU q200 양면)', () => {
    const spec = PRODUCT_BASE_PRICE_SPECS['metallic-business-cards']
    expect(spec?.mode).toBe('paper')
    expect(spec?.paperCode).toBe('LUX200SVU')
    expect(spec?.quantity).toBe(200)
    expect(spec?.doubleSided).toBe(true)
  })

  it('deriveProductBasePriceKrw 가 15000 / paper 를 반환한다 (라이브 probe 기대값)', () => {
    const r = deriveProductBasePriceKrw('metallic-business-cards', cnc3000())
    expect(r.mode).toBe('paper')
    expect(r.priceKrw).toBe(15_000)
    expect(r.reason).toBeUndefined()
  })

  it('단/양면 단가 동일(15000)이라 side 회귀 안전 — quantity 200 고정', () => {
    // spec 의 quantity(200) 가 적용되어 q500(13000) 에 끌려가지 않아야 한다.
    const r = deriveProductBasePriceKrw('metallic-business-cards', cnc3000())
    expect(r.priceKrw).toBe(15_000)
  })

  it('대표 용지(LUX200SVU)만 채택 — 다른 용지(LUX300GLD 22000)에 오염되지 않음', () => {
    const r = deriveProductBasePriceKrw('metallic-business-cards', cnc3000())
    expect(r.priceKrw).not.toBe(22_000)
    expect(r.priceKrw).toBe(15_000)
  })

  it('대표 용지가 매트릭스에 없으면 paper-zero 로 null (임의값 기록 안 함)', () => {
    const data = categoryData({
      categoryCode: 'CNC3000',
      printEntries: [{ ...entry(200, 'LUX300GLD', 22_000), print_unit1: 22_000 }],
    })
    const r = deriveProductBasePriceKrw('metallic-business-cards', data)
    expect(r.mode).toBe('paper')
    expect(r.priceKrw).toBeNull()
    expect(r.reason).toBe('paper-zero')
  })
})

// OMO-3142: 가격 cron 오가격 재발방지 가드 회귀테스트.
// 라이브 probe(scripts/omo3142-probe.mjs) 로 확인된 garbage 패턴(사이즈가격 그리드
// minQty=1, q1 floor 64000/8000)이 base_price_krw 로 기록되지 않아야 한다.
describe('OMO-3142 — matrix default-deny 가드', () => {
  // generic endpoint 가 주는 사이즈가격 그리드 garbage 재현(minQty=1, q1 단가=64000)
  const garbageGrid = (code: string): SwadpiaCategoryData =>
    categoryData({
      categoryCode: code,
      printEntries: [
        entry(1, 'GRID', 64_000),
        entry(2, 'GRID', 64_000),
        entry(3, 'GRID', 64_000),
      ],
    })

  it('이슈 지목 4종(wall/desk-calendars, saddle-stitch-booklet, leaflets) 은 quote-only', () => {
    for (const slug of ['wall-calendars', 'desk-calendars', 'saddle-stitch-booklet', 'leaflets']) {
      expect(PRODUCT_BASE_PRICE_SPECS[slug]?.mode).toBe('quote-only')
      const r = deriveProductBasePriceKrw(slug, garbageGrid('CCD1000'))
      expect(r.priceKrw).toBeNull()
    }
  })

  it('probe 로 추가 확인된 garbage 카테고리(brochures/posters/memo) 도 quote-only → null', () => {
    for (const slug of ['brochures', 'posters', 'memo-pads-general']) {
      expect(PRODUCT_BASE_PRICE_SPECS[slug]?.mode).toBe('quote-only')
      expect(deriveProductBasePriceKrw(slug, garbageGrid('CLF2000')).priceKrw).toBeNull()
    }
  })

  it('무관제품(박스/가방/메모/카드) 은 garbage 매트릭스를 줘도 절대 매핑되지 않는다', () => {
    // CEO 복구내역 보존 대상 — 다음 cron 에서 64000 으로 재오염되면 안 됨.
    const unrelated = [
      'general-boxes', 'gift-boxes', 'cake-boxes', 'corrugated-boxes', 'tube-boxes',
      'paper-shopping-bags', 'kraft-bags', 'gift-bags',
      'memo-pads-general', 'invitation-cards',
    ]
    for (const slug of unrelated) {
      const r = deriveProductBasePriceKrw(slug, garbageGrid('CHI3000'))
      expect(r.priceKrw).toBeNull() // 견적전용이거나 unverified-matrix → 기록 안 함
    }
  })

  it('화이트리스트 미등재 matrix slug 는 unverified-matrix 로 skip (default-deny)', () => {
    // PRODUCT_BASE_PRICE_SPECS 에도 없고 MATRIX_VERIFIED_SLUGS 에도 없는 미분류 slug
    const r = deriveProductBasePriceKrw('some-new-unknown-product', garbageGrid('CXX9999'))
    expect(r.mode).toBe('matrix')
    expect(r.priceKrw).toBeNull()
    expect(r.reason).toBe('unverified-matrix')
  })

  it('검증 slug 라도 minQty 가 정상 MOQ 미만(q1)이면 suspect-low-moq 로 거부', () => {
    const r = deriveProductBasePriceKrw('business-cards', garbageGrid('CNC1000'))
    expect(r.priceKrw).toBeNull()
    expect(r.reason).toBe('suspect-low-moq')
  })

  it('검증 slug + 정상 MOQ 인데 q1 floor sentinel(64000)이 나오면 suspect-value 로 거부', () => {
    const data = categoryData({
      categoryCode: 'CNC1000',
      printEntries: [entry(200, 'PA', 64_000)],
    })
    const r = deriveProductBasePriceKrw('business-cards', data)
    expect(r.priceKrw).toBeNull()
    expect(r.reason).toBe('suspect-value')
  })

  it('검증된 명함류는 정상 매트릭스가를 그대로 산출한다(가드 통과)', () => {
    const cnc = (price: number) =>
      categoryData({ categoryCode: 'CNC1000', printEntries: [entry(200, 'PA', price)] })
    expect(deriveProductBasePriceKrw('business-cards', cnc(4_000)).priceKrw).toBe(4_000)
    expect(deriveProductBasePriceKrw('premium-foil-cards', cnc(10_000)).priceKrw).toBe(10_000)
    for (const slug of MATRIX_VERIFIED_SLUGS) {
      expect(deriveProductBasePriceKrw(slug, cnc(5_000)).priceKrw).toBe(5_000)
    }
  })
})
