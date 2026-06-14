'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  ExternalLink,
} from 'lucide-react'

// OMO-3148: 보드 요청 — "기존버전처럼 클릭하면 뭐가 되어있고 표시되는" 인터랙티브 뷰.
// 정적 현황표(server page)에 행 클릭 → 펼침 상세(성원 라이브 vs 우리 적용 비교)를 추가한다.
// 읽기 전용(쓰기 엔드포인트 없음) — prod 공개 페이지에 안전. 상세는 read-only
// /api/swadpia-mapping/detail 만 호출한다.

const SWADPIA_BASE = 'https://www.swadpia.co.kr'

// 성원 goods_view 는 category_code + goods_code 둘 다 필요. goods_code 패턴:
// 'G' + category[1:-1] + '1' (예: CNC1000→GNC1001). (OMO-3058)
function swadpiaGoodsUrl(categoryCode: string | null): string {
  if (!categoryCode) return SWADPIA_BASE
  const goods = 'G' + categoryCode.slice(1, -1) + '1'
  return `${SWADPIA_BASE}/goods/goods_view/${categoryCode}/${goods}`
}

const OPTION_TYPE_LABEL: Record<string, string> = {
  paper_code: '용지', paper: '용지', print_color_type: '인쇄색상', paper_size: '사이즈',
  size: '사이즈', paper_qty: '수량', quantity: '수량', finishing: '후가공', finish: '후가공',
  coating: '코팅', corners: '모서리', sides: '인쇄면', pages: '페이지',
}

const krw = (n: number) => `₩${(n ?? 0).toLocaleString('ko-KR')}`

export type Row = {
  slug: string
  label: string
  code: string | null
  swadpiaName: string
  mapped: boolean
  warn: boolean
  unsupported: boolean
  unsupportedNote?: string
}
export type GroupWithRows = { key: string; title: string; rows: Row[] }

type Detail = {
  categoryCode: string | null
  swadpia: {
    fetchSuccess: boolean
    error?: string
    papers: { code: string; name: string; single: number; double: number }[]
    printMethods: string[]
    sizes: { code: string; name: string; mm: string }[]
    qtyLadder: number[]
    basePriceKrw: number
    printColors?: { code: string; label: string }[]
    finishings?: { code: string; label: string }[]
  }
  applied: {
    exists: boolean
    nameKo?: string
    basePriceKrw?: number
    marginMultiplier?: number
    sellPriceKrw?: number
    isActive?: boolean
    optionGroups: { optionType: string; count: number; samples: { value: string; label: string; extra: number }[] }[]
  }
}

export default function InteractiveMappingTable({ groups }: { groups: GroupWithRows[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Record<string, Detail | 'loading' | 'error'>>({})

  async function toggle(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
    if (!details[slug]) {
      setDetails((d) => ({ ...d, [slug]: 'loading' }))
      try {
        const res = await fetch(`/api/swadpia-mapping/detail?slug=${encodeURIComponent(slug)}`)
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as Detail
        setDetails((d) => ({ ...d, [slug]: json }))
      } catch {
        setDetails((d) => ({ ...d, [slug]: 'error' }))
      }
    }
  }

  return (
    <>
      {groups.map((group) => {
        const mappedN = group.rows.filter((r) => r.mapped).length
        return (
          <section key={group.key} className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              {group.title}{' '}
              <span className="text-sm font-normal text-gray-400">
                ({mappedN}/{group.rows.length} 연동)
              </span>
            </h2>
            <p className="mt-1 text-xs text-gray-400">행을 클릭하면 성원 라이브 옵션 ↔ 우리 적용 옵션 비교가 펼쳐집니다.</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
              <div className="hidden bg-gray-50 px-3 py-2 text-xs text-gray-500 sm:grid sm:grid-cols-[1.4fr_1.4fr_0.8fr_1.6fr_0.7fr] sm:gap-2">
                <div>우리 제품</div>
                <div>슬러그</div>
                <div>성원 코드</div>
                <div>성원 제품명</div>
                <div>상태</div>
              </div>
              <div className="divide-y divide-gray-100">
                {group.rows.map((r) => {
                  const isOpen = expanded.has(r.slug)
                  return (
                    <div key={r.slug} className={r.mapped ? '' : r.unsupported ? 'bg-gray-50' : 'bg-red-50/40'}>
                      <button
                        onClick={() => toggle(r.slug)}
                        className="grid w-full grid-cols-1 gap-1 px-3 py-2 text-left text-sm hover:bg-blue-50/40 sm:grid-cols-[1.4fr_1.4fr_0.8fr_1.6fr_0.7fr] sm:items-center sm:gap-2"
                      >
                        <div className="flex items-center gap-1 font-medium text-gray-900">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                          )}
                          {r.label}
                        </div>
                        <div className="font-mono text-xs text-gray-500 sm:pl-0 pl-5">{r.slug}</div>
                        <div className="font-mono text-xs text-gray-700 pl-5 sm:pl-0">{r.code ?? '—'}</div>
                        <div className="text-gray-700 pl-5 sm:pl-0">
                          {r.swadpiaName}
                          {r.warn && (
                            <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-600" />
                          )}
                          {r.unsupported && r.unsupportedNote && (
                            <span className="block text-xs text-gray-400">{r.unsupportedNote}</span>
                          )}
                        </div>
                        <div className="pl-5 sm:pl-0">
                          {r.mapped ? (
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <CheckCircle2 className="h-4 w-4" /> 연동
                            </span>
                          ) : r.unsupported ? (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <XCircle className="h-4 w-4" /> 미취급
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" /> 미연동
                            </span>
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3">
                          {/* 빠른 링크 */}
                          <div className="mb-1 flex flex-wrap gap-2 text-xs">
                            <a
                              href={`/products/${r.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 hover:bg-blue-100"
                            >
                              우리제품 <ExternalLink className="h-3 w-3" />
                            </a>
                            {r.code && (
                              <a
                                href={swadpiaGoodsUrl(r.code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 rounded border border-gray-300 bg-white px-1.5 py-0.5 font-medium text-gray-600 hover:bg-gray-50"
                              >
                                성원 {r.code} <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <DetailPanel detail={details[r.slug]} unsupported={r.unsupported} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </>
  )
}

function DetailPanel({
  detail,
  unsupported,
}: {
  detail: Detail | 'loading' | 'error' | undefined
  unsupported: boolean
}) {
  if (detail === 'loading' || !detail) {
    return (
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> 성원 라이브 + 우리 적용 항목 불러오는 중…
      </div>
    )
  }
  if (detail === 'error') {
    return (
      <div className="border-t border-gray-100 pt-3 text-xs text-amber-600">
        상세를 불러오지 못했습니다. 잠시 후 다시 클릭해 주세요.
      </div>
    )
  }
  const { swadpia, applied } = detail
  return (
    <div className="grid gap-4 border-t border-gray-100 pt-3 md:grid-cols-2">
      {/* 성원 스크랩 */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-gray-700">
          성원에서 스크랩한 항목{' '}
          <span className="font-normal text-gray-400">{detail.categoryCode ?? '(미연동)'}</span>
        </div>
        {!detail.categoryCode ? (
          <div className="text-xs text-gray-400">
            {unsupported ? '성원 미취급/타공급 — 대응 카테고리 없음.' : '성원 연동 없음.'}
          </div>
        ) : !swadpia.fetchSuccess ? (
          <div className="text-xs text-amber-600">성원 조회 실패: {swadpia.error ?? '알 수 없음'}</div>
        ) : (
          <div className="space-y-1.5 text-xs text-gray-600">
            <div>
              <span className="font-medium text-gray-700">기준단가</span> {krw(swadpia.basePriceKrw)}{' '}
              <span className="text-gray-400">(최소수량 양면)</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">용지 {swadpia.papers.length}종</span>:{' '}
              {swadpia.papers.slice(0, 6).map((p) => p.name).join(', ')}
              {swadpia.papers.length > 6 && ` 외 ${swadpia.papers.length - 6}`}
            </div>
            {swadpia.printMethods.length > 0 && (
              <div><span className="font-medium text-gray-700">인쇄방식</span>: {swadpia.printMethods.join(', ')}</div>
            )}
            {swadpia.sizes.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">사이즈 {swadpia.sizes.length}종</span>:{' '}
                {swadpia.sizes.slice(0, 5).map((s) => s.name || s.code).join(', ')}
                {swadpia.sizes.length > 5 && ' …'}
              </div>
            )}
            {swadpia.qtyLadder.length > 0 && (
              <div><span className="font-medium text-gray-700">수량단계</span>: {swadpia.qtyLadder.join(' / ')}</div>
            )}
            {/* OMO-3148: goods_view HTML 에서 별도 스크랩 (json_data 엔 없는 항목) */}
            {swadpia.printColors && swadpia.printColors.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">인쇄색상 {swadpia.printColors.length}종</span>:{' '}
                {swadpia.printColors.map((p) => p.label).join(', ')}
                <span className="ml-1 text-[10px] text-gray-400">(goods_view)</span>
              </div>
            )}
            {swadpia.finishings && swadpia.finishings.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">후가공 {swadpia.finishings.length}종</span>:{' '}
                {swadpia.finishings.map((f) => f.label).join(', ')}
                <span className="ml-1 text-[10px] text-gray-400">(goods_view)</span>
              </div>
            )}
          </div>
        )}
      </div>
      {/* 우리 적용 */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-gray-700">우리 사이트에 적용된 옵션</div>
        {!applied.exists ? (
          <div className="text-xs text-gray-400">print_products 에 제품 행 없음(미판매/구성 전).</div>
        ) : (
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="rounded bg-emerald-50 px-2 py-1.5 text-emerald-900">
              <span className="font-medium">기준가(원가)</span> {krw(applied.basePriceKrw ?? 0)}
              {' → '}
              <span className="font-semibold">판매가 {krw(applied.sellPriceKrw ?? 0)}</span>
              <span className="text-emerald-700"> (마진 ×{applied.marginMultiplier ?? 3.3})</span>
            </div>
            <div>고객노출 {applied.isActive ? 'ON' : 'OFF'}</div>
            {applied.optionGroups.length === 0 ? (
              <div className="text-gray-400">설정된 옵션 없음.</div>
            ) : (
              applied.optionGroups.map((g) => (
                <div key={g.optionType}>
                  <span className="font-medium text-gray-700">
                    {OPTION_TYPE_LABEL[g.optionType] ?? g.optionType} {g.count}개
                  </span>
                  :{' '}
                  {g.samples
                    .map((s) => (s.extra ? `${s.label}(+${krw(s.extra)})` : s.label))
                    .join(', ')}
                  {g.count > g.samples.length && ` 외 ${g.count - g.samples.length}`}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
