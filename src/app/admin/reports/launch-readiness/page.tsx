import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'

// OMO-3894 "런칭해도되겠냐" — 보드 런칭 GO/NO-GO 의사결정 스코어카드.
// 보드가 명시한 3대 축을 한 페이지에서 증거 기반으로 판정한다:
//  ① 고객 주문이 성원에 오차 없이 들어가는가 (주문→성원 정확도)
//  ② 성원에서 제작상태를 크롤링하는가 (제작상태 동기화)
//  ③ 각 에디터 후가공이 성원 기준 파일로 생성되는가 (후가공 파일 export)
// 서버 컴포넌트 + force-dynamic → 매 방문이 공유 DB를 실시간 조회(라이브 증명).
// 판정 근거(코드 file:line)는 정적, 운영 신선도(주문/발주/매핑 수)는 라이브.
export const dynamic = 'force-dynamic'

type Verdict = 'go' | 'caveat' | 'nogo'

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

async function loadLive() {
  const sb = createServerClient()

  const orders = await safe(async () => {
    const { count } = await sb
      .from('print_orders')
      .select('id', { count: 'exact', head: true })
    return count || 0
  }, 0)
  const factoryTotal = await safe(async () => {
    const { count } = await sb
      .from('print_factory_orders')
      .select('id', { count: 'exact', head: true })
    return count || 0
  }, 0)
  const factoryPending = await safe(async () => {
    const { count } = await sb
      .from('print_factory_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'placed')
    return count || 0
  }, 0)
  const mapping = await safe(async () => {
    const { data } = await sb.from('print_swadpia_mapping').select('status')
    return { total: (data || []).length }
  }, { total: 0 })
  const matrix = await safe(async () => {
    const { count } = await sb
      .from('print_swadpia_price_matrix')
      .select('id', { count: 'exact', head: true })
    return count || 0
  }, 0)

  return { orders, factoryPending, factoryTotal, mapping, matrix }
}

const V_META: Record<Verdict, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  go: { label: 'GO', cls: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle2 },
  caveat: {
    label: 'GO (조건부)',
    cls: 'bg-amber-100 text-amber-800 border-amber-300',
    Icon: AlertTriangle,
  },
  nogo: { label: 'NO-GO', cls: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
}

function Badge({ v }: { v: Verdict }) {
  const m = V_META[v]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold ${m.cls}`}
    >
      <m.Icon className="h-4 w-4" /> {m.label}
    </span>
  )
}

type Axis = {
  id: string
  title: string
  question: string
  verdict: Verdict
  works: string[]
  gaps: { level: 'high' | 'med' | 'low'; text: string }[]
  evidence: string[]
}

const AXES: Axis[] = [
  {
    id: 'axis1',
    title: '① 고객 주문 → 성원 발주 정확도',
    question: '제일 중요한 고객 주문건이 성원에 오차 없이 들어가는가?',
    verdict: 'caveat',
    works: [
      '57개 제품 슬러그 → 40개 성원 category_code 매핑 (live)',
      '옵션 변환: 9개 카테고리 field-alias + 14종 후가공 필드 매핑',
      '수량 자동 스냅(용지 변경 시 수량 사다리 리로드 대응) — 테스트 통과',
      '의존 옵션 시퀀싱(무선제본 등 후행 적용) — 테스트 통과',
      '주문 교차검증 패널(OMO-2830): 스펙·수량·마진·배송·실원가 자동 대조',
      '실원가 캡처 3단 폴백 + dry-run 스냅샷(발주 직전 STOP)',
      'swadpia 관련 단위테스트 39/39 통과',
    ],
    gaps: [
      {
        level: 'med',
        text: '멀티사이즈 제품(포스터·전단·책자·브로셔): 성원 json_data가 사이즈 무시 → 기본 사이즈 가격만. 매트릭스 라우팅(OMO-3241) 플래그 OFF 상태이며 켜기 전 카테고리별 패리티 스모크 필요.',
      },
      {
        level: 'med',
        text: '토너 제품(paper-pop/foam-pop): 라이브 단가 매트릭스 없음 → 3.3배 추정 폴백. 발주 시 수동 게이트 필요.',
      },
      {
        level: 'low',
        text: '배너 카테고리: CPR5000(종이거치대)로 느슨 매핑. mini-banners(COD1100) 권장 — 보드 결정 대기.',
      },
      {
        level: 'low',
        text: 'base_price_krw NULL 제품은 margin_multiplier 3.3 하드폴백. 런칭 전 전 제품 단가 동기화 확인 필요.',
      },
    ],
    evidence: [
      'src/lib/swadpia-order.ts (발주 자동화·수량 스냅·시퀀싱·실원가 캡처)',
      'src/lib/swadpia.ts CATEGORY_MAP · src/config/swadpia-finishing-fields.ts',
      'src/components/OrderVerificationPanel.tsx · src/app/api/admin/orders/[id]/factory-order/route.ts',
      'src/lib/__tests__/swadpia-order-*.test.ts (39/39 pass)',
    ],
  },
  {
    id: 'axis2',
    title: '② 성원 제작상태 크롤링',
    question: '성원에서 제작상태(제작중 → 제작완료)를 자동으로 가져오는가?',
    verdict: 'nogo',
    works: [
      '결제상태 추적(OMO-3018): placed(미결제) → paid(결제완료) 전환 — 단, 사람 1클릭 수동',
      '결제 리컨실 크론(하루 2회): 미결제 주문 집계 → 관리자 체크리스트 이메일',
      '성원 주문번호(swadpia_order_number)·결제대기 URL 저장',
    ],
    gaps: [
      {
        level: 'high',
        text: '제작상태(제작중/제작완료/배송준비) 크롤러 자체가 미구현. DB 컬럼·크론·UI·셀렉터 전무. 현재 추적은 "결제상태"뿐이며 "제작상태"가 아님.',
      },
      {
        level: 'high',
        text: '코드에 명시적 후속 표기: 성원 마이룸 주문상태 직접 스크래핑은 "라이브 셀렉터 확정 필요한 후속 작업(OMO-2834 패턴)"으로 보류 중.',
      },
      {
        level: 'med',
        text: '성원 로그인/세션 만료 시 크롤 전체가 조용히 실패할 수 있음(자동발주·표집 공통 의존). 연속 실패 알림 루틴 필요.',
      },
    ],
    evidence: [
      'src/app/api/cron/swadpia-payment-reconcile/route.ts (결제만, 제작상태 아님)',
      'supabase/migrations/20260613000010_*.sql (swadpia_paid_at/by — 결제 컬럼만)',
      'vercel.json crons (production-status cron 없음)',
    ],
  },
  {
    id: 'axis3',
    title: '③ 에디터 후가공 → 성원 기준 파일 생성',
    question: '각 에디터에서 후가공 적용 시 성원 기준에 맞춰 파일이 생성되는가?',
    verdict: 'caveat',
    works: [
      '템플릿 생성(PDF/SVG/AI): trim/bleed/safe + M100 별색 레이어 자동 — /api/template',
      '단일 합본 파일 + 별색 스팟 레이어(OMO-2706): 디자인면 + M100 스팟판 2페이지 PDF',
      '박(foil) 경로 end-to-end 동작: 에디터 선택 → M100 렌더 → 합본 PDF → 자동발주',
      '별색 레이어명 영문화(OMO-3233): M100_Spot_Foil 등',
      '후가공 카탈로그 26종 정의 + 카테고리별 호환 매핑',
    ],
    gaps: [
      {
        level: 'high',
        text: '에디터 per-element 후가공 UI는 박(foil)만 구현(MVP). 형압/도무송/에폭시는 템플릿 카탈로그엔 있으나 에디터→발주 경로 미배선.',
      },
      {
        level: 'high',
        text: '비매핑 후가공 다수(coating/cutting/bonding/digital_foil/spot_color 등 10+종)가 카탈로그·UI엔 노출되나 자동발주 시 필드 미설정 → 무료/깨진 발주 위험(매출 누수·성원 발주 혼선).',
      },
      {
        level: 'med',
        text: '별색(spot_color)은 성원에서 별도 후가공 토글이 아니라 인쇄색 선택에 내포 → 현재 후가공으로 취급되어 적용 안 됨.',
      },
      {
        level: 'med',
        text: '디지털박: 고정가($15k 균일)이나 성원 필드 매핑 없음 + 종이 게이트 미강제 → 선택·결제는 되나 발주 멈춤 위험.',
      },
    ],
    evidence: [
      'src/app/design/[slug]/EditorClient.tsx (foil MVP: getFinishPlateDataUrl/buildPdfBlob)',
      'src/lib/spec-template.ts · src/app/api/template/route.ts (4종 스팟 규칙)',
      'src/config/finishing-catalog.ts(26종) · src/config/swadpia-finishing-fields.ts(매핑/runtime/needs_audit)',
    ],
  },
]

const GAP_DOT: Record<'high' | 'med' | 'low', string> = {
  high: 'bg-red-500',
  med: 'bg-amber-500',
  low: 'bg-slate-400',
}

// 런칭 권고: 안전한 1차 런칭 범위(스코프 축소) vs 전체 런칭 게이트.
const RECOMMENDATION = {
  overall: 'caveat' as Verdict,
  headline: '전체 카탈로그 풀 런칭은 NO-GO. 스코프 축소 1차 런칭(소프트런칭)은 조건부 GO.',
  safeScope: [
    '제품: 명함/프리미엄 명함 등 단일 사이즈 + 라이브 단가 검증된 카테고리만',
    '후가공: 박(foil)만 노출. 비매핑 10+종은 카탈로그/주문 UI에서 일시 비노출',
    '제작상태: 자동 크롤 없음을 전제로, 관리자 수동 확인 + 결제 리컨실 이메일 운영',
    '멀티사이즈/토너/배너: 1차 범위 제외(또는 수동 발주 게이트)',
  ],
  blockers: [
    'B1 (axis3): 비자동발주 후가공 10+종을 주문 UI에서 제거/숨김 — 매출 누수·깨진 발주 차단 (실행 가능, 코드 작업)',
    'B2 (axis2): 제작상태 자동 크롤 부재 — 1차엔 수동 운영으로 우회 가능하나, 풀 런칭 전 OMO-2834 패턴 구현 필요',
    'B3 (axis1): SWADPIA_MATRIX_ROUTING 플래그 + 멀티사이즈 패리티 스모크 — 멀티사이즈 판매 시 필수(보드 가격변경 게이트)',
    'B4 (운영): 자동발주 Playwright 워커는 서버리스 미동작 → 로컬/VPS 워커 호스팅 결정 필요',
  ],
}

function AxisCard({ axis }: { axis: Axis }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{axis.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{axis.question}</p>
        </div>
        <Badge v={axis.verdict} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700">
            동작 (근거 있음)
          </div>
          <ul className="space-y-1 text-sm text-slate-700">
            {axis.works.map((w, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
            갭 / 리스크
          </div>
          <ul className="space-y-1 text-sm text-slate-700">
            {axis.gaps.map((g, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${GAP_DOT[g.level]}`}
                  aria-hidden
                />
                <span>{g.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
          코드 근거 ({axis.evidence.length})
        </summary>
        <ul className="mt-1 space-y-0.5 font-mono text-xs text-slate-500">
          {axis.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

export default async function LaunchReadinessPage() {
  const live = await loadLive()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> 관리자
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">런칭 준비도 (OMO-3894)</h1>
          <Badge v={RECOMMENDATION.overall} />
        </div>
        <p className="mt-2 text-slate-600">{RECOMMENDATION.headline}</p>
        <p className="mt-1 text-xs text-slate-400">
          서버 컴포넌트 · force-dynamic — 운영 카운트는 공유 DB 실시간, 판정 근거는 코드 기준.
        </p>
      </header>

      {/* 라이브 운영 카운트 */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { k: '고객 주문', v: live.orders, sub: 'print_orders' },
          { k: '성원 발주(누적)', v: live.factoryTotal, sub: 'print_factory_orders' },
          { k: '미결제 발주', v: live.factoryPending, sub: 'status=placed' },
          { k: '매핑', v: live.mapping.total, sub: 'print_swadpia_mapping' },
          { k: '가격 매트릭스', v: live.matrix, sub: 'price_matrix 행' },
        ].map((c) => (
          <div key={c.k} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{c.v}</div>
            <div className="text-xs font-medium text-slate-600">{c.k}</div>
            <div className="font-mono text-[10px] text-slate-400">{c.sub}</div>
          </div>
        ))}
      </section>

      {/* 3대 축 스코어카드 */}
      <section className="space-y-4">
        {AXES.map((a) => (
          <AxisCard key={a.id} axis={a} />
        ))}
      </section>

      {/* 런칭 권고 */}
      <section className="mt-8 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="mb-2 text-lg font-bold text-amber-900">런칭 권고</h2>
        <p className="mb-3 text-sm font-medium text-amber-900">{RECOMMENDATION.headline}</p>

        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            안전한 1차 런칭 범위(소프트런칭)
          </div>
          <ul className="space-y-1 text-sm text-amber-900">
            {RECOMMENDATION.safeScope.map((s, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            풀 런칭 전 해소 블로커
          </div>
          <ul className="space-y-1 text-sm text-amber-900">
            {RECOMMENDATION.blockers.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

    </div>
  )
}
