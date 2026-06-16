/**
 * OMO-3241 — 매트릭스 라우팅 클라이언트-안전 코어(순수 함수만, 서버 import 없음).
 *
 * configurator(클라이언트 컴포넌트)가 import 하므로 여기엔 supabase/server 코드 금지.
 * DB 접근(fetchMatrixSlice 등)은 swadpia-matrix.ts(서버 전용)에 둔다.
 */

/**
 * 매트릭스 라우팅 대상 성원 category_code 집합.
 * = OMO-3240 적재 커버리지(멀티사이즈/디지털/토너). 단일포맷은 의도적으로 제외.
 *   CPR3000 leaflets · CPR2000 posters · CPR4000 booklets/catalogs ·
 *   CLF2000 brochures/menus · CDP3000 postcards(디지털) · COD1100 paper-pop(토너/미니배너)
 */
export const MATRIX_ROUTED_CATEGORIES = new Set<string>([
  'CPR3000',
  'CPR2000',
  'CPR4000',
  'CLF2000',
  'CDP3000',
  'COD1100',
])

export function isMatrixRoutedCategory(categoryCode: string | null | undefined): boolean {
  return !!categoryCode && MATRIX_ROUTED_CATEGORIES.has(categoryCode)
}

/**
 * 카테고리별 매트릭스 축 매핑(라이브 적재 대조로 검증 — OMO-3241).
 * size_code/paper_code 는 DB 옵션 value 가 성원 코드와 직접 일치(검증 완료)하므로 그대로 쓴다.
 * 인쇄축만 제품군마다 다르다:
 *   · leaflets/menus(CPR3000/CLF2000): print_color_type=PTM10/PTM20 → 매트릭스 pct 직접.
 *   · booklets(CPR4000): print_color_type=BDT4/BDT6 → 매트릭스 pct 직접(BDT2 중철은 DB 미제공).
 *   · posters(CPR2000): 인쇄축 없음 → 매트릭스 pct='' side=1.
 *   · postcards(CDP3000): 디지털 단/양면을 DB print_color_type DPD10/DPD20 로 인코딩하나
 *     매트릭스는 이를 **side**(1/2)로 담는다(pct=''). → side 변환 필요.
 *   · paper-pop(COD1100): DB 옵션이 generic 플레이스홀더(S1/PP1)라 매트릭스 코드와 불일치 →
 *     항상 미스 → 폴백(현행 유지). 적재 후 옵션 정규화는 후속.
 */
export interface MatrixAxisConfig {
  /** true 면 selections.print_color_type 를 매트릭스 pct 로 직접 사용. */
  pctFromPrintColor?: boolean
  /** 매트릭스 side 를 DB print_color_type 값으로 구동(디지털 단/양면). */
  sideFromPrintColor?: Record<string, number>
}

export const MATRIX_AXIS: Record<string, MatrixAxisConfig> = {
  CPR3000: { pctFromPrintColor: true },                    // leaflets
  CLF2000: { pctFromPrintColor: true },                    // menus/brochures
  CPR4000: { pctFromPrintColor: true },                    // booklets/catalogs
  CPR2000: {},                                             // posters (pct='' side=1)
  CDP3000: { sideFromPrintColor: { DPD10: 1, DPD20: 2 } }, // postcards (digital 단/양면→side)
  COD1100: {},                                             // paper-pop (generic opts → fallback)
}

/**
 * 고객 선택(selections) + categoryCode → 매트릭스 룩업 키(qty 제외).
 * 라우팅 비대상이면 null. 인쇄축은 MATRIX_AXIS 로 카테고리별 변환.
 */
export function deriveMatrixKey(
  categoryCode: string,
  selections: Record<string, string | undefined>,
): { sizeCode?: string; paperCode?: string; side?: number; printColorType: string } | null {
  if (!MATRIX_ROUTED_CATEGORIES.has(categoryCode)) return null
  const axis = MATRIX_AXIS[categoryCode] ?? {}
  const sizeCode = selections['paper_size'] || selections['size'] || undefined
  const paperCode = selections['paper_code'] || selections['paper'] || undefined
  const printColorType = axis.pctFromPrintColor ? selections['print_color_type'] || '' : ''
  const side = axis.sideFromPrintColor
    ? axis.sideFromPrintColor[selections['print_color_type'] ?? '']
    : undefined
  return { sizeCode, paperCode, side, printColorType }
}

/** configurator 로 내려보내는 최소 매트릭스 행(클라이언트 직렬화 대상). */
export interface MatrixCell {
  size_code: string
  paper_code: string
  side: number
  print_color_type: string
  qty: number
  total_price_krw: number
  source: 'sampled' | 'interpolated'
}

export interface MatrixLookupKey {
  categoryCode: string
  sizeCode?: string
  paperCode?: string
  side?: number
  printColorType?: string
  qty: number
}

export interface MatrixLookupResult {
  /** hidden total_price(원화) — 성원에 지불하는 도매 총액(=장바구니 등록가). */
  totalPriceKrw: number
  /** sampled = 표본 직접일치 / interpolated = qty 보간 / clamped = qty 표본 범위 밖 끝값 고정 */
  source: 'sampled' | 'interpolated' | 'clamped'
  /** 보간/고정에 사용한 표본 qty(또는 정확매치 qty) */
  resolvedQty: number
  combo: { sizeCode: string; paperCode: string; side: number; printColorType: string }
}

/**
 * 단일 조합(size/paper/side/pct)의 qty 시계열에서 qty 가격을 보간한다(piecewise-linear).
 * 정확 qty → sampled · 사이 → interpolated · 범위 밖 → clamped(끝값).
 * 입력 rows 는 모두 동일 조합이라고 가정(호출측 필터링).
 */
export function interpolateByQty(
  rows: Array<{ qty: number; total_price_krw: number }>,
  qty: number,
): { totalPriceKrw: number; source: 'sampled' | 'interpolated' | 'clamped'; resolvedQty: number } | null {
  const series = rows
    .filter((r) => Number.isFinite(r.total_price_krw) && r.total_price_krw > 0)
    .sort((a, b) => a.qty - b.qty)
  if (series.length === 0) return null

  const exact = series.find((r) => r.qty === qty)
  if (exact) return { totalPriceKrw: exact.total_price_krw, source: 'sampled', resolvedQty: exact.qty }

  const min = series[0]
  const max = series[series.length - 1]
  if (qty <= min.qty) return { totalPriceKrw: min.total_price_krw, source: 'clamped', resolvedQty: min.qty }
  if (qty >= max.qty) return { totalPriceKrw: max.total_price_krw, source: 'clamped', resolvedQty: max.qty }

  let lo = min
  let hi = max
  for (let i = 0; i < series.length - 1; i++) {
    if (series[i].qty <= qty && series[i + 1].qty >= qty) {
      lo = series[i]
      hi = series[i + 1]
      break
    }
  }
  const span = hi.qty - lo.qty
  const ratio = span > 0 ? (qty - lo.qty) / span : 0
  const price = Math.round(lo.total_price_krw + (hi.total_price_krw - lo.total_price_krw) * ratio)
  return { totalPriceKrw: price, source: 'interpolated', resolvedQty: qty }
}

function filterCells(
  cells: MatrixCell[],
  key: Pick<MatrixLookupKey, 'sizeCode' | 'paperCode' | 'side' | 'printColorType'>,
): MatrixCell[] {
  return cells.filter((c) => {
    if (key.sizeCode !== undefined && c.size_code !== key.sizeCode) return false
    if (key.paperCode !== undefined && c.paper_code !== key.paperCode) return false
    if (key.side !== undefined && c.side !== key.side) return false
    if (key.printColorType !== undefined && c.print_color_type !== key.printColorType) return false
    return true
  })
}

function comboKey(c: MatrixCell): string {
  return `${c.size_code}|${c.paper_code}|${c.side}|${c.print_color_type}`
}

function isSingleCombo(cells: MatrixCell[]): boolean {
  if (cells.length === 0) return false
  const first = comboKey(cells[0])
  return cells.every((c) => comboKey(c) === first)
}

/**
 * 이미 로드된 매트릭스 슬라이스(MatrixCell[])에서 가격을 룩업한다.
 * 미스(조합 부재/모호) → null → 호출측이 기존 경로로 폴백(회귀금지).
 */
export function lookupMatrixCell(cells: MatrixCell[], key: MatrixLookupKey): MatrixLookupResult | null {
  let filtered = filterCells(cells, key)
  if (filtered.length === 0) return null

  if (!isSingleCombo(filtered)) {
    // print_color_type 미지정이 흔한 모호 원인 → 빈 pct('') 셀로 좁혀본다.
    if (key.printColorType === undefined) {
      const blank = filtered.filter((c) => c.print_color_type === '')
      if (blank.length > 0 && isSingleCombo(blank)) filtered = blank
    }
    if (!isSingleCombo(filtered)) return null
  }

  const interp = interpolateByQty(filtered, key.qty)
  if (!interp) return null
  const c = filtered[0]
  return {
    totalPriceKrw: interp.totalPriceKrw,
    source: interp.source,
    resolvedQty: interp.resolvedQty,
    combo: { sizeCode: c.size_code, paperCode: c.paper_code, side: c.side, printColorType: c.print_color_type },
  }
}
