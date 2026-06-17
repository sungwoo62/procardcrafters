'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  Link2,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'

const SWADPIA_BASE = 'https://www.swadpia.co.kr'

// 성원 goods_view 는 category_code + goods_code 둘 다 필요하다. category 만 주면
// PHP가 상품객체를 못 찾아 에러 페이지(+한글 깨짐)가 뜬다(OMO-3058 보드 제보).
// goods_code 패턴: 'G' + category[1:-1] + '1' (예: CNC1000→GNC1001, CDP5100→GDP5101).
function swadpiaGoodsUrl(categoryCode: string | null): string {
  if (!categoryCode) return SWADPIA_BASE
  const goods = 'G' + categoryCode.slice(1, -1) + '1'
  return `${SWADPIA_BASE}/goods/goods_view/${categoryCode}/${goods}`
}

// OMO-3058: 우리 사이트 전체 제품 ↔ 성원(swadpia) 맵핑 편집 + 검증 도구.
// 보드가 각 제품 옆에 성원 상품 링크를 붙이면 저장 시 라이브 검증해 category_code 를
// 세팅하고 옵션 핑거프린트를 스냅샷한다. 성원쪽 변경(드리프트)은 별도 크론이 감지해
// 보드에 보고한다(개선책 포함).
export const dynamic = 'force-dynamic'

// 성원 category_code → 성원 공식 제품명(swadpia.co.kr 카탈로그 라이브 스크랩, OMO-3058).
const SWADPIA_CATEGORY_LABEL: Record<string, string> = {
  CNC1000: '일반지명함', CNC2000: '고급지명함', CNC3000: '카드명함',
  CNC4000: '하이브리드명함', CNC5000: '투명하이브리드명함', CNC6000: '디지털박/에폭시명함',
  CNC7000: '프리컷팅', CNC8000: '펄 UV 명함',
  CST1000: '재단형 스티커', CST2000: '도무송형 스티커', CST5000: '스페셜스티커',
  CST7000: '팬시롤스티커', CLP1000: '라벨스티커(롤)',
  CLF1000: '합판전단', CLF2000: '고급전단', CPR2000: '포스터', CPR3000: '리플렛/팜플렛',
  CPR4000: '책자', CPR5000: '종이홀더 ⚠️',
  CDP2000: '디지털청첩장/초대장', CDP3000: '디지털엽서/상품권', CDP5100: '디지털노트',
  CEV1000: '봉투(대/중/소)', CNR2000: '서식/양식', CNR3000: '떡메모지',
  CCD1000: '대량캘린더', CCD2000: '디지털캘린더', CCM4000: '연하장',
  CVS1000: '일반초대장/상품권', CPS7000: '사각포스트잇', COD1100: '종이미니배너',
  CHI3000: '판지/박스',
  // 쇼핑백 4종 (OMO-3197 재크롤 검증)
  CPK2000: '리본&브레이드 쇼핑백', CPK4000: '종이끈 쇼핑백',
  CPK3000: '끈없는 쇼핑백', CPK5000: '소량 쇼핑백',
}

interface Row {
  slug: string
  label: string
  group_key: string | null
  swadpia_url: string | null
  category_code: string | null
  status: string
  last_verified_at: string | null
  verify_error: string | null
  hidden_from_customer: boolean
}
interface Group {
  key: string
  title: string
  items: { slug: string; label: string }[]
}

type Verify = { ok: boolean; categoryCode: string | null; paperCount: number; sizeCount: number; error?: string }

interface Detail {
  categoryCode: string | null
  swadpia: {
    fetchSuccess: boolean
    error?: string
    papers: { code: string; name: string; single: number; double: number }[]
    printMethods: string[]
    sizes: { code: string; name: string; mm: string }[]
    qtyLadder: number[]
    basePriceKrw: number
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

const OPTION_TYPE_LABEL: Record<string, string> = {
  paper_code: '용지', paper: '용지', print_color_type: '인쇄색상', paper_size: '사이즈',
  size: '사이즈', paper_qty: '수량', quantity: '수량', finishing: '후가공', finish: '후가공',
  coating: '코팅', corners: '모서리', sides: '인쇄면', pages: '페이지',
}

const STATUS_BADGE: Record<string, { text: string; cls: string; icon: 'ok' | 'no' | 'warn' }> = {
  verified: { text: '검증됨', cls: 'text-green-700', icon: 'ok' },
  mapped: { text: '연동(기본)', cls: 'text-emerald-600', icon: 'ok' },
  unmapped: { text: '미연동', cls: 'text-red-600', icon: 'no' },
  error: { text: '검증실패', cls: 'text-amber-600', icon: 'warn' },
  drift: { text: '드리프트', cls: 'text-orange-600', icon: 'warn' },
}

// OMO-3238: 결정론 가격 검수결과 배너 — 성원 hidden total_price 매트릭스 적재/parity 현황.
//   여기 맵핑 페이지는 "어떤 제품이 어떤 성원 코드냐"(옵션 매핑)를 다루고, 가격이 실제로
//   결정론적으로 맞는지의 검수결과는 매트릭스(OMO-3240 적재/3241 라우팅)에 있다. 그 요약을
//   여기 노출하고 상세는 /admin/qa/swadpia-parity(④ 가격 parity · ⑤ 옵션코드 매핑표)로 보낸다.
type MatrixParitySummary = {
  totalCells: number
  routedCategories: string[]
  generatedAt: string
  coverage: Array<{
    categoryCode: string
    productSlug: string | null
    representative: { deltaPct: number | null } | null
  }>
  recentRuns: Array<{ drift_detected: boolean }>
}

function PriceVerificationBanner() {
  const [data, setData] = useState<MatrixParitySummary | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/qa/matrix-parity')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [])

  const deltas = (data?.coverage ?? [])
    .map((c) => c.representative?.deltaPct)
    .filter((d): d is number => d != null)
  const maxUp = deltas.length ? Math.max(...deltas) : null
  const maxDown = deltas.length ? Math.min(...deltas) : null
  const driftRuns = (data?.recentRuns ?? []).filter((r) => r.drift_detected).length

  return (
    <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-indigo-900">
          가격 검수결과 — 결정론 매트릭스 (OMO-3238 / 3240 / 3241)
        </div>
        <Link
          href="/admin/qa/swadpia-parity"
          className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          상세 검수표 보기 <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-1 text-indigo-800/90 text-[13px] leading-relaxed">
        가격은 화면 OCR/LLM 추론이 아니라 성원 발주폼 <strong>hidden total_price 필드 직독</strong>으로 결정론적으로
        산출한다. 멀티사이즈/디지털/토너는 성원 json_data가 size를 무시하므로 오프라인 크롤러가 표집해
        <code className="mx-1 rounded bg-white px-1">print_swadpia_price_matrix</code>에 적재(OMO-3240, 성원 화면과 패리티 검증).
        <strong> 박(箔)만 예외</strong> — total_price에 안 잡혀 별색 surcharge로 분리 산정한다.
      </p>

      {err && (
        <div className="mt-3 text-xs text-amber-700">
          가격 검수 데이터 로드 실패: {err} <span className="text-amber-600">(관리자 로그인/배포 필요할 수 있음)</span>
        </div>
      )}
      {!data && !err && <div className="mt-3 text-xs text-indigo-400">검수 데이터 로딩 중…</div>}

      {data && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat n={data.totalCells} label="적재 가격셀" cls="border-indigo-200 bg-white text-indigo-800" />
          <Stat n={data.routedCategories.length} label="매트릭스 대상 카테고리" cls="border-indigo-200 bg-white text-indigo-800" />
          <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-center">
            <div className="text-base font-bold text-indigo-800">
              {maxUp == null ? '—' : `${maxUp > 0 ? '+' : ''}${maxUp}%`}
              <span className="text-gray-300"> / </span>
              {maxDown == null ? '—' : `${maxDown}%`}
            </div>
            <div className="text-[11px] text-gray-500">컷오버 시 최대 가격이동(↑/↓)</div>
          </div>
          <Stat
            n={driftRuns}
            label="최근 드리프트 감지"
            cls={driftRuns > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}
          />
        </div>
      )}
    </div>
  )
}

export default function SwadpiaMappingTool() {
  const [rows, setRows] = useState<Row[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [hiding, setHiding] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, Verify>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Record<string, Detail | 'loading'>>({})

  async function load() {
    setLoading(true)
    const res = await fetch('/api/swadpia-mapping')
    const json = await res.json()
    setRows(json.rows ?? [])
    setGroups(json.groups ?? [])
    setDrafts(
      Object.fromEntries((json.rows ?? []).map((r: Row) => [r.slug, r.swadpia_url ?? ''])),
    )
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save(slug: string) {
    setSaving(slug)
    setFeedback((f) => ({ ...f, [slug]: undefined as unknown as Verify }))
    const res = await fetch('/api/swadpia-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, swadpiaUrl: drafts[slug] ?? '' }),
    })
    const json = await res.json()
    if (json.row) {
      setRows((rs) => rs.map((r) => (r.slug === slug ? json.row : r)))
    }
    if (json.verify) setFeedback((f) => ({ ...f, [slug]: json.verify }))
    setSaving(null)
  }

  async function toggleHidden(slug: string, hidden: boolean) {
    setHiding(slug)
    const res = await fetch('/api/swadpia-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, hidden }),
    })
    const json = await res.json()
    if (json.row) setRows((rs) => rs.map((r) => (r.slug === slug ? json.row : r)))
    setHiding(null)
  }

  async function toggleExpand(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
    if (!details[slug]) {
      setDetails((d) => ({ ...d, [slug]: 'loading' }))
      const res = await fetch(`/api/swadpia-mapping/detail?slug=${encodeURIComponent(slug)}`)
      const json = await res.json()
      setDetails((d) => ({ ...d, [slug]: json as Detail }))
    }
  }

  const byKey = (k: string) => rows.find((r) => r.slug === k)
  const total = rows.length
  const verified = rows.filter((r) => r.status === 'verified').length
  const mapped = rows.filter((r) => r.status === 'mapped' || r.status === 'verified').length
  const unmapped = rows.filter((r) => r.status === 'unmapped').length
  const drift = rows.filter((r) => r.status === 'drift').length
  const hidden = rows.filter((r) => r.hidden_from_customer).length

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/products" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> 제품 목록
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">성원(swadpia) 제품 맵핑 관리</h1>
        <button onClick={load} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> 새로고침
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        OMO-3058 · 각 제품 옆에 <strong>성원 상품 링크</strong>를 붙이고 저장하면 링크를 라이브 검증해
        category_code 를 자동 세팅합니다. 성원쪽 변경(링크/옵션 어긋남)은 드리프트 크론이 감지해 보고합니다.
      </p>

      {/* 요약 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Stat n={total} label="전체 제품" />
        <Stat n={verified} label="검증됨" cls="border-green-200 bg-green-50 text-green-700" />
        <Stat n={mapped} label="연동(기본+검증)" cls="border-emerald-200 bg-emerald-50 text-emerald-700" />
        <Stat n={unmapped} label="미연동" cls="border-red-200 bg-red-50 text-red-700" />
        <Stat n={drift} label="드리프트" cls="border-orange-200 bg-orange-50 text-orange-700" />
        <Stat n={hidden} label="고객숨김" cls="border-gray-300 bg-gray-100 text-gray-700" />
      </div>

      {/* OMO-3238: 결정론 가격 검수결과 */}
      <PriceVerificationBanner />

      {/* transparent-stickers 답변 */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
        <div className="font-semibold text-blue-900">Q. /products/transparent-stickers 는 성원 무슨 제품?</div>
        <div className="mt-1 text-blue-800">
          현재 <strong>미연동</strong>. 아래 표에서 성원 투명 스티커 상품 링크를 붙이고 저장하면 즉시 검증·세팅됩니다.
          후보는 <code className="rounded bg-blue-100 px-1">CST1000/CST2000</code> 계열 투명 PVC 변형입니다.
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-2 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /> 불러오는 중…</div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
            <div className="mt-2 space-y-2">
              {group.items.map((item) => {
                const row = byKey(item.slug)
                if (!row) return null
                const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.unmapped
                const fb = feedback[item.slug]
                return (
                  <div key={item.slug} className={`rounded-lg border p-3 ${row.hidden_from_customer ? 'border-gray-300 bg-gray-100' : 'border-gray-200'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => toggleExpand(item.slug)}
                        title="맵핑 상세 보기"
                        className="flex items-center gap-1 text-left hover:opacity-70"
                      >
                        {expanded.has(item.slug) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <div className="min-w-[130px]">
                          <div className={`font-medium ${row.hidden_from_customer ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.label}</div>
                          <div className="font-mono text-xs text-gray-400">{item.slug}</div>
                        </div>
                      </button>
                      {/* OMO-3058: 우리 제품 페이지 새창 링크 */}
                      <a
                        href={`/products/${item.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="우리 사이트 제품 페이지 (새창)"
                        className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        우리제품 <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="text-xs">
                        <span className="font-mono text-gray-700">{row.category_code ?? '—'}</span>
                        {row.category_code && SWADPIA_CATEGORY_LABEL[row.category_code] && (
                          <span className="ml-1 text-gray-400">{SWADPIA_CATEGORY_LABEL[row.category_code]}</span>
                        )}
                        {/* OMO-3058: 매핑된 성원 상품 새창 링크 */}
                        {(row.swadpia_url || row.category_code) && (
                          <a
                            href={row.swadpia_url || swadpiaGoodsUrl(row.category_code)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="성원 상품 페이지 (새창)"
                            className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-gray-300 bg-white px-1.5 py-0.5 font-medium text-gray-600 hover:bg-gray-50"
                          >
                            성원 <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${badge.cls}`}>
                        {badge.icon === 'ok' && <CheckCircle2 className="h-4 w-4" />}
                        {badge.icon === 'no' && <XCircle className="h-4 w-4" />}
                        {badge.icon === 'warn' && <AlertTriangle className="h-4 w-4" />}
                        {badge.text}
                      </span>
                      <button
                        onClick={() => toggleHidden(item.slug, !row.hidden_from_customer)}
                        disabled={hiding === item.slug}
                        title={row.hidden_from_customer ? '고객에게 다시 노출' : '고객에게 숨김'}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                          row.hidden_from_customer
                            ? 'border-gray-400 bg-gray-700 text-white hover:bg-gray-800'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {hiding === item.slug ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : row.hidden_from_customer ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {row.hidden_from_customer ? '숨김' : '노출'}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                        <input
                          value={drafts[item.slug] ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [item.slug]: e.target.value }))}
                          placeholder="성원 상품 링크 또는 category_code (예: https://www.swadpia.co.kr/goods/goods_view/CST1000)"
                          className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => save(item.slug)}
                        disabled={saving === item.slug}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving === item.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        저장·검증
                      </button>
                    </div>
                    {fb && (
                      <div className={`mt-1.5 text-xs ${fb.ok ? 'text-green-600' : 'text-amber-600'}`}>
                        {fb.ok
                          ? `✓ 검증 통과 — ${fb.categoryCode} (용지 ${fb.paperCount}종 · 사이즈 ${fb.sizeCount}종)`
                          : `✗ ${fb.error ?? '검증 실패'}`}
                      </div>
                    )}
                    {!fb && row.status === 'drift' && row.verify_error && (
                      <div className="mt-1.5 text-xs text-orange-600">⚠ 드리프트: {row.verify_error} — 확인 후 재저장하면 알림 해제</div>
                    )}
                    {expanded.has(item.slug) && (
                      <DetailPanel detail={details[item.slug]} />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}

      <div className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        <div className="font-semibold text-gray-700">드리프트 모니터링 시스템</div>
        <p className="mt-1">
          검증된 제품은 매일 성원 라이브 데이터와 옵션 핑거프린트(용지·인쇄방식·사이즈·수량단계·기준단가)를 비교합니다.
          변경이 감지되면 해당 행이 <strong>드리프트</strong>로 표시되고, 변경 요약 + 개선책이 보드에 보고됩니다.
          확인 후 링크를 재저장하면 핑거프린트가 갱신되어 알림이 해제됩니다.
        </p>
      </div>
    </div>
  )
}

function Stat({ n, label, cls = 'border-gray-200' }: { n: number; label: string; cls?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-2xl font-bold">{n}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  )
}

const krw = (n: number) => `₩${(n ?? 0).toLocaleString('ko-KR')}`

function DetailPanel({ detail }: { detail: Detail | 'loading' | undefined }) {
  if (!detail || detail === 'loading') {
    return (
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> 성원 라이브 + 우리 적용 항목 불러오는 중…
      </div>
    )
  }
  const { swadpia, applied } = detail
  return (
    <div className="mt-3 grid gap-4 border-t border-gray-100 pt-3 md:grid-cols-2">
      {/* 성원 스크랩 */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-gray-700">
          성원에서 스크랩한 항목{' '}
          <span className="font-normal text-gray-400">{detail.categoryCode ?? '(미연동)'}</span>
        </div>
        {!detail.categoryCode ? (
          <div className="text-xs text-gray-400">성원 연동 없음 — 링크를 붙이면 스크랩됩니다.</div>
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
              <span className="block text-[11px] text-emerald-700/80">
                ※ 아래 옵션 추가요금(원가)도 동일하게 ×{applied.marginMultiplier ?? 3.3} 적용 후 USD 환산되어 고객에게 표시됩니다.
              </span>
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
