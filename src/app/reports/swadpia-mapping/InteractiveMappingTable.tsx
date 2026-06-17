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
    optionGroups: { optionType: string; count: number; labels?: string[]; samples: { value: string; label: string; extra: number }[] }[]
  }
}

// ── OMO-3187: 항목군 누락 비교 ──────────────────────────────
// 성원 스크랩 ↔ 우리 적용을 "동일 의미 그룹(축)"끼리 정규화 매칭해 누락을 표시한다.
// 정규화 기준: 공백·대소문자·괄호·구분기호 제거 후 비교(완전 일치 어려우면 한쪽 전용으로 표기).
type AxisKey = 'paper' | 'color' | 'size' | 'qty' | 'finish'
const AXES: { key: AxisKey; title: string }[] = [
  { key: 'paper', title: '용지' },
  { key: 'color', title: '인쇄색상' },
  { key: 'size', title: '사이즈' },
  { key: 'qty', title: '수량' },
  { key: 'finish', title: '후가공' },
]
// 우리 option_type → 비교 축
const OURS_TYPE_TO_AXIS: Record<string, AxisKey> = {
  paper_code: 'paper', paper: 'paper',
  print_color_type: 'color',
  paper_size: 'size', size: 'size',
  paper_qty: 'qty', quantity: 'qty',
  finishing: 'finish', finish: 'finish',
}

// 정규화: 라벨/코드의 표기 차이를 흡수해 동의어를 같은 키로 매칭.
//  - 칼라↔컬러, 단위(mm/매), 수식어(표준/기본 등) 제거, 치수기호(×*x) 제거.
function normItem(s: string | number): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/칼라/g, '컬러')
    .replace(/mm|㎜/g, '')
    .replace(/표준|기본|권장|선택|옵션/g, '')
    .replace(/[\s()[\]{}·\-_/.,×*x:+]/g, '')
}

// 누락 목록이 길면(특히 수량 사다리) 잘라서 표기. OMO-3187
const MISS_CAP = 12
function capList(xs: string[]): string {
  if (xs.length <= MISS_CAP) return xs.join(', ')
  return xs.slice(0, MISS_CAP).join(', ') + ` 외 ${xs.length - MISS_CAP}`
}

type AxisCompare = {
  key: AxisKey
  title: string
  swadpiaList: string[] // 성원 = 베이스(기준)
  oursList: string[]
  baseMissing: string[] // 성원 베이스에 있는데 우리 미적용 = 메꿔야 할 누락(주 신호)
  baseDeviation: string[] // 우리엔 있으나 성원 베이스엔 없음 = 임의 항목(정합 필요)
  matchedCount: number // 성원 베이스 중 우리가 적용한 수
  coveragePct: number // 성원 베이스 대비 우리 적용률
}

function buildAxisCompares(detail: Detail): AxisCompare[] {
  const { swadpia, applied } = detail
  // 성원 측 축별 원시 라벨 (= 베이스)
  const swadpiaByAxis: Record<AxisKey, string[]> = {
    paper: swadpia.papers.map((p) => p.name),
    color: (swadpia.printColors ?? []).map((p) => p.label),
    size: swadpia.sizes.map((s) => s.name || s.code),
    qty: swadpia.qtyLadder.map((q) => `${q.toLocaleString('ko-KR')}매`),
    finish: (swadpia.finishings ?? []).map((f) => f.label),
  }
  // 우리 측 축별 원시 라벨(option_type 매핑)
  const oursByAxis: Record<AxisKey, string[]> = { paper: [], color: [], size: [], qty: [], finish: [] }
  for (const g of applied.optionGroups) {
    const axis = OURS_TYPE_TO_AXIS[g.optionType]
    if (!axis) continue
    const labels = g.labels ?? g.samples.map((s) => s.label)
    oursByAxis[axis].push(...labels)
  }

  return AXES.map(({ key, title }) => {
    const swadpiaList = swadpiaByAxis[key]
    const oursList = oursByAxis[key]
    const sNorm = new Set(swadpiaList.map(normItem))
    const oNorm = new Set(oursList.map(normItem))
    const baseMissing = swadpiaList.filter((x) => !oNorm.has(normItem(x)))
    const baseDeviation = oursList.filter((x) => !sNorm.has(normItem(x)))
    const matchedCount = swadpiaList.length - baseMissing.length
    return {
      key,
      title,
      swadpiaList,
      oursList,
      baseMissing,
      baseDeviation,
      matchedCount,
      coveragePct: swadpiaList.length === 0 ? 0 : Math.round((matchedCount / swadpiaList.length) * 100),
    }
  }).filter((a) => a.swadpiaList.length > 0 || a.oursList.length > 0)
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
  const axes = buildAxisCompares(detail)
  return (
    <>
    <div className="grid gap-4 border-t border-gray-100 pt-3 md:grid-cols-2">
      {/* 성원 스크랩 */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 border-l-4 border-indigo-400 pl-2 text-sm font-bold text-indigo-900">
          성원에서 스크랩한 항목{' '}
          <span className="rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-700">베이스/기준</span>
          <span className="font-mono text-xs font-normal text-gray-400">{detail.categoryCode ?? '(미연동)'}</span>
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
              <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">기준단가</span> {krw(swadpia.basePriceKrw)}{' '}
              <span className="text-gray-400">(최소수량 양면)</span>
            </div>
            <div>
              <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">용지 {swadpia.papers.length}종</span>:{' '}
              {swadpia.papers.slice(0, 6).map((p) => p.name).join(', ')}
              {swadpia.papers.length > 6 && ` 외 ${swadpia.papers.length - 6}`}
            </div>
            {swadpia.printMethods.length > 0 && (
              <div><span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">인쇄방식</span>: {swadpia.printMethods.join(', ')}</div>
            )}
            {swadpia.sizes.length > 0 && (
              <div>
                <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">사이즈 {swadpia.sizes.length}종</span>:{' '}
                {swadpia.sizes.slice(0, 5).map((s) => s.name || s.code).join(', ')}
                {swadpia.sizes.length > 5 && ' …'}
              </div>
            )}
            {swadpia.qtyLadder.length > 0 && (
              <div><span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">수량단계</span>: {swadpia.qtyLadder.join(' / ')}</div>
            )}
            {/* OMO-3148: goods_view HTML 에서 별도 스크랩 (json_data 엔 없는 항목) */}
            {swadpia.printColors && swadpia.printColors.length > 0 && (
              <div>
                <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">인쇄색상 {swadpia.printColors.length}종</span>:{' '}
                {swadpia.printColors.map((p) => p.label).join(', ')}
                <span className="ml-1 text-[10px] text-gray-400">(goods_view)</span>
              </div>
            )}
            {swadpia.finishings && swadpia.finishings.length > 0 && (
              <div>
                <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">후가공 {swadpia.finishings.length}종</span>:{' '}
                {swadpia.finishings.map((f) => f.label).join(', ')}
                <span className="ml-1 text-[10px] text-gray-400">(goods_view)</span>
              </div>
            )}
          </div>
        )}
      </div>
      {/* 우리 적용 */}
      <div>
        <div className="mb-1.5 border-l-4 border-emerald-400 pl-2 text-sm font-bold text-emerald-900">우리 사이트에 적용된 옵션</div>
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
                  <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
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
    {axes.length > 0 && <MissingComparison axes={axes} />}
    </>
  )
}

// OMO-3187 / OMO-3409: 항목군 단위 비교(핵심). **성원을 베이스(기준)로** 우리 적용률을 본다.
// 보드 지시(OMO-3409): "성원이 메인 — 성원꺼를 베이스로 우리 옵션/제품을 세팅한다. 우리가 주도하면 안 된다."
//   → 성원 베이스 대비 우리 적용률을 주 지표로, 미반영(메꿀 누락)을 주 신호로, 우리 임의항목(성원
//     베이스에 없음)을 '이탈 — 정합 필요'로 표시한다.
function MissingComparison({ axes }: { axes: AxisCompare[] }) {
  // 전체 성원 베이스 대비 우리 적용률(축 가중합)
  const baseTotal = axes.reduce((n, a) => n + a.swadpiaList.length, 0)
  const matchedTotal = axes.reduce((n, a) => n + a.matchedCount, 0)
  const overallPct = baseTotal === 0 ? 0 : Math.round((matchedTotal / baseTotal) * 100)
  const deviationTotal = axes.reduce((n, a) => n + a.baseDeviation.length, 0)
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-sm font-bold text-gray-900">
        <AlertTriangle className="h-4 w-4 text-amber-500" /> 항목군 비교 — 성원 베이스 기준
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-800">
          성원 베이스 적용률 {matchedTotal}/{baseTotal} ({overallPct}%)
        </span>
        {deviationTotal > 0 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
            성원 베이스 이탈 {deviationTotal}종
          </span>
        )}
      </div>
      <p className="mb-2 text-[11px] text-gray-400">
        기준 = <span className="font-semibold text-indigo-700">성원(메인)</span>. 성원 항목을 베이스로 우리가 얼마나
        반영했는지 본다(우리가 주도 아님). 매칭: 라벨/코드 정규화(공백·대소문자·괄호·구분기호 무시).
      </p>
      <div className="space-y-1.5">
        {axes.map((a) => {
          const fullMatch =
            a.swadpiaList.length > 0 &&
            a.baseMissing.length === 0 &&
            a.baseDeviation.length === 0
          return (
            <div key={a.key} className="rounded-md border border-gray-200 px-2.5 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                  {a.title}
                </span>
                <span className="text-gray-600">
                  성원 베이스{' '}
                  <span className="font-semibold text-indigo-700">{a.swadpiaList.length}종</span>
                  {a.swadpiaList.length > 0 && (
                    <>
                      {' → 우리 적용 '}
                      <span className="font-semibold text-emerald-700">
                        {a.matchedCount}/{a.swadpiaList.length}
                      </span>
                      <span className="text-gray-400"> ({a.coveragePct}%)</span>
                    </>
                  )}
                </span>
                {fullMatch && (
                  <span className="inline-flex items-center gap-0.5 text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 베이스 전부 반영
                  </span>
                )}
              </div>
              {a.baseMissing.length > 0 && (
                <div className="mt-1 rounded bg-red-50 px-2 py-1 text-red-700">
                  <span className="font-bold">성원 베이스 미반영 {a.baseMissing.length}종</span>
                  <span className="text-red-400"> (성원엔 있으나 우리 미적용 — 메꿔야 함)</span>:{' '}
                  <span className="text-red-800">{capList(a.baseMissing)}</span>
                </div>
              )}
              {a.baseDeviation.length > 0 && (
                <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-700">
                  <span className="font-bold">성원 베이스 이탈 {a.baseDeviation.length}종</span>
                  <span className="text-amber-400"> (우리 임의 항목 — 성원 베이스에 없음, 정합 필요)</span>:{' '}
                  <span className="text-amber-800">{capList(a.baseDeviation)}</span>
                </div>
              )}
              {a.swadpiaList.length === 0 && a.oursList.length > 0 && (
                <div className="mt-0.5 text-[11px] text-gray-400">
                  성원 베이스 스크랩 데이터 없음 — 적용률 산정 불가(우리 항목만 존재).
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
