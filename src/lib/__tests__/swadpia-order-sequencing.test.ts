/**
 * OMO-3033 / OMO-3041 — 책자 PUR무선(BDT6) 자동발주 시퀀싱·기본값 단위 검증
 *
 * selectOrderOptions 의 옵션 적용 순서 로직과 책자 내지 페이지수 기본값 주입을
 * 순수 헬퍼로 분리해 Playwright(라이브 폼) 없이 검증한다. 핵심 보장:
 *  - 책자 binding_type(=print_color_type alias) 은 deferred 로 분류되어
 *    표지 용지(paper_code)·사이즈 등 선행 옵션 "뒤에" 설정된다(OMO-3033).
 *  - 책자(CPR4000) 발주는 in_page_qty 부재 시 기본 64p 가 주입되고, 입력 값이
 *    있으면 존중된다(OMO-3041).
 *
 * 실행: npx vitest run src/lib/__tests__/swadpia-order-sequencing.test.ts
 */
import { describe, it, expect } from 'vitest'
import { partitionOptionKeys, withBookletInPageQtyDefault } from '../swadpia-order'

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

describe('withBookletInPageQtyDefault (OMO-3041 내지 페이지수 기본값)', () => {
  it('책자(CPR4000): in_page_qty 부재 시 기본 64p 주입', () => {
    const out = withBookletInPageQtyDefault('CPR4000', { paper_code: 'ARE160W00', print_color_type: 'BDT6' })
    expect(out.in_page_qty).toBe('64')
    // 원본 키는 보존
    expect(out.paper_code).toBe('ARE160W00')
  })

  it('책자: in_page_qty 입력 값이 있으면 존중(덮어쓰지 않음)', () => {
    const out = withBookletInPageQtyDefault('CPR4000', { in_page_qty: '128', print_color_type: 'BDT6' })
    expect(out.in_page_qty).toBe('128')
  })

  it('책자: in_page_qty<32 입력도 그대로 통과(조용한 끌어올림 금지 — deferred 검증이 중단)', () => {
    const out = withBookletInPageQtyDefault('CPR4000', { in_page_qty: '16' })
    expect(out.in_page_qty).toBe('16')
  })

  it('비-책자 카테고리(명함 등): in_page_qty 주입하지 않고 그대로 통과', () => {
    const input = { paper_code: 'ARM230W00', print_color_type: '4' }
    const out = withBookletInPageQtyDefault('CST5000', input)
    expect(out.in_page_qty).toBeUndefined()
    expect(out).toBe(input) // 비-책자는 동일 참조 반환(무변경)
  })
})
