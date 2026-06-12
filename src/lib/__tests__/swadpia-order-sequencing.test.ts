/**
 * OMO-3033 — 책자 PUR무선(BDT6) 자동발주 시퀀싱 단위 검증
 *
 * selectOrderOptions 의 옵션 적용 순서/수량 스냅 로직을 순수 헬퍼로 분리해
 * Playwright(라이브 폼) 없이 검증한다. 핵심 보장:
 *  - 책자 binding_type(=print_color_type alias) 은 deferred 로 분류되어
 *    표지 용지(paper_code)·사이즈 등 선행 옵션 "뒤에" 설정된다.
 *  - 수량 스냅(OMO-2485)은 종이별 수량 사다리 리로드를 견딘다.
 *
 * 실행: npx vitest run src/lib/__tests__/swadpia-order-sequencing.test.ts
 */
import { describe, it, expect } from 'vitest'
import { partitionOptionKeys, snapQuantity } from '../swadpia-order'

// CPR4000(책자) alias: paper_code→cover_paper_code, print_color_type→binding_type, paper_qty→bundle_qty
const CPR4000_ALIAS = {
  paper_code: 'cover_paper_code',
  print_color_type: 'binding_type',
  paper_qty: 'bundle_qty',
}

describe('partitionOptionKeys (OMO-3033 시퀀싱)', () => {
  it('책자: binding_type 으로 alias 되는 print_color_type 은 deferred, 표지/사이즈는 immediate', () => {
    const { immediate, deferred } = partitionOptionKeys(
      { paper_code: 'ARE160W00', print_color_type: 'BDT6', paper_size: 'CPR11', paper_qty: '50' },
      CPR4000_ALIAS,
    )
    expect(deferred).toEqual(['print_color_type'])
    // paper_code/paper_size 는 즉시, paper_qty 는 수량 경로라 제외
    expect(immediate.sort()).toEqual(['paper_code', 'paper_size'])
    expect(immediate).not.toContain('paper_qty')
  })

  it('binding_type 은 항상 immediate 보다 뒤에 적용되도록 분리된다', () => {
    const { immediate, deferred } = partitionOptionKeys(
      { print_color_type: 'BDT6', paper_code: 'ARE160W00' },
      CPR4000_ALIAS,
    )
    // 종속 필드는 immediate 어디에도 포함되지 않음 → selectOrderOptions 가 immediate→수량→deferred 순으로 적용
    expect(immediate).not.toContain('print_color_type')
    expect(deferred).toContain('print_color_type')
  })

  it('명함 등 alias 없는 카테고리: binding 종속 필드 없음 → 전부 immediate', () => {
    const { immediate, deferred } = partitionOptionKeys(
      { paper_code: 'ARM230W00', print_color_type: '4', paper_size: 'M1' },
      {},
    )
    expect(deferred).toEqual([])
    expect(immediate.sort()).toEqual(['paper_code', 'paper_size', 'print_color_type'])
  })

  it('수량(quantity/paper_qty)·후가공 키는 immediate/deferred 양쪽에서 제외', () => {
    const { immediate, deferred } = partitionOptionKeys(
      { paper_code: 'ARE160W00', quantity: '100', paper_qty: '50', bak_type: 'M100' },
      CPR4000_ALIAS,
    )
    expect(immediate).toEqual(['paper_code'])
    expect(deferred).toEqual([])
  })
})

describe('snapQuantity (OMO-2485 수량 사다리 스냅)', () => {
  it('요청 수량이 옵션에 있으면 그대로', () => {
    expect(snapQuantity([200, 400, 600], 200)).toBe(200)
  })

  it('없으면 요청치 이상 중 최소로 스냅 (ARM230W00: 300단위)', () => {
    expect(snapQuantity([300, 600, 900], 200)).toBe(300)
  })

  it('요청치 이상이 없으면 최대로 스냅', () => {
    expect(snapQuantity([300, 600], 1000)).toBe(600)
  })

  it('옵션 비어있으면 요청치 유지', () => {
    expect(snapQuantity([], 200)).toBe(200)
  })
})
