/**
 * OMO-3241 — 고객 가격경로 매트릭스 라우팅 (멀티사이즈/디지털/토너) · 서버 전용.
 *
 * 부모 OMO-3239 결정: 멀티사이즈·디지털·토너 제품은 성원 json_data 가 size 를 무시해
 * (전 size 동일 default 매트릭스 반환) 라이브 가격경로로 정확한 단가를 못 낸다. 대신
 * 오프라인 크롤러(OMO-3240)가 hidden `total_price`(=장바구니 등록가, 게이트1 동치)를
 * size/paper/side/print_color_type/qty 조합별로 표집해 `print_swadpia_price_matrix` 에
 * 적재한다. 고객 가격경로는 라이브 호출 없이 이 매트릭스를 **룩업**한다.
 *
 * ⚠️ 라이브 가격 변경 — 회귀 리스크. 컷오버는 두 게이트 통과 후에만:
 *   1) /admin/qa/swadpia-parity 매트릭스 vs 현행가 대조(parity)
 *   2) 보드 배포 승인 + 환경변수 `SWADPIA_MATRIX_ROUTING=on`
 * 플래그 OFF(기본)일 때 제품 페이지는 matrixData 를 전달하지 않으므로 단일포맷
 * (명함/스티커/봉투/캘린더) 및 전 제품의 기존 json_data 경로가 **그대로** 유지된다(회귀금지).
 *
 * 순수 룩업/보간 로직 + 타입은 클라이언트-안전한 swadpia-matrix-core 에 있다(configurator 공용).
 * 이 파일은 DB 접근(service_role)이 필요한 서버 전용 함수만 둔다.
 */
import { createServerClient } from './supabase'
import {
  lookupMatrixCell,
  type MatrixCell,
  type MatrixLookupKey,
  type MatrixLookupResult,
} from './swadpia-matrix-core'

export {
  MATRIX_ROUTED_CATEGORIES,
  isMatrixRoutedCategory,
  interpolateByQty,
  lookupMatrixCell,
} from './swadpia-matrix-core'
export type { MatrixCell, MatrixLookupKey, MatrixLookupResult } from './swadpia-matrix-core'

/**
 * 라이브 컷오버 플래그(보드 게이트). `on` 일 때만 제품 페이지가 매트릭스 슬라이스를
 * 로드해 configurator 로 전달한다. 그 외 값/미설정이면 OFF(기존 경로 유지).
 */
export function isMatrixRoutingEnabled(): boolean {
  return process.env.SWADPIA_MATRIX_ROUTING === 'on'
}

/**
 * 서버 — 한 category 의 매트릭스 슬라이스(전 조합/전 qty)를 로드한다.
 * 제품 페이지가 플래그 ON 일 때 호출해 configurator 로 내려보낸다.
 */
export async function fetchMatrixSlice(categoryCode: string): Promise<MatrixCell[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_swadpia_price_matrix')
    .select('size_code,paper_code,side,print_color_type,qty,total_price_krw,source')
    .eq('category_code', categoryCode)
  if (error || !data) return []
  return data as MatrixCell[]
}

/**
 * 서버 — 단건 매트릭스 룩업(슬라이스 로드 후 lookupMatrixCell). parity/API 용. 미스 → null.
 */
export async function lookupMatrixPriceKrw(key: MatrixLookupKey): Promise<MatrixLookupResult | null> {
  const cells = await fetchMatrixSlice(key.categoryCode)
  if (cells.length === 0) return null
  return lookupMatrixCell(cells, key)
}
