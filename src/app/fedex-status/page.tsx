import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, ExternalLink, Truck, FileText, Package } from 'lucide-react'

export const metadata = {
  title: 'FedEx 통합 상태 — OMO-2365',
  description: '한국출 FedEx 배송 시스템 진행 현황 + 샌드박스 라이브 검증 결과',
}

type Captured = {
  capturedAt: string
  fedex: { base: string; account: string; env: string }
  summary: { total: number; success: number; sandboxFlake: number }
  cases: {
    label: string
    status: number
    attempts: number
    options: { serviceType: string; serviceName: string; rated?: { rateType: string; totalNetCharge: number; currency: string; totalBaseCharge?: number; totalDiscounts?: number } }[]
    alerts: { code: string; message: string }[]
    errors: { code: string; message: string }[]
  }[]
}

function loadResults(): Captured | null {
  try {
    const p = path.join(process.cwd(), 'public/fedex-status/sandbox-results.json')
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

const DONE = [
  { area: 'FedEx Rate API 라이브 견적', detail: 'OAuth2 + /rate/v1/rates/quotes, 계약 ACCOUNT rate 우선 → LIST 폴백' },
  { area: '4단 폴백 체인', detail: 'API → DB 계약식(할인%×자동화%) → direct USD → 고정 $35' },
  { area: '운임 모델', detail: 'KRW→USD 캐시, 무게 bracket 24h 캐시, VAT 10% 가산' },
  { area: '고객 노출 라이브 견적', detail: '체크아웃 시 무료배송 임계값/무게상한 + 라이브 운임 표시' },
  { area: '권역·서비스·요금표 admin', detail: '/admin/shipping (Zone × Service × Weight bracket)' },
  { area: '송장(shipment) 관리', detail: '주문당 N개 송장, 5단 상태 흐름 (pending→label_created→in_transit→delivered)' },
  { area: '송장번호 수기 입력 → 주문 상태 sync', detail: 'PATCH /api/admin/orders/{id}/shipments — order.status 자동 shipped/delivered' },
  { area: '패킹슬립 인쇄', detail: '/admin/orders/{id}/packing-slip' },
  { area: '이벤트 로그', detail: 'shipment_created / shipped / delivered → print_order_events' },
]

const NOT_DONE = [
  { area: 'FedEx Ship API (송장 자동 발급)', impact: '송장번호/PDF 라벨 수기 — Ship Manager에 다시 입력 필요', kr: 'KR origin은 Ship API + EEI 필드 KR 변형 필요' },
  { area: 'Commercial Invoice 자동 생성', impact: '한국출 통관 필수 서류 자동 생성 안 됨', kr: 'HS code, 수출자, 원산지 필드 채워 PDF 생성 + ETD 업로드 필요' },
  { area: '제품 HS code 데이터', impact: '카탈로그에 hs_code 컬럼 없음', kr: '인쇄물 491110, 봉투 481710 등 기본값 시드 필요' },
  { area: 'FedEx Pickup API', impact: '집화 예약 수기', kr: 'KR 픽업 윈도우 9-17시 제약' },
  { area: 'FedEx Track API/웹훅', impact: '배송 상태 자동 업데이트 X — 관리자 수기', kr: '고객 알림 자동화 X' },
  { area: '반품(RMA) 라벨', impact: 'returned 상태만 존재, 라벨 발급 절차 없음', kr: '한국 반품 통관 별도' },
  { area: 'KCS 수출신고 전자연동', impact: '관세청 직접 연동 X (FedEx 일괄 통관 의존)', kr: '$200(KRW 환산) 초과 시 수출신고 의무' },
]

export default function Page() {
  const data = loadResults()
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-gray-900">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold">FedEx 통합 시스템 — 진행 상태</h1>
        </div>
        <p className="text-sm text-gray-600">
          OMO-2365 · 한국출 FedEx 배송 시스템의 「무엇이 되고 무엇이 안 됐는지」 라이브 보고.
          현재 단계: <strong>Rate API 라이브 + 수기 송장</strong>.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          데이터 캡처 시각: {data?.capturedAt ?? '없음'} · 샌드박스 계정: {data?.fedex.account ?? '?'} · {data?.fedex.base ?? '?'}
        </p>
      </header>

      {/* 요약 카드 */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <CheckCircle2 className="h-5 w-5" /> 됐음
          </div>
          <p className="text-2xl font-bold text-green-900 mt-1">{DONE.length}</p>
          <p className="text-xs text-green-700 mt-1">Rate API · 송장 · 패킹슬립 · 권역/요금표</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <XCircle className="h-5 w-5" /> 안됐음
          </div>
          <p className="text-2xl font-bold text-red-900 mt-1">{NOT_DONE.length}</p>
          <p className="text-xs text-red-700 mt-1">Ship API · CI · Track 웹훅 · 픽업 · 통관</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-700 font-semibold">
            <Clock className="h-5 w-5" /> 라이브 샌드박스
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-1">{data?.summary.success ?? 0}/{data?.summary.total ?? 0}</p>
          <p className="text-xs text-blue-700 mt-1">OAuth + Rate API 성공 케이스</p>
        </div>
      </section>

      {/* 샌드박스 라이브 검증 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Package className="h-5 w-5" /> 샌드박스 라이브 견적 (계정 740561073, KR 출하 포함)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          보드가 제공한 샌드박스 creds 로 실제 FedEx API 호출 → ACCOUNT 계약 요율 반환 확인.
          국제 배송은 <code className="text-xs bg-gray-100 px-1 rounded">customsClearanceDetail</code> 자동 첨부 (
          <a href="https://github.com/sungwoo62/procardcrafters/commit/ff27ab7" className="text-blue-600 underline">commit ff27ab7</a>
          으로 운영 코드도 수정).
        </p>
        {!data ? (
          <p className="text-sm text-red-600">캡처된 데이터 없음.</p>
        ) : (
          <div className="space-y-4">
            {data.cases.map((c) => (
              <div key={c.label} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{c.label}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${c.status === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    HTTP {c.status} {c.attempts > 1 ? `(${c.attempts}회 재시도)` : ''}
                  </span>
                </div>
                {c.options.length === 0 ? (
                  <p className="text-xs text-gray-500">옵션 없음</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-gray-500">
                      <tr><th className="text-left py-1">서비스</th><th className="text-right">베이스</th><th className="text-right">할인</th><th className="text-right">최종</th><th className="text-right">유형</th></tr>
                    </thead>
                    <tbody>
                      {c.options.slice(0, 6).map((o, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-1.5">{o.serviceName ?? o.serviceType}</td>
                          <td className="text-right text-gray-500">${o.rated?.totalBaseCharge ?? '—'}</td>
                          <td className="text-right text-gray-500">${o.rated?.totalDiscounts ?? 0}</td>
                          <td className="text-right font-semibold">${o.rated?.totalNetCharge?.toFixed(2) ?? '—'}</td>
                          <td className="text-right text-gray-500">{o.rated?.rateType ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 됐음 / 안됐음 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div>
          <h2 className="text-lg font-semibold mb-3 text-green-700 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> 됐음 ({DONE.length})
          </h2>
          <div className="space-y-2">
            {DONE.map((d) => (
              <div key={d.area} className="rounded-lg border border-green-200 bg-green-50/40 p-3">
                <p className="font-medium text-sm">{d.area}</p>
                <p className="text-xs text-gray-600 mt-0.5">{d.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3 text-red-700 flex items-center gap-2">
            <XCircle className="h-5 w-5" /> 안됐음 ({NOT_DONE.length})
          </h2>
          <div className="space-y-2">
            {NOT_DONE.map((d) => (
              <div key={d.area} className="rounded-lg border border-red-200 bg-red-50/40 p-3">
                <p className="font-medium text-sm">{d.area}</p>
                <p className="text-xs text-gray-600 mt-0.5">{d.impact}</p>
                <p className="text-xs text-orange-700 mt-0.5">🇰🇷 {d.kr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 스크린샷 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5" /> 실제 화면 스크린샷
        </h2>
        <p className="text-xs text-gray-600 mb-4">
          dev 서버에서 캡처. 관리자 화면은 로그인 게이트로 인해 로그인 페이지가 보일 수 있음 — 인증 가드 자체가 정상 작동한다는 증거.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {['01-home','02-products','03-product-detail','04-admin-shipping','05-admin-orders','06-fedex-status'].map((name) => (
            <figure key={name} className="rounded-lg border border-gray-200 overflow-hidden">
              <img src={`/fedex-status/${name}.png`} alt={name} className="w-full h-auto" />
              <figcaption className="text-xs text-gray-600 px-3 py-2 bg-gray-50 border-t border-gray-200">{name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 다음 단계 */}
      <section className="mb-10 rounded-xl border border-blue-200 bg-blue-50/60 p-5">
        <h2 className="text-lg font-semibold mb-2">다음 단계 (보드 픽업 대기)</h2>
        <ol className="space-y-2 text-sm">
          <li><strong>1. Ship API (high)</strong> — 송장/PDF 라벨 자동 발급, KR origin EEI 처리</li>
          <li><strong>2. Commercial Invoice + HS code (high)</strong> — 통관 PDF 자동 생성 + 카탈로그 hs_code 컬럼</li>
          <li><strong>3. Track API/웹훅 (medium)</strong> — 배송 상태 자동 sync + 고객 알림</li>
          <li><strong>4. Pickup + RMA (low)</strong> — 픽업 자동 예약 + 반품 라벨</li>
        </ol>
        <p className="text-xs text-blue-700 mt-3">
          OMO-2365 의 suggest_tasks interaction 에서 픽업 시 자식 이슈 자동 생성.
        </p>
      </section>

      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-500 flex items-center gap-2">
        <Link href="/" className="hover:underline">홈</Link>
        <span>·</span>
        <a href="https://github.com/sungwoo62/procardcrafters/commit/ff27ab7" className="hover:underline flex items-center gap-1">commit ff27ab7 <ExternalLink className="h-3 w-3" /></a>
        <span>·</span>
        <span>FedEx 샌드박스, 운영 키 별도</span>
      </footer>
    </main>
  )
}
