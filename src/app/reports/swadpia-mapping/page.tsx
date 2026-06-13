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
} from 'lucide-react'

// OMO-3058: 우리 사이트 전체 제품 ↔ 성원(swadpia) 맵핑 편집 + 검증 도구.
// 보드가 각 제품 옆에 성원 상품 링크를 붙이면 저장 시 라이브 검증해 category_code 를
// 세팅하고 옵션 핑거프린트를 스냅샷한다. 성원쪽 변경(드리프트)은 별도 크론이 감지해
// 보드에 보고한다(개선책 포함).
export const dynamic = 'force-dynamic'

// 성원 category_code → 제품명(한국어). 표시용 참고 사전.
const SWADPIA_CATEGORY_LABEL: Record<string, string> = {
  CNC1000: '일반 명함', CNC2000: '고급(프리미엄) 명함', CNC3000: '메탈·포일 명함',
  CNC4000: '아트지 300g 명함', CNC5000: 'PET 투명 명함', CNC6000: 'UV 코팅 명함',
  CNC8000: '펄 UV 명함', CST1000: '일반 스티커', CST2000: '도무송(다이컷) 스티커',
  CST5000: '스페셜 스티커', CST7000: '팬시롤 스티커', CLP1000: '라벨 스티커(롤)',
  CLF1000: '전단지', CLF2000: '브로슈어/메뉴', CPR2000: '포스터', CPR3000: '리플렛/팜플렛',
  CPR4000: '책자(중철·무선제본)', CPR5000: '종이홀더 ⚠️', CDP3000: '엽서', CEV1000: '봉투',
  CNR2000: '양식·전표', CCD1000: '벽걸이 캘린더', CCD2000: '탁상/미니 캘린더',
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
                      <div className="text-xs">
                        <span className="font-mono text-gray-700">{row.category_code ?? '—'}</span>
                        {row.category_code && SWADPIA_CATEGORY_LABEL[row.category_code] && (
                          <span className="ml-1 text-gray-400">{SWADPIA_CATEGORY_LABEL[row.category_code]}</span>
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
            <div>
              <span className="font-medium text-gray-700">기준가</span> {krw(applied.basePriceKrw ?? 0)} ·{' '}
              고객노출 {applied.isActive ? 'ON' : 'OFF'}
            </div>
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
