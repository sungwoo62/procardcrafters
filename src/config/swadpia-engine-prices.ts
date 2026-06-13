/**
 * 성원(swadpia) 자체 견적엔진 렌더 ±0 권위 가격표 (OMO-3105, 2026-06-13)
 *
 * 배경(OMO-3098/3105):
 *  - 종전 procard 는 generic JSON 엔드포인트의 `print_info1.print_unit2` 를 도매원가로
 *    직접 소비했으나, 이는 성원 견적엔진의 **성분(component)** 일 뿐 총액이 아니다.
 *    예) CNC1000 SNW250W00 양면 1000매: print_unit2=8,000 ≠ 엔진 공급가 8,400.
 *  - 또한 print_info1 의 paper_code 는 `SNW250CT0` 단일 격자라 250g/300g 용지선택이
 *    가격에 반영되지 않았다(실측 1000매 양면 250g 8,400 vs 300g 21,000, 2.5배 차이 무시).
 *  - 성원 전달가(=procard 실결제가)는 **VAT 포함 결제가**이므로 마진 기준원가도 VAT 포함값.
 *
 * 해결:
 *  - printing-site `scripts/swadpia/driver_cnc1000.cjs` 엔진렌더(#lbl_pay_amt)로 측정한
 *    **VAT 포함 결제가(KRW)** 를 (paper_code × 도수 × 수량) 키로 고정한다. 추정 0 — 전 행 라이브 ±0.
 *  - 수량은 **용지종속**: 250g 500단위/최소500, 300g 200단위/최소200 (단일 정적사다리 금지).
 *  - 소비처(ProductConfigurator)는 이 표가 있는 카테고리에 대해 print_info1 대신 본 표를 사용하고,
 *    수량 옵션도 선택된 용지의 사다리에서 파생한다.
 *
 * 검증 스팟(±0, OMO-3098): 250g양면 500→공급4,200/결제4,620, 1000→8,400/9,240,
 *   5000→34,000/37,400, 10000→61,000/67,100; 250g단면 1000→6,400; 300g양면 600→12,600,
 *   1000→21,000, 5000→105,000. 전체 사다리는 grid 렌더 결과.
 *
 * ⚠️ 미반영(후속): ① 규격(paper_size) 종속 가격(N0500 91×55 등은 N0100 대비 가산) — 본 표는
 *    표준 N0100 기준. ② 후가공 surcharge 는 별도(finishing-surcharge.ts) 경로 유지.
 *    ③ DB print_color_type=CTN99 라벨이 "Black & White"이나 성원 CTN99=인쇄없음 — 라벨 정정은 별건.
 */

export interface PaperLadder {
  /** 최소 주문 수량(매) */
  min: number
  /** 수량 증가 단위(매) */
  step: number
}

export interface EnginePriceTable {
  /** 성원 카테고리 코드 */
  categoryCode: string
  /** paperCode → printColorType → quantity(매) → VAT 포함 결제가(KRW). 추정 0, 엔진 ±0. */
  payKrw: Record<string, Record<string, Record<number, number>>>
  /** 용지별 수량 사다리 메타(UI 수량옵션 파생·스냅용) */
  ladder: Record<string, PaperLadder>
}

/**
 * CNC1000 (일반지명함) — 스노우지 백색 250g / 300g, 표준 규격(N0100 90×50mm).
 * payKrw = VAT 포함 결제가(#lbl_pay_amt). CTN40 양면 / CTN10 단면 / CTN99 인쇄없음.
 */
const CNC1000: EnginePriceTable = {
  categoryCode: 'CNC1000',
  payKrw: {
    SNW250W00: {
      // 양면칼라
      CTN40: { 500: 4620, 1000: 9240, 2000: 17380, 3000: 24420, 5000: 37400, 10000: 67100, 20000: 126500, 50000: 304700 },
      // 단면칼라
      CTN10: { 500: 3520, 1000: 7040, 2000: 14080, 3000: 20020, 5000: 31900, 10000: 61600, 20000: 107800, 50000: 255200 },
      // 인쇄없음(성원 엔진렌더상 단면과 동일가)
      CTN99: { 500: 3520, 1000: 7040, 2000: 14080, 3000: 20020, 5000: 31900, 10000: 61600, 20000: 107800, 50000: 255200 },
    },
    SNW300W00: {
      // 300g 사다리 최대 ~33,000매 — 50000 은 미취급(렌더 폴백값이라 표에서 제외).
      CTN40: { 200: 4620, 600: 13860, 1000: 23100, 2000: 46200, 3000: 69300, 5000: 115500, 10000: 209000, 20000: 385000 },
      CTN10: { 200: 3520, 600: 10560, 1000: 17600, 2000: 35200, 3000: 52800, 5000: 88000, 10000: 154000, 20000: 275000 },
      CTN99: { 200: 3520, 600: 10560, 1000: 17600, 2000: 35200, 3000: 52800, 5000: 88000, 10000: 154000, 20000: 275000 },
    },
  },
  ladder: {
    SNW250W00: { min: 500, step: 500 },
    SNW300W00: { min: 200, step: 200 },
  },
}

/**
 * 제품 slug → 엔진 권위 가격표.
 * 표가 있는 제품은 ProductConfigurator 가 generic print_info1 대신 본 표를 사용한다.
 * (현재 CNC1000 명함만. 추가 카테고리는 동일 패턴으로 라이브 ±0 렌더 후 등록.)
 */
export const ENGINE_PRICE_TABLES: Record<string, EnginePriceTable> = {
  'business-cards': CNC1000,
}

/** 표 전체에서 최저 VAT 포함 결제가(KRW) — 제품 "from" 시작가/JSON-LD lowPrice 정합용. */
export function engineMinPayKrw(table: EnginePriceTable): number | null {
  let min: number | null = null
  for (const byColor of Object.values(table.payKrw)) {
    for (const byQty of Object.values(byColor)) {
      for (const v of Object.values(byQty)) {
        if (v > 0 && (min === null || v < min)) min = v
      }
    }
  }
  return min
}

/** 선택된 용지에서 엔진표가 보유한 수량 사다리(오름차순)를 반환. 없으면 빈 배열. */
export function enginePaperQuantities(
  table: EnginePriceTable,
  paperCode: string,
  colorType: string,
): number[] {
  const byColor = table.payKrw[paperCode]
  if (!byColor) return []
  const byQty = byColor[colorType] ?? byColor[Object.keys(byColor)[0]]
  if (!byQty) return []
  return Object.keys(byQty)
    .map((q) => parseInt(q, 10))
    .filter((q) => Number.isFinite(q))
    .sort((a, b) => a - b)
}

export interface EnginePriceLookup {
  /** VAT 포함 결제가(KRW) — 마진 기준원가 */
  payKrw: number
  /** 실제 성원이 매기는 수량(요청수량을 사다리 상위로 스냅한 값) */
  effectiveQty: number
}

/**
 * (paper_code, color, 요청수량) → VAT 포함 결제가.
 * 정확수량이 없으면 해당 용지 사다리의 **상위 최근접 수량**으로 스냅(±0 보장, "추가매수 무료" UX).
 * 사다리 최대치를 초과하면 null(상위 호출자가 견적전환/폴백 처리).
 */
export function lookupEnginePay(
  table: EnginePriceTable,
  paperCode: string,
  colorType: string,
  quantity: number,
): EnginePriceLookup | null {
  const byColor = table.payKrw[paperCode]
  if (!byColor) return null
  const byQty = byColor[colorType] ?? byColor[Object.keys(byColor)[0]]
  if (!byQty) return null

  const qtys = Object.keys(byQty)
    .map((q) => parseInt(q, 10))
    .filter((q) => Number.isFinite(q))
    .sort((a, b) => a - b)
  if (qtys.length === 0) return null

  const exact = qtys.find((q) => q === quantity)
  if (exact !== undefined) return { payKrw: byQty[exact], effectiveQty: exact }

  const upper = qtys.find((q) => q >= quantity)
  if (upper !== undefined) return { payKrw: byQty[upper], effectiveQty: upper }

  // 사다리 최대 초과 — 안전하게 null(임의 하향 스냅 금지)
  return null
}
