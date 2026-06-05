import Link from 'next/link'
import { ArrowLeft, ExternalLink, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-static'

type Row = {
  ourSlug: string
  ourLabel: string
  ourCurrentQty: string
  ourPlannedQty: string
  swadpiaCode: string
  swadpiaMatrix: '있음' | '없음 (DB 폴백)' | '있음 (매칭 실패 → DB 폴백)' | '미연동'
  swadpiaMinQty: string
  interproRoute: string
  interproMinQty: string
  interproQtyPattern: string
  interproStartPrice: string
  notes: string
}

const ROWS: Row[] = [
  {
    ourSlug: 'business-cards',
    ourLabel: '명함',
    ourCurrentQty: '100 / 200 / 500 / 1,000 / 2,000',
    ourPlannedQty: '변경 없음 (OMO-2384 배지)',
    swadpiaCode: 'CNC1000',
    swadpiaMatrix: '있음',
    swadpiaMinQty: '500 (SNW250) / 200 (SNW300)',
    interproRoute: '/order/form/dmynamecard',
    interproMinQty: '100',
    interproQtyPattern: '100~1,000(100단위) → 1,000~10,000(200단위)',
    interproStartPrice: '2,900원~',
    notes: 'Interpro: 디지털 인쇄 = 100단위 매우 세밀. 우리: 100/200 동일가격 배지로 처리 (Swadpia 최소 500).',
  },
  {
    ourSlug: 'premium-business-cards',
    ourLabel: '프리미엄 명함',
    ourCurrentQty: '200 / 500 / 1,000',
    ourPlannedQty: '변경 없음',
    swadpiaCode: 'CNC2000',
    swadpiaMatrix: '있음',
    swadpiaMinQty: '200',
    interproRoute: '/order/form/omynamecard (offset)',
    interproMinQty: '확인 불가 (WAF 500)',
    interproQtyPattern: '오프셋 라인 — 통상 500+',
    interproStartPrice: '확인 불가',
    notes: '오프셋 변형 — Interpro 페이지 접근 차단. 가설: 오프셋은 500+ 시작.',
  },
  {
    ourSlug: 'stickers',
    ourLabel: '스티커',
    ourCurrentQty: '500 / 1,000 / 2,000 / 3,000',
    ourPlannedQty: '변경 없음 (옵션 A)',
    swadpiaCode: 'CST1000',
    swadpiaMatrix: '없음 (DB 폴백)',
    swadpiaMinQty: '500 (DB)',
    interproRoute: '/order/form/dsticker',
    interproMinQty: '확인 불가 (WAF 500)',
    interproQtyPattern: '확인 불가',
    interproStartPrice: '6,300원~',
    notes: 'Interpro 시작가 6,300원 → 시안 1매 가능성. 우리 500 최소: Swadpia 발주 정합성 우선.',
  },
  {
    ourSlug: 'die-cut-stickers',
    ourLabel: '도무송 스티커',
    ourCurrentQty: '100 / 200 / 500 / 1,000',
    ourPlannedQty: '변경 없음',
    swadpiaCode: 'CST2000',
    swadpiaMatrix: '없음 (DB 폴백)',
    swadpiaMinQty: '100 (DB)',
    interproRoute: '(dsticker 통합)',
    interproMinQty: '확인 불가',
    interproQtyPattern: '확인 불가',
    interproStartPrice: '6,300원~ (스티커 통합)',
    notes: 'Interpro는 도무송을 sticker 카테고리에 통합. 우리 100 시작은 경쟁력 있음.',
  },
  {
    ourSlug: 'flyers',
    ourLabel: '전단지',
    ourCurrentQty: '2,000 / 4,000 / 8,000 / 12,000',
    ourPlannedQty: '500 / 1,000 / 2,000 / 4,000 / 8,000 (보드 지시)',
    swadpiaCode: 'CLF1000',
    swadpiaMatrix: '없음 (DB 폴백)',
    swadpiaMinQty: '2,000 (DB) — Swadpia 실효 최소',
    interproRoute: '/order/form/dleaflet',
    interproMinQty: '2',
    interproQtyPattern: '2매 시작, 2단위 증가 → 100, …, 2,000',
    interproStartPrice: '확인 불가 (동적 계산)',
    notes: '⚠️ Interpro: 디지털 전단 MOQ 2매 — 압도적 진입장벽 차이. 보드 지시(500/1,000 추가)로 격차 일부 해소. Swadpia 디지털 라인 검토 필요.',
  },
  {
    ourSlug: 'brochures',
    ourLabel: '브로셔',
    ourCurrentQty: '1,000 / 2,000 / 4,000 / 6,000',
    ourPlannedQty: '변경 없음 (옵션 A)',
    swadpiaCode: 'CLF2000',
    swadpiaMatrix: '있음',
    swadpiaMinQty: '1,000',
    interproRoute: '/order/form/dbook',
    interproMinQty: '확인 불가 (시작가 6,100원~)',
    interproQtyPattern: '짝수 페이지 입력, 권수 동적',
    interproStartPrice: '6,100원~',
    notes: 'Interpro: 브로셔를 book 카테고리로 처리 (짝수 페이지). 우리 1,000 최소가 캠페인용 포지셔닝과 합치.',
  },
  {
    ourSlug: 'postcards',
    ourLabel: '엽서',
    ourCurrentQty: '100 / 200 / 300 / 400 / 500',
    ourPlannedQty: '변경 없음',
    swadpiaCode: 'CDP3000',
    swadpiaMatrix: '없음 (DB 폴백)',
    swadpiaMinQty: '100 (DB)',
    interproRoute: '/order/form/dpostcard',
    interproMinQty: '1',
    interproQtyPattern: '1~100매 (1단위)',
    interproStartPrice: '확인 불가 (동적)',
    notes: 'Interpro: 1매부터 가능 (디지털 1매 인쇄). 우리 100 시작도 경쟁력 있음 (선물용 시장).',
  },
  {
    ourSlug: 'posters',
    ourLabel: '포스터',
    ourCurrentQty: '250 / 500 / 1,000 / 1,500 / 2,000',
    ourPlannedQty: '100 / 250 / 500 / 1,000 / 2,000 (보드 지시)',
    swadpiaCode: 'CPR2000',
    swadpiaMatrix: '있음 (매칭 실패 → DB 폴백)',
    swadpiaMinQty: '250 (DB)',
    interproRoute: '/order/form/dposter',
    interproMinQty: '1',
    interproQtyPattern: '1~100매 (1단위)',
    interproStartPrice: '3,000원~',
    notes: '⚠️ Interpro: 1매부터, 3,000원~. 우리 250 → 100 인하해도 여전히 격차. 보드 지시 적정.',
  },
  {
    ourSlug: 'banners',
    ourLabel: '배너 / 현수막',
    ourCurrentQty: '1 / 2 / 3 / 5 / 10',
    ourPlannedQty: '변경 없음',
    swadpiaCode: 'CPR5000',
    swadpiaMatrix: '없음 (DB 폴백)',
    swadpiaMinQty: '1 (DB)',
    interproRoute: '/order/form/photobanner',
    interproMinQty: '확인 불가 (WAF 500)',
    interproQtyPattern: '확인 불가',
    interproStartPrice: '확인 불가',
    notes: 'Interpro 페이지 접근 차단. 우리 1장 시작은 업계 표준.',
  },
  {
    ourSlug: 'eco-stickers',
    ourLabel: '친환경 스티커',
    ourCurrentQty: '100 / 500 / 1,000 / 2,000',
    ourPlannedQty: '변경 없음',
    swadpiaCode: '(미연동)',
    swadpiaMatrix: '미연동',
    swadpiaMinQty: '— (자체 공급)',
    interproRoute: '— (취급 없음)',
    interproMinQty: '—',
    interproQtyPattern: '—',
    interproStartPrice: '—',
    notes: 'Interpro에 친환경 전용 라인 없음 — 우리만의 차별화 카테고리.',
  },
]

const SUMMARY_INSIGHTS = [
  {
    title: '전단지(flyers): 디지털 라인 부재가 가장 큰 격차',
    body: 'Interpro 디지털 전단 MOQ 2매 / 우리 Swadpia 최소 2,000. 보드 지시(500/1,000 추가)로 일부 해소되지만 근본 차이는 Swadpia가 오프셋 위주 발주 라인이라는 점. 디지털 폴백 공급사 추가 검토 필요.',
  },
  {
    title: '포스터·엽서: 디지털 1매 인쇄 시장 진입 기회',
    body: 'Interpro는 두 카테고리 모두 1매 시작 — 선물·이벤트·시안 시장 점유. 우리 포스터 100매 인하(보드 지시) 적정. 엽서는 이미 100 시작 — 경쟁력 유지.',
  },
  {
    title: '명함: MOQ는 동등, 가격 투명성에서 차이',
    body: 'Interpro 디지털 명함 MOQ 100, 우리도 100. 다만 Interpro는 100~10,000 사이 100/200 단위 매우 세밀 — "정확히 1,500매 필요한" 고객 대응 가능. 우리는 100/200/500/1,000/2,000 5단계로 사용성 차이.',
  },
  {
    title: '스티커: Interpro 시작가 6,300원 — 시안 출력 가능성',
    body: '우리 500 최소 vs Interpro 시작가 6,300원. 디지털 단가 가능성 — 시안·트라이얼 시장. 옵션 B (100/200 추가) 재고려 가치 있음.',
  },
  {
    title: 'Interpro 접근 차단 카테고리 (서버 500)',
    body: '도무송 스티커, 오프셋(전단·포스터·명함), 배너 — 각 페이지가 WAF로 차단됨. 직접 견적 요청 또는 영업 채널 통한 보완 조사 필요.',
  },
]

function Badge({ tone, children }: { tone: 'green' | 'yellow' | 'red' | 'gray'; children: React.ReactNode }) {
  const toneClass = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-700',
  }[tone]
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>
}

export default function MoqPricingComparisonPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={14} /> 어드민
        </Link>

        <header className="mt-4 border-b border-gray-200 pb-6">
          <h1 className="text-2xl font-bold text-gray-900">MOQ · 가격 레인지 비교 리포트</h1>
          <p className="mt-1 text-sm text-gray-600">
            우리(omoongmoo / procardcrafters) · Swadpia(성원애드피아 발주) · Interpro(interproprint.com) 3자 비교 — 2026-06-05 기준
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>관련: <Link href="/admin/reports/moq-pricing-comparison" className="underline">이 페이지</Link></span>
            <span>· OMO-2385 수량 옵션 마이그레이션 계획 동반</span>
            <span>· OMO-2384 동일가격 배지 1차 조치 완료 (commit 0fe9aa9)</span>
          </div>
        </header>

        <section className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-yellow-700" />
            <div className="text-sm text-yellow-900">
              <p className="font-medium">데이터 수집 한계</p>
              <p className="mt-1">
                Interpro의 오프셋 라인(omynamecard/oleaflet/oposter), 도무송 스티커, 배너 페이지는 서버 500 오류로 직접 조회 불가.
                향후 영업 채널 / 견적 요청으로 보완 필요. 디지털 라인 데이터만 100% 신뢰 가능.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">핵심 인사이트</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {SUMMARY_INSIGHTS.map((insight, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">{insight.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">{insight.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">카테고리별 전수 비교</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">카테고리</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">현재 우리 옵션</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">계획안 (OMO-2385)</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Swadpia 코드 / 최소</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Interpro MOQ</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Interpro 수량 패턴</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Interpro 시작가</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ROWS.map((row) => (
                  <tr key={row.ourSlug} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-900">{row.ourLabel}</div>
                      <div className="text-[10px] text-gray-500">{row.ourSlug}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{row.ourCurrentQty}</td>
                    <td className="px-3 py-3 text-gray-900">
                      {row.ourPlannedQty.includes('보드 지시') ? (
                        <Badge tone="green">{row.ourPlannedQty}</Badge>
                      ) : (
                        <span className="text-gray-600">{row.ourPlannedQty}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      <div className="font-mono text-[10px] text-gray-500">{row.swadpiaCode}</div>
                      <div className="mt-0.5">
                        {row.swadpiaMatrix === '있음' && <Badge tone="green">{row.swadpiaMatrix}</Badge>}
                        {row.swadpiaMatrix === '없음 (DB 폴백)' && <Badge tone="yellow">{row.swadpiaMatrix}</Badge>}
                        {row.swadpiaMatrix === '있음 (매칭 실패 → DB 폴백)' && <Badge tone="red">{row.swadpiaMatrix}</Badge>}
                        {row.swadpiaMatrix === '미연동' && <Badge tone="gray">{row.swadpiaMatrix}</Badge>}
                      </div>
                      <div className="mt-1 text-[11px]">{row.swadpiaMinQty}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-900 font-semibold">{row.interproMinQty}</td>
                    <td className="px-3 py-3 text-gray-700 text-[11px]">{row.interproQtyPattern}</td>
                    <td className="px-3 py-3 text-gray-700">{row.interproStartPrice}</td>
                    <td className="px-3 py-3 text-[11px] leading-relaxed text-gray-600">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">권장 액션 (보드 결정용)</h2>
            <ol className="mt-3 space-y-2 text-sm text-gray-700">
              <li>
                <span className="font-semibold">1. OMO-2385 권장안 즉시 진행</span>
                <p className="mt-0.5 text-xs text-gray-600">flyers/posters 보드 지시안 적용 — Interpro 디지털 라인과의 격차 일부 해소.</p>
              </li>
              <li>
                <span className="font-semibold">2. 디지털 인쇄 공급사 추가 검토</span>
                <p className="mt-0.5 text-xs text-gray-600">
                  Interpro 디지털 전단 MOQ 2매 / 포스터·엽서 1매 = 시안·소량·이벤트 시장.
                  Swadpia 단일 의존으로는 이 시장 진입 불가.
                </p>
              </li>
              <li>
                <span className="font-semibold">3. 명함 100단위 세분화 검토</span>
                <p className="mt-0.5 text-xs text-gray-600">
                  Interpro 100~10,000 사이 100/200단위. 우리 100/200/500/1,000/2,000 5단계.
                  사용자 임의 입력 지원 시 +10~20% conversion 가능성.
                </p>
              </li>
              <li>
                <span className="font-semibold">4. Interpro 차단 카테고리 영업 채널 조사</span>
                <p className="mt-0.5 text-xs text-gray-600">
                  오프셋·도무송·배너 — 견적 요청 또는 동종업계 데이터로 보완.
                </p>
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">방법론 · 데이터 출처</h2>
            <ul className="mt-3 space-y-2 text-xs text-gray-600">
              <li>
                <strong>우리 옵션:</strong> <code>supabase/migrations/20260605000010_print_options_swadpia_constraint.sql</code> 의 paper_qty 시드.
              </li>
              <li>
                <strong>Swadpia 매트릭스:</strong> ProductConfigurator <code>lookupSwadpiaCost</code> + print_info1/paper_info 분석 ({' '}
                <code>docs/plans/OMO-2384-quantity-options-audit.md</code>).
              </li>
              <li>
                <strong>Interpro 데이터:</strong> 2026-06-05 직접 페이지 fetch.
                디지털 라인(dmynamecard / dleaflet / dposter / dpostcard / dbook / dpackage / denvelope)은 정상 조회 완료.
                오프셋·도무송·배너 라인은 서버 500 오류로 미수집.
              </li>
              <li>
                <strong>가격 비교 한계:</strong> Interpro 가격은 모두 동적 JS 계산 — 카테고리별 시작가만 home에 노출.
                정밀 단가 비교 불가 (시안 발주 또는 영업 채널 통해 견적표 확보 필요).
              </li>
            </ul>

            <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
              <a
                href="https://www.interproprint.com/"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                interproprint.com <ExternalLink size={12} />
              </a>
              <a
                href="https://www.swadpia.co.kr/"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                swadpia.co.kr <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
          <p>리포트 생성: 2026-06-05 · CEO 에이전트 (Paperclip) · OMO-2385</p>
          <p className="mt-1">전체 매트릭스/SQL 변경 계획은 OMO-2385 plan 문서 참조.</p>
        </footer>
      </div>
    </div>
  )
}
