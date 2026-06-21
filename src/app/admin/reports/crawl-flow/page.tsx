import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'

// OMO-3698: "전체 크롤링 흐름 도식화 + 라이브 검증" 보드 요청.
// 성원(swadpia) 크롤링 파이프라인 전체(오프라인 표집 → 매트릭스 적재 → 고객가격 →
// 드리프트 감지 → 가격동기화 → 결제대조 → 자동발주)를 한 페이지에서:
//  (1) 8단계 도식 + 각 단계의 "세팅/보냄/받음/저장/엣지케이스"
//  (2) 각 UI 터치포인트 와이어프레임
//  (3) 공유 DB 라이브 카운트로 "지금 돌고 있는가" 증명
//  (4) 보드가 생각치 못한 부분(갭/리스크) 체크리스트
// 서버 컴포넌트 + force-dynamic → 매 방문이 공유 DB를 실시간 조회(=라이브 증명).
export const dynamic = 'force-dynamic'

const SWADPIA_BASE = 'https://www.swadpia.co.kr'

type Health = 'ok' | 'warn' | 'idle' | 'unknown'

// ── 라이브 DB 조회(테이블 미존재/권한오류는 graceful degrade) ────────────────
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

async function loadLive() {
  const sb = createServerClient()

  // 1) 매핑 상태 분포
  const mapping = await safe(async () => {
    const { data } = await sb
      .from('print_swadpia_mapping')
      .select('status')
    const counts: Record<string, number> = {}
    for (const r of data || []) counts[r.status] = (counts[r.status] || 0) + 1
    return { total: (data || []).length, counts }
  }, { total: 0, counts: {} as Record<string, number> })

  // 2) 가격 매트릭스(셀 수, 카테고리, 표집/보간, 최신 표집시각)
  const matrix = await safe(async () => {
    const { count } = await sb
      .from('print_swadpia_price_matrix')
      .select('id', { count: 'exact', head: true })
    const { data: rows } = await sb
      .from('print_swadpia_price_matrix')
      .select('category_code, source, sampled_at')
      .order('sampled_at', { ascending: false })
      .limit(5000)
    const cats = new Set<string>()
    let sampled = 0
    let interpolated = 0
    for (const r of rows || []) {
      cats.add(r.category_code)
      if (r.source === 'interpolated') interpolated++
      else sampled++
    }
    return {
      total: count || 0,
      categories: cats.size,
      sampled,
      interpolated,
      lastSampledAt: rows?.[0]?.sampled_at || null,
    }
  }, { total: 0, categories: 0, sampled: 0, interpolated: 0, lastSampledAt: null as string | null })

  // 3) 크롤 런(최근)
  const crawlRun = await safe(async () => {
    const { data } = await sb
      .from('print_swadpia_price_crawl_runs')
      .select('started_at, finished_at, status, sampled_count, interpolated_count, category_codes')
      .order('started_at', { ascending: false })
      .limit(1)
    return data?.[0] || null
  }, null as null | Record<string, unknown>)

  // 4) 드리프트 로그(미보고/최근)
  const drift = await safe(async () => {
    const { data } = await sb
      .from('print_swadpia_drift_log')
      .select('slug, category_code, detected_at, change_summary, reported')
      .order('detected_at', { ascending: false })
      .limit(50)
    const unreported = (data || []).filter((r) => !r.reported).length
    return { total: (data || []).length, unreported, recent: (data || []).slice(0, 5) }
  }, { total: 0, unreported: 0, recent: [] as Array<Record<string, unknown>> })

  // 5) 가격 동기화 히스토리
  const priceHistory = await safe(async () => {
    const { data } = await sb
      .from('print_price_history')
      .select('product_slug, new_price_krw, price_changed, fetch_success, fetched_at, source_data, error_message')
      .order('fetched_at', { ascending: false })
      .limit(200)
    const lastAt = data?.[0]?.fetched_at || null
    const changed = (data || []).filter((r) => r.price_changed).length
    // 견적전용(비매트릭스) 제품은 성원에 가격 매트릭스가 없어 설계상 fetch_success=false 로 기록된다.
    // 스티커/봉투(CST/CEV) 등 custom 치수 제품 → 실패가 아니라 정상. 로그인만료·HTTP 오류 같은 '진짜 실패'와 구분한다.
    const isQuoteOnly = (r: { source_data?: unknown; error_message?: string | null }) => {
      const mode = (r.source_data as { mode?: string } | null)?.mode
      return mode === 'quote-only' || (r.error_message ?? '').includes('비매트릭스')
    }
    const fetchFails = (data || []).filter((r) => !r.fetch_success)
    const quoteOnly = fetchFails.filter(isQuoteOnly).length
    const failed = fetchFails.filter((r) => !isQuoteOnly(r)).length
    return { total: (data || []).length, lastAt, changed, failed, quoteOnly }
  }, { total: 0, lastAt: null as string | null, changed: 0, failed: 0, quoteOnly: 0 })

  // 6) 공장주문(결제 대조)
  const factory = await safe(async () => {
    const states = ['pending', 'placing', 'placed', 'paid', 'failed', 'cancelled']
    const counts: Record<string, number> = {}
    for (const s of states) {
      const { count } = await sb
        .from('print_factory_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', s)
      counts[s] = count || 0
    }
    return counts
  }, {} as Record<string, number>)

  return { mapping, matrix, crawlRun, drift, priceHistory, factory }
}

function fmt(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(ts)
  }
}

function ageDays(ts: string | null | undefined): number | null {
  if (!ts) return null
  const d = (Date.now() - new Date(ts).getTime()) / 86_400_000
  return Number.isFinite(d) ? d : null
}

const HEALTH_STYLE: Record<Health, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  idle: 'bg-slate-50 text-slate-500 border-slate-200',
  unknown: 'bg-slate-50 text-slate-400 border-slate-200',
}
const HEALTH_LABEL: Record<Health, string> = {
  ok: '정상',
  warn: '주의',
  idle: '대기',
  unknown: '미확인',
}

function Badge({ health }: { health: Health }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${HEALTH_STYLE[health]}`}>
      ● {HEALTH_LABEL[health]}
    </span>
  )
}

export default async function CrawlFlowReport() {
  const live = await loadLive()
  const { mapping, matrix, crawlRun, drift, priceHistory, factory } = live

  const matrixAge = ageDays(matrix.lastSampledAt)
  const priceAge = ageDays(priceHistory.lastAt)

  // 단계별 라이브 헬스 판정(데이터 기반, 임의값 아님).
  const stageHealth = {
    crawl: (matrix.total > 0
      ? (matrixAge != null && matrixAge <= 14 ? 'ok' : 'warn')
      : 'idle') as Health,
    load: (matrix.total > 0 ? 'ok' : 'idle') as Health,
    matrix: (matrix.total > 0 ? 'ok' : 'idle') as Health,
    mapping: (mapping.total > 0
      ? ((mapping.counts['error'] || 0) > 0 ? 'warn' : 'ok')
      : 'idle') as Health,
    drift: (drift.unreported > 0 ? 'warn' : (mapping.total > 0 ? 'ok' : 'idle')) as Health,
    // 견적전용(quoteOnly)은 정상이므로 health 에 반영하지 않는다. 진짜 실패(failed)만 warn.
    priceSync: (priceHistory.total > 0
      ? (priceHistory.failed > 0 ? 'warn' : (priceAge != null && priceAge <= 2 ? 'ok' : 'warn'))
      : 'idle') as Health,
    reconcile: ((factory['placed'] || 0) > 0 ? 'warn' : 'ok') as Health,
    autoOrder: 'idle' as Health, // 로컬/VPS Playwright — 서버리스 아님(라이브 판정 불가)
  }

  const metrics = [
    {
      label: '① 매핑 상태',
      health: stageHealth.mapping,
      big: `${mapping.counts['verified'] || 0} / ${mapping.total}`,
      sub: 'verified · 전체',
      lines: [
        `drift ${mapping.counts['drift'] || 0} · error ${mapping.counts['error'] || 0}`,
        `unmapped ${mapping.counts['unmapped'] || 0} · mapped ${mapping.counts['mapped'] || 0}`,
      ],
    },
    {
      label: '② 가격 매트릭스',
      health: stageHealth.matrix,
      big: `${matrix.total.toLocaleString()}`,
      sub: `셀 · 카테고리 ${matrix.categories}종`,
      lines: [
        `표집 ${matrix.sampled.toLocaleString()} · 보간 ${matrix.interpolated.toLocaleString()} (표본 5k)`,
        `최근 표집 ${fmt(matrix.lastSampledAt)}`,
      ],
    },
    {
      label: '③ 크롤 런',
      health: stageHealth.crawl,
      big: crawlRun ? String(crawlRun.status) : '—',
      sub: '최근 런 상태',
      lines: crawlRun
        ? [
            `표집 ${crawlRun.sampled_count} · 보간 ${crawlRun.interpolated_count}`,
            `시작 ${fmt(crawlRun.started_at as string)}`,
          ]
        : ['크롤 런 기록 없음(표집 미실행 또는 테이블 미적재)'],
    },
    {
      label: '④ 드리프트 감지',
      health: stageHealth.drift,
      big: `${drift.unreported}`,
      sub: '미보고 드리프트',
      lines: [
        `로그 ${drift.total}건(최근 50)`,
        drift.recent[0]
          ? `최근: ${drift.recent[0].slug} ${fmt(drift.recent[0].detected_at as string)}`
          : '감지 이력 없음',
      ],
    },
    {
      label: '⑤ 가격 동기화',
      health: stageHealth.priceSync,
      big: `${priceHistory.changed}`,
      sub: '가격변동 기록(최근 200)',
      lines: [
        `실패 ${priceHistory.failed} · 견적전용 ${priceHistory.quoteOnly} · 마지막 ${fmt(priceHistory.lastAt)}`,
        '크론 매일 17:00 UTC · 견적전용=비매트릭스 정상',
      ],
    },
    {
      label: '⑥ 결제 대조',
      health: stageHealth.reconcile,
      big: `${factory['placed'] || 0}`,
      sub: 'placed(미결제) 주문',
      lines: [
        `paid ${factory['paid'] || 0} · pending ${factory['pending'] || 0}`,
        `failed ${factory['failed'] || 0} · 크론 01·13시 UTC`,
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> 관리자
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">성원(swadpia) 크롤링 파이프라인 — 전체 도식 &amp; 라이브 검증</h1>
          <p className="mt-2 text-sm text-slate-600">
            OMO-3698 · 오프라인 표집 → 매트릭스 적재 → 고객 가격 → 드리프트/동기화/결제대조 → 자동발주.
            아래 지표는 이 페이지를 열 때 공유 DB(ilcfemvqommqyoohfoxw)를 <strong>실시간</strong> 조회한 값입니다(=라이브 증명).
          </p>
          <p className="mt-1 text-xs text-slate-400">렌더 시각 {fmt(new Date().toISOString())}</p>
        </header>

        {/* ── 라이브 검증 패널 ── */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">라이브 검증 (공유 DB 실시간)</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{m.label}</span>
                  <Badge health={m.health} />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{m.big}</span>
                  <span className="text-xs text-slate-500">{m.sub}</span>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {m.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── 8단계 도식 ── */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">파이프라인 도식 (8단계)</h2>
          <div className="space-y-3">
            {STAGES.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="font-semibold">{s.title}</span>
                  <Badge health={(stageHealth as Record<string, Health>)[s.healthKey] || 'unknown'} />
                  <span className="ml-auto text-xs text-slate-400">{s.where}</span>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="세팅" value={s.setup} />
                  <Field label="보냄" value={s.send} />
                  <Field label="받음" value={s.receive} />
                  <Field label="저장" value={s.store} />
                  <Field label="엣지케이스" value={s.edge} accent />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            흐름: ①·②·③ 오프라인 배치(Playwright) → ④ 매트릭스(DB) → ⑤ 고객가격 → ⑥ 드리프트(크론) →
            ⑦ 가격동기화(크론) → ⑧ 결제대조(크론) / 자동발주(로컬). 회색 "대기"는 데이터/실행 이력이 아직 없는 단계입니다.
          </p>
        </section>

        {/* ── 크론 스케줄 ── */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">크론 스케줄 (vercel.json)</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">경로</th>
                  <th className="px-4 py-2">스케줄(UTC)</th>
                  <th className="px-4 py-2">역할</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CRONS.map((c) => (
                  <tr key={c.path}>
                    <td className="px-4 py-2 font-mono text-xs">{c.path}</td>
                    <td className="px-4 py-2 font-mono text-xs">{c.schedule}</td>
                    <td className="px-4 py-2 text-slate-600">{c.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            인증: 모든 크론은 <code className="rounded bg-slate-100 px-1">Bearer $CRON_SECRET</code> 필요.
            <code className="rounded bg-slate-100 px-1">?dry=1</code> 진단 모드, 드리프트는 <code className="rounded bg-slate-100 px-1">?of=N&part=K</code> 부하분할 지원.
          </p>
        </section>

        {/* ── 와이어프레임 ── */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">UI 터치포인트 와이어프레임</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {WIREFRAMES.map((w) => (
              <div key={w.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">{w.title}</span>
                  <span className="font-mono text-xs text-slate-400">{w.path}</span>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{w.art}</pre>
                <p className="mt-2 text-xs text-slate-500">{w.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 내가 생각치 못한 부분 ── */}
        <section className="mb-12">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            런칭 전 점검 — 생각치 못한 부분 / 리스크
          </h2>
          <div className="space-y-2">
            {RISKS.map((r) => (
              <div key={r.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                    r.level === 'high'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : r.level === 'med'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}>
                    {r.level === 'high' ? '높음' : r.level === 'med' ? '중간' : '낮음'}
                  </span>
                  <span className="font-semibold">{r.title}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{r.body}</p>
                <p className="mt-1 text-xs text-emerald-700">→ 대응: {r.mitigation}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-400">
          <p>
            소스 단일진실원천: <code>scripts/omo3240-crawl-scoped.mjs</code>(표집) ·{' '}
            <code>src/lib/swadpia-matrix.ts</code>(조회) · <code>src/app/api/cron/swadpia-drift</code>(드리프트) ·{' '}
            <code>src/lib/swadpia-order.ts</code>(자동발주). 가격 라우팅 플래그 <code>SWADPIA_MATRIX_ROUTING</code>.
          </p>
        </footer>
      </div>
    </div>
  )
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${accent ? 'text-amber-600' : 'text-slate-400'}`}>
        {label}
      </div>
      <div className="mt-0.5 text-sm text-slate-700">{value}</div>
    </div>
  )
}

// ── 정적 데이터(코드/스키마 검증 기반) ───────────────────────────────────────
const STAGES = [
  {
    id: 'crawl',
    healthKey: 'crawl',
    title: '① 오프라인 표집 크롤 (Playwright)',
    where: 'scripts/omo3240-crawl-scoped.mjs',
    setup: 'Playwright 로그인(SWADPIA_USERNAME/PASSWORD) · DB에서 노출 옵션집합(print_product_options)만 스코프 · regist/cart/order POST는 abort',
    send: `POST ${SWADPIA_BASE}/member/login → goods_view/{category_code} select 조작(size/paper/side/qty)`,
    receive: 'hidden input total_price/paper/plate/print + 화면 공급가 lbl_supply_amt (패리티 대조)',
    store: '아티팩트 JSON(scoped-latest.json) · 사이즈 단위 즉시 적재',
    edge: 'CPR4000 runaway 스크립트 2h hang → 12s evaluate 타임아웃 + poison 시 페이지 재로드. 패리티 FAIL 사이즈는 미적재→--resume 재시도',
  },
  {
    id: 'load',
    healthKey: 'load',
    title: '② 매트릭스 적재 (artifact → DB)',
    where: 'scripts/omo3240-load-matrix.mjs',
    setup: 'SERVICE_ROLE 키 · print_color_type 컬럼 유무 자동감지(마이그 호환)',
    send: 'upsert on-conflict(category_code,size_code,paper_code,side,qty)',
    receive: '적재 행수 · 패리티 요약',
    store: 'print_swadpia_price_matrix · 런 로그 print_swadpia_price_crawl_runs',
    edge: '테이블 미존재 시 graceful skip(OMO-1292 게이트). 0행이면 고객가격은 라이브 fallback',
  },
  {
    id: 'matrix',
    healthKey: 'matrix',
    title: '③ 고객 가격 조회 (매트릭스 우선)',
    where: 'src/lib/swadpia-matrix.ts / swadpia-matrix-core.ts',
    setup: 'SWADPIA_MATRIX_ROUTING=on 게이트 · MATRIX_AXIS(카테고리별 print_color_type↔side 축)',
    send: 'fetchMatrixSlice(category) — 라이브 fetch 없음(DB 조회)',
    receive: 'piecewise-linear 보간 셀 → total_price_krw + source',
    store: '없음(읽기) · 미스 시 ④ 라이브 API로 fallback',
    edge: '조합 미존재 → 레거시 /api/swadpia-price 라이브 폴백 · qty 범위밖 → 최근접 clamp',
  },
  {
    id: 'legacy',
    healthKey: 'matrix',
    title: '④ 레거시 라이브 가격 API (폴백)',
    where: 'src/app/api/swadpia-price/route.ts',
    setup: '슬러그별 1시간 in-memory TTL 캐시',
    send: `POST ${SWADPIA_BASE}/estimate/estimate_goods/json_data { t, product='name', category_code }`,
    receive: 'JSON(paper_info/print_info/size_info) → calculateSwadpiaPriceKrw',
    store: '없음(런타임 계산)',
    edge: '멀티사이즈는 json_data가 기본사이즈만 반환 · 토너(COD1100)는 단가 미노출 → ③ 매트릭스가 해결',
  },
  {
    id: 'mapping',
    healthKey: 'mapping',
    title: '⑤ 매핑 관리 + 핑거프린트',
    where: 'src/app/api/swadpia-mapping · /reports/swadpia-mapping',
    setup: '보드가 성원 링크 붙여넣기 → category_code 추출(정규식)',
    send: `verifySwadpiaLink → json_data 라이브 검증`,
    receive: 'fingerprint(paperCodes/printMethods/sizeCodes/qtyLadder/basePrice)',
    store: 'print_swadpia_mapping(status, fingerprint, last_verified_at)',
    edge: 'goods_view는 category+goods_code 둘 다 필요(없으면 PHP 에러). status=error는 재검증 필요',
  },
  {
    id: 'drift',
    healthKey: 'drift',
    title: '⑥ 드리프트 감지 크론',
    where: 'src/app/api/cron/swadpia-drift (매일 18:00 UTC)',
    setup: 'CRON_SECRET · ?of/part 부하분할 · ?dry=1 진단',
    send: 'verified 제품별 json_data 재조회 → 새 fingerprint',
    receive: 'diffFingerprint(prev,next) — 용지/인쇄방식/사이즈/수량/기준가 변화',
    store: '변화 시 mapping.status=drift + print_swadpia_drift_log(reported=false)',
    edge: '미보고분은 Paperclip 루틴이 읽어 보드 보고 · 성원 개편 시 대량 drift 가능',
  },
  {
    id: 'priceSync',
    healthKey: 'priceSync',
    title: '⑦ 가격 동기화 크론',
    where: 'src/app/api/cron/update-prices (매일 17:00 UTC)',
    setup: 'CRON_SECRET · 활성 print_products 순회',
    send: 'fetchSwadpiaCategoryData(slug) 라이브',
    receive: '최소수량 기준 base price',
    store: 'print_price_history(항상 기록) · 변동 시 print_products.base_price_krw 갱신',
    edge: 'fetch 실패는 fetch_success=false로 기록(가격 미갱신) · Vercel Hobby는 일1회 한도',
  },
  {
    id: 'reconcile',
    healthKey: 'reconcile',
    title: '⑧ 결제 대조 / 자동발주',
    where: 'cron/swadpia-payment-reconcile (01·13 UTC) + scripts(로컬 Playwright)',
    setup: 'RESEND_API_KEY · ADMIN_NOTIFICATION_EMAIL · 자동발주는 로컬/VPS(서버리스 아님)',
    send: 'placed(미결제) 주문 집계 → 관리자 체크리스트 이메일 / 자동발주는 성원 폼+파일업로드',
    receive: 'swadpia_order_number · checkout_url',
    store: 'print_factory_orders(status placed→paid) · 관리자 "결제완료" 클릭',
    edge: '외부 직접발송 금지(OMO-1908) — 사장님 승인 게이트. dry-run 스냅샷으로 실주문 리스크 감소',
  },
]

const CRONS = [
  { path: '/api/cron/update-prices', schedule: '0 17 * * *', role: '⑦ 가격 동기화(base_price_krw 갱신 + 히스토리)' },
  { path: '/api/cron/swadpia-drift', schedule: '0 18 * * *', role: '⑥ 매핑/옵션 드리프트 감지 → 보드 보고' },
  { path: '/api/cron/swadpia-payment-reconcile', schedule: '0 1,13 * * *', role: '⑧ 미결제(placed) 주문 결제 체크리스트 이메일' },
]

const WIREFRAMES = [
  {
    title: '매핑 관리(보드)',
    path: '/reports/swadpia-mapping',
    art: `┌──────────────────────────────────────┐
│ 제품          상태      성원링크 [붙여넣기]│
│ ─────────────────────────────────────│
│ 명함 CNC1000  ● verified   [재검증] 👁 │
│ 포스터 CPR2000 ● drift ⚠   [확인]       │
│ 책자 CPR4000  ● error ✕    [수정]       │
│            [저장 → 라이브 검증 → 핑거프린트]│
└──────────────────────────────────────┘`,
    note: '보드가 성원 링크를 붙이면 저장 시 라이브 검증 → category_code/fingerprint 스냅샷.',
  },
  {
    title: '고객 가격(컨피규레이터)',
    path: '/products/[slug] · /order',
    art: `┌──────────────────────────────────────┐
│ 사이즈 [A4 ▾] 용지 [아르떼 ▾] 단/양면 [▾]│
│ 수량   [500 ▾]                          │
│ ───────────────────────────────────── │
│ 공급가  ₩ 64,000   (matrix·sampled)     │
│         └ 미스 시 라이브 json_data 폴백 │
└──────────────────────────────────────┘`,
    note: 'SWADPIA_MATRIX_ROUTING=on이면 DB 매트릭스 보간, 미스는 라이브 API 폴백.',
  },
  {
    title: '결제 대조 이메일(관리자)',
    path: 'cron/swadpia-payment-reconcile',
    art: `┌──────────────────────────────────────┐
│ [성원 미결제 주문 N건]                  │
│ • #1042 CNC1000 ×500  [성원 결제] [완료]│
│ • #1043 CPR2000 ×1000 [성원 결제] [완료]│
│ → 관리자 /admin/orders/{id} "결제완료"  │
└──────────────────────────────────────┘`,
    note: '외부 직접발송 금지(OMO-1908) — 사장님 업무계정/승인 게이트 경유.',
  },
  {
    title: '자동발주 dry-run 스냅샷(로컬)',
    path: 'scripts (Playwright)',
    art: `┌──────────────────────────────────────┐
│ goods_view/{code} 폼 세팅              │
│  size=A4 paper=ARE160 binding=BDT6     │
│  파일업로드 → chgFileName 캡처          │
│  [SUBMIT 직전 STOP] 스냅샷 패리티 확인  │
│   파일 페이지수 ↔ 별색판 일치?         │
└──────────────────────────────────────┘`,
    note: 'dry-run으로 폼/후가공/파일 상태를 검증 후에만 실제 발주(실주문 리스크↓).',
  },
]

const RISKS = [
  {
    level: 'high' as const,
    title: '성원 로그인/세션 만료 → 표집 전체 실패',
    body: '크롤·드리프트·가격동기화 모두 성원 로그인에 의존. 비밀번호 변경/세션 만료 시 조용히 0행 또는 fetch 실패로 떨어질 수 있음.',
    mitigation: '크롤 런 status + price_history.fetch_success를 이 페이지에서 모니터링. 연속 실패 시 보드 알림 루틴 추가 권장.',
  },
  {
    level: 'high' as const,
    title: '매트릭스 신선도(stale price)',
    body: '매트릭스는 오프라인 표집 스냅샷. 성원이 단가를 올렸는데 재표집 전이면 고객에게 옛 가격 노출 → 역마진 위험.',
    mitigation: '드리프트 크론이 기준가 변화를 잡지만 "전 수량·사이즈" 단가까지는 못 봄. 매트릭스 sampled_at 14일 초과 시 경고(상단 ③ 카드) + 정기 재표집 루틴 필요.',
  },
  {
    level: 'med' as const,
    title: '드리프트 보고 루프 — 미보고분 적체',
    body: 'drift_log.reported=false는 Paperclip 루틴이 읽어야 보드에 도달. 루틴이 안 돌면 미보고분이 쌓여도 아무도 모름.',
    mitigation: '상단 ④ "미보고 드리프트" 카운트로 가시화. >0 지속 시 보고 루틴 점검.',
  },
  {
    level: 'med' as const,
    title: 'SWADPIA_MATRIX_ROUTING 플래그 상태 불명',
    body: '플래그 OFF면 매트릭스를 적재해도 고객은 라이브 API 가격을 봄(멀티사이즈 부정확 가능). 런칭 전 prod env 값 확인 필요.',
    mitigation: 'Vercel prod env에서 SWADPIA_MATRIX_ROUTING=on 확인 + 카테고리별 스모크(가격 일치) 후 점등.',
  },
  {
    level: 'med' as const,
    title: '자동발주는 서버리스에서 안 돎',
    body: 'Playwright 자동발주는 로컬/VPS 전용. prod에 워커가 없으면 placed 주문이 영원히 미결제로 남음.',
    mitigation: '결제대조 크론이 미결제분을 이메일로 푸시(수동 안전망). 자동발주 워커 호스팅은 별도 결정 필요.',
  },
  {
    level: 'low' as const,
    title: '의존 선택(binding_type 등) 재populate 타이밍',
    body: 'CPR4000 무선제본(BDT6)은 in_page_qty≥32일 때만 노출 등 의존 선택. 크롤/발주 순서가 틀리면 옵션 누락.',
    mitigation: 'immediate(용지/사이즈) 먼저 → deferred(제본) 검증 후 적용 패턴 적용됨(OMO-3033). 신규 카테고리 추가 시 재확인.',
  },
  {
    level: 'low' as const,
    title: '고객 접점에 내부 임계값/전화 노출 금지',
    body: '가격 도식·카피에 내부 수량 임계값(200/500 등) 노출 금지, 고객 노출 전화번호 금지(OMO-2760).',
    mitigation: '이 리포트는 /admin 내부용. 고객 페이지엔 임계값/전화 미노출 유지.',
  },
]
