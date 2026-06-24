import type { PrintProduct, PrintProductOption } from '@/types/database'

// OMO-3812: 클라이언트(RSC props)로 직렬화되는 객체에서 고객 비노출 필드를 제거한다.
// `*_ko`(한글 DB 필드)와 공급사 내부 메타(print_method_list 등)는 고객 화면 렌더에 전혀 쓰이지
// 않으므로 props 페이로드에서 빼면 ① raw-HTML grep 한글 0 ② <script> 직렬화 슬림화를 달성한다.
// 주의: admin/server 경로의 select('*')는 그대로 유지 — 공급사/관리자 로직이 `_ko`를 쓸 수 있다.
//   여기서 정리하는 건 "클라이언트 컴포넌트로 내려가는 prop"뿐이다.
const SUPPLIER_INTERNAL_KEYS = new Set(['print_method_list'])

function stripClientFields<T extends object>(row: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    // `_ko`로 끝나는 컬럼 + 공급사 내부 메타는 클라이언트로 내려보내지 않는다.
    if (key.endsWith('_ko')) continue
    if (SUPPLIER_INTERNAL_KEYS.has(key)) continue
    out[key] = value
  }
  return out as T
}

export function toClientProduct(product: PrintProduct): PrintProduct {
  return stripClientFields(product)
}

export function toClientOptions(options: PrintProductOption[]): PrintProductOption[] {
  return options.map((option) => stripClientFields(option))
}
