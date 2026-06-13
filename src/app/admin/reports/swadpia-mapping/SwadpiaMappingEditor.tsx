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
} from 'lucide-react'

// OMO-3059: 성원(swadpia) 맵핑 편집·검증 도구 (어드민 전용).
// 보드가 각 제품 옆에 성원 상품 링크를 붙이면 저장 시 라이브 검증해 category_code 를
// 세팅하고 옵션 핑거프린트를 스냅샷한다. 쓰기(POST)는 requireAdmin 게이트 하위다.
// 공개 읽기 전용 리포트는 /reports/swadpia-mapping 에 유지된다.

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
}
interface Group {
  key: string
  title: string
  items: { slug: string; label: string }[]
}

type Verify = { ok: boolean; categoryCode: string | null; paperCount: number; sizeCount: number; error?: string }

const STATUS_BADGE: Record<string, { text: string; cls: string; icon: 'ok' | 'no' | 'warn' }> = {
  verified: { text: '검증됨', cls: 'text-green-700', icon: 'ok' },
  mapped: { text: '연동(기본)', cls: 'text-emerald-600', icon: 'ok' },
  unmapped: { text: '미연동', cls: 'text-red-600', icon: 'no' },
  error: { text: '검증실패', cls: 'text-amber-600', icon: 'warn' },
  drift: { text: '드리프트', cls: 'text-orange-600', icon: 'warn' },
}

export default function SwadpiaMappingEditor() {
  const [rows, setRows] = useState<Row[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, Verify>>({})

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
    if (res.status === 401) {
      setFeedback((f) => ({ ...f, [slug]: { ok: false, categoryCode: null, paperCount: 0, sizeCount: 0, error: '인증 필요 — 어드민 로그인 후 다시 시도하세요.' } }))
      setSaving(null)
      return
    }
    if (json.row) {
      setRows((rs) => rs.map((r) => (r.slug === slug ? json.row : r)))
    }
    if (json.verify) setFeedback((f) => ({ ...f, [slug]: json.verify }))
    setSaving(null)
  }

  const byKey = (k: string) => rows.find((r) => r.slug === k)
  const total = rows.length
  const verified = rows.filter((r) => r.status === 'verified').length
  const mapped = rows.filter((r) => r.status === 'mapped' || r.status === 'verified').length
  const unmapped = rows.filter((r) => r.status === 'unmapped').length
  const drift = rows.filter((r) => r.status === 'drift').length

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> 어드민 홈
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">성원(swadpia) 제품 맵핑 관리</h1>
        <button onClick={load} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> 새로고침
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        OMO-3058/3059 · 각 제품 옆에 <strong>성원 상품 링크</strong>를 붙이고 저장하면 링크를 라이브 검증해
        category_code 를 자동 세팅합니다. 성원쪽 변경(링크/옵션 어긋남)은 드리프트 크론이 감지해 보고합니다.
        공개 읽기 전용 현황은 <Link href="/reports/swadpia-mapping" className="text-blue-600 underline">/reports/swadpia-mapping</Link> 에 있습니다.
      </p>

      {/* 요약 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat n={total} label="전체 제품" />
        <Stat n={verified} label="검증됨" cls="border-green-200 bg-green-50 text-green-700" />
        <Stat n={mapped} label="연동(기본+검증)" cls="border-emerald-200 bg-emerald-50 text-emerald-700" />
        <Stat n={unmapped} label="미연동" cls="border-red-200 bg-red-50 text-red-700" />
        <Stat n={drift} label="드리프트" cls="border-orange-200 bg-orange-50 text-orange-700" />
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
                  <div key={item.slug} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-[140px]">
                        <div className="font-medium text-gray-900">{item.label}</div>
                        <div className="font-mono text-xs text-gray-400">{item.slug}</div>
                      </div>
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
