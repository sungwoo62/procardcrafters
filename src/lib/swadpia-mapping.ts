/**
 * OMO-3058: 성원 맵핑 관리 — 링크 파싱 · 옵션 핑거프린트 · 라이브 검증.
 *
 * 보드가 붙인 성원 상품 링크에서 category_code 를 뽑아 라이브로 검증하고,
 * 옵션 구성을 핑거프린트로 스냅샷한다. 드리프트 모니터가 이 핑거프린트를
 * 비교해 성원쪽 변경(맵핑/옵션 어긋남)을 감지한다.
 */
import {
  fetchSwadpiaCategoryDataByCode,
  type SwadpiaCategoryData,
} from '@/lib/swadpia'

/** 성원 category_code 형식: 영문 3~4자 + 숫자 4자리 (예: CNC1000, CPR5000) */
const CATEGORY_CODE_RE = /\b([A-Z]{3,4}\d{4})\b/

/**
 * 성원 링크/문자열에서 category_code 를 추출한다.
 * 지원: /goods/goods_view/CNC1000, ?category_code=CNC1000, 코드 직접 입력.
 */
export function parseSwadpiaCategoryCode(input: string): string | null {
  if (!input) return null
  const raw = input.trim()

  // 1) query string ?category_code=...
  try {
    const u = new URL(raw)
    const qp = u.searchParams.get('category_code')
    if (qp && CATEGORY_CODE_RE.test(qp)) return qp.toUpperCase()
    // 2) path segment /goods_view/CNC1000
    const seg = u.pathname.split('/').reverse().find((s) => CATEGORY_CODE_RE.test(s))
    if (seg) return (seg.match(CATEGORY_CODE_RE) as RegExpMatchArray)[1].toUpperCase()
  } catch {
    // URL 이 아니면 아래 일반 매칭으로
  }

  // 3) 문자열 어디든 코드 패턴
  const m = raw.toUpperCase().match(CATEGORY_CODE_RE)
  return m ? m[1] : null
}

/** 드리프트 비교용 안정 핑거프린트 */
export interface SwadpiaFingerprint {
  paperCount: number
  paperCodes: string[]
  printMethods: string[]
  sizeCodes: string[]
  qtyLadder: number[]
  basePrice: number
}

export function computeFingerprint(data: SwadpiaCategoryData): SwadpiaFingerprint {
  const paperCodes = [...new Set(data.papers.map((p) => p.paper_code))].sort()
  const printMethods = [
    ...new Set(data.printEntries.map((e) => e.print_method).filter(Boolean)),
  ].sort()
  const sizeCodes = [...new Set(data.sizes.map((s) => s.size_type_code))].sort()
  const qtyLadder = [...new Set(data.printEntries.map((e) => e.quantity))].sort(
    (a, b) => a - b,
  )
  const sortedByQty = [...data.printEntries].sort((a, b) => a.quantity - b.quantity)
  const basePrice = sortedByQty.length > 0 ? sortedByQty[0].print_unit2 : 0
  return {
    paperCount: data.papers.length,
    paperCodes,
    printMethods,
    sizeCodes,
    qtyLadder,
    basePrice,
  }
}

export interface VerifyResult {
  ok: boolean
  categoryCode: string | null
  fingerprint?: SwadpiaFingerprint
  paperCount: number
  sizeCount: number
  error?: string
}

/**
 * 성원 링크(또는 코드)를 검증한다: 코드 추출 → 라이브 json_data 조회 →
 * 용지/사이즈가 실제로 존재하면 통과. 핑거프린트도 함께 반환(스냅샷용).
 */
export async function verifySwadpiaLink(input: string): Promise<VerifyResult> {
  const categoryCode = parseSwadpiaCategoryCode(input)
  if (!categoryCode) {
    return {
      ok: false,
      categoryCode: null,
      paperCount: 0,
      sizeCount: 0,
      error: '링크에서 성원 category_code(예: CNC1000)를 찾지 못했습니다.',
    }
  }
  const data = await fetchSwadpiaCategoryDataByCode(categoryCode)
  if (!data.fetchSuccess) {
    return {
      ok: false,
      categoryCode,
      paperCount: 0,
      sizeCount: 0,
      error: data.errorMessage ?? '성원 조회 실패',
    }
  }
  const hasData = data.papers.length > 0 || data.printEntries.length > 0
  return {
    ok: hasData,
    categoryCode,
    fingerprint: computeFingerprint(data),
    paperCount: data.papers.length,
    sizeCount: data.sizes.length,
    error: hasData ? undefined : '유효한 용지/가격 데이터가 없습니다(코드 확인 필요).',
  }
}

/**
 * 두 핑거프린트를 비교해 사람이 읽을 변경 요약 + 제안 개선책을 만든다.
 * 변경 없으면 null.
 */
export function diffFingerprint(
  prev: SwadpiaFingerprint | null | undefined,
  next: SwadpiaFingerprint,
): { summary: string; suggestion: string } | null {
  if (!prev) return null
  const changes: string[] = []
  const arrDiff = (label: string, a: string[] | number[], b: string[] | number[]) => {
    const sa = new Set(a.map(String))
    const sb = new Set(b.map(String))
    const removed = [...sa].filter((x) => !sb.has(x))
    const added = [...sb].filter((x) => !sa.has(x))
    if (removed.length || added.length) {
      changes.push(
        `${label}: ${removed.length ? `삭제[${removed.join(',')}] ` : ''}${added.length ? `추가[${added.join(',')}]` : ''}`.trim(),
      )
    }
  }
  arrDiff('용지', prev.paperCodes, next.paperCodes)
  arrDiff('인쇄방식', prev.printMethods, next.printMethods)
  arrDiff('사이즈', prev.sizeCodes, next.sizeCodes)
  arrDiff('수량단계', prev.qtyLadder, next.qtyLadder)
  if (prev.basePrice !== next.basePrice) {
    const pct =
      prev.basePrice > 0
        ? Math.round(((next.basePrice - prev.basePrice) / prev.basePrice) * 100)
        : 0
    changes.push(`기준단가: ${prev.basePrice}→${next.basePrice}원 (${pct >= 0 ? '+' : ''}${pct}%)`)
  }
  if (changes.length === 0) return null

  const optionChanged =
    prev.paperCodes.join() !== next.paperCodes.join() ||
    prev.printMethods.join() !== next.printMethods.join() ||
    prev.sizeCodes.join() !== next.sizeCodes.join()
  const suggestion = optionChanged
    ? '성원 옵션 구성이 변경됨 → 해당 제품의 옵션 시드(print_swadpia_options)와 자동발주 필드 매핑을 재검증/갱신하세요. 변경이 의도된 것이면 맵핑 페이지에서 재검증 버튼으로 핑거프린트를 재스냅샷하면 알림이 해제됩니다.'
    : '가격만 변경됨 → base_price 동기화(update-prices 크론)로 흡수됩니다. 마진 영향만 확인하세요.'

  return { summary: changes.join(' · '), suggestion }
}
