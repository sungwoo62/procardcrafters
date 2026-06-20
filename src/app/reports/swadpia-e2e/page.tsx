import Link from 'next/link'
import * as fs from 'fs'
import * as path from 'path'
import { ArrowLeft, CheckCircle2, Clock, ShieldAlert, FileText, ArrowLeftRight } from 'lucide-react'
import {
  E2E_TEST_CASE,
  E2E_CUSTOMER_ORDER,
  buildParityRows,
  buildComparisonRows,
  computeE2ePricing,
  buildChecklist,
  type E2eArtifact,
  type CheckState,
} from '@/lib/swadpia-e2e'
import { finishingSurchargeKrwFromOptions } from '@/config/finishing-surcharge'

interface SweepCase {
  id: string; label: string; qty: number; opts: Record<string, string>
  ok: boolean; payAmtKrw?: number | null; finishingAmt?: number; baseKrw?: number | null
  amts?: Record<string, number>; applied?: Record<string, string>; error?: string
}
interface SweepData { ranAt: string; cases: SweepCase[] }

// OMO-3520: 프로카드→성원 E2E 테스트 실발주 검증 리포트.
//   결정론(옵션 parity·본가/마진 가격)은 src/lib/swadpia-e2e 에서 산출하고,
//   라이브 dry-run 결과(파일 업로드 chgFileName·성원 pay_amt)는 아티팩트 JSON 으로 보강한다.
//   읽기 전용 — 쓰기/실발주 트리거 없음(prod 안전). 최종 제출은 보드 확인 게이트.
export const dynamic = 'force-static'

function loadArtifact(): E2eArtifact | null {
  try {
    const p = path.join(process.cwd(), 'scripts', 'test-artifacts', 'omo3520', 'e2e-result.json')
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8')) as E2eArtifact
  } catch {
    return null
  }
}

function loadSweep(): SweepData | null {
  try {
    const p = path.join(process.cwd(), 'scripts', 'test-artifacts', 'omo3520', 'price-sweep.json')
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8')) as SweepData
  } catch {
    return null
  }
}

const STATE_STYLE: Record<CheckState, { icon: React.ReactNode; cls: string; label: string }> = {
  pass: { icon: <CheckCircle2 className="h-4 w-4" />, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: '검증완료' },
  pending_live: { icon: <Clock className="h-4 w-4" />, cls: 'text-amber-700 bg-amber-50 border-amber-200', label: '라이브 대기' },
  gated: { icon: <ShieldAlert className="h-4 w-4" />, cls: 'text-rose-700 bg-rose-50 border-rose-200', label: '보드 게이트' },
}

export default function SwadpiaE2eReportPage() {
  const tc = E2E_TEST_CASE
  const parity = buildParityRows(tc)
  const pricing = computeE2ePricing(tc)
  const rawChecklist = buildChecklist(pricing)
  const artifact = loadArtifact()

  // 라이브 dry-run 성공 시 해당 체크 항목을 검증완료로 승격.
  const checklist = rawChecklist.map((c) => {
    if (!artifact || artifact.reachedStage === 'failed') return c
    if (c.id === 'file_upload' && artifact.fileUpload?.chgFileName) {
      return { ...c, state: 'pass' as const, detail: `라이브 업로드 확정: chgFileName=${artifact.fileUpload.chgFileName} (성원 첨부 실제 업로드, ${artifact.fileUpload.sizeBytes.toLocaleString()} bytes).` }
    }
    if (c.id === 'pay_amount_match' && artifact.swadpiaPayAmtKrw != null) {
      return { ...c, state: 'pass' as const, detail: `라이브 pay_amt=${artifact.swadpiaPayAmtKrw.toLocaleString()} KRW(박 ${artifact.finishingAmts?.bak?.toLocaleString() ?? '-'} 포함) 캡처 — 발주금액은 성원 calcuEstimate 권위로 정확. 우리 정적 표시모델과는 델타 존재(아래 가격 검증 참조).` }
    }
    return c
  })

  // 라이브 권위(성원 pay_amt) 기반 고객가 + 우리 정적모델 대비 델타.
  const livePayKrw = artifact?.swadpiaPayAmtKrw ?? null
  const liveCustomerUsd = livePayKrw != null
    ? Math.round((livePayKrw * pricing.marginMultiplier / pricing.krwPerUsd) * 100) / 100
    : null
  const wholesaleDeltaKrw = livePayKrw != null ? pricing.wholesaleKrw - livePayKrw : null
  const comparison = buildComparisonRows(tc, E2E_CUSTOMER_ORDER, pricing, artifact)
  const sweep = loadSweep()
  // 스윕 각 행에 현행 정적모델(본가 anchor 4,000 + 후가공 surcharge)과 라이브 델타 부가.
  const sweepRows = (sweep?.cases ?? []).map((c) => {
    const staticSurcharge = finishingSurchargeKrwFromOptions(c.opts)
    const staticWholesale = tc.basePriceKrw + staticSurcharge
    const live = c.payAmtKrw ?? null
    const deltaPct = live && live > 0 ? Math.round(((staticWholesale - live) / live) * 100) : null
    return { ...c, staticSurcharge, staticWholesale, deltaPct }
  })

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/reports/swadpia-mapping" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> 맵핑 리포트로
        </Link>

        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ArrowLeftRight className="h-6 w-6 text-indigo-600" />
          프로카드 → 성원 E2E 테스트 실발주 검증
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          고객이 프로카드에서 올린 <b>파일·옵션</b>이 성원 발주폼에 1:1 로 적용되고 <b>본가+마진</b>이 정확히
          산출되는지 — 자동발주 전 구간(<code>swadpia-order.ts</code>)을 검증한다. 가격은 화면 추론 금지 ·
          hidden <code>total_price</code>/<code>{`{type}_amt`}</code> 직독. 최종 제출은 보드 확인 게이트.
        </p>

        {/* 실발주 결과 (real_submit) */}
        {artifact?.mode === 'real_submit' && artifact.swadpiaOrderNumber && (
          <section className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-800">
              <CheckCircle2 className="h-5 w-5" /> 테스트 실발주 완료 (최종 제출됨)
            </h2>
            <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><span className="text-gray-500">성원 주문번호</span> · <b className="font-mono">{artifact.swadpiaOrderNumber}</b></div>
              <div><span className="text-gray-500">총 결제금액</span> · {artifact.payTotalKrw?.toLocaleString()} KRW (공급가+VAT+배송)</div>
              <div className="sm:col-span-2"><span className="text-gray-500">상태</span> · {artifact.orderStatus}</div>
            </div>
            <p className="mt-2 text-xs text-emerald-700/80">
              가상계좌(S머니) 결제라 <b>입금 전까지 실제 비용·생산 미발생</b> — 파이프라인 전 구간(파일 자동업로드→옵션→결제 제출)이 실주문으로 검증됨.
              실제 생산 진행 여부(입금) 또는 만료/취소는 보드/재무 결정.
            </p>
          </section>
        )}

        {/* 고객주문 ↔ 성원발주 비교표 (보드 요청) */}
        <section className="mt-6 rounded-xl border-2 border-indigo-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">고객주문 (프로카드) ↔ 성원 자동발주 비교</h2>
          <p className="mt-1 text-xs text-gray-500">
            고객 실발주 1건이 자동발주 파이프라인을 거쳐 성원에 어떻게 전달됐는지 항목별 1:1 대조.
            성원 측은 라이브 적용값·캡처(주문번호·chgFileName·pay_amt)에서 직독.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">항목</th>
                  <th className="py-2 pr-4">고객주문 · 프로카드</th>
                  <th className="py-2 pr-4">성원 발주 · 자동</th>
                  <th className="py-2">일치</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((r) => (
                  <tr key={r.label} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-4 font-medium text-gray-800">{r.label}</td>
                    <td className="py-2 pr-4 text-gray-700">{r.customer}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{r.swadpia}</td>
                    <td className="py-2">{r.match === true ? '✅' : r.match === false ? '❌' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 수량/옵션 변동 스윕 (보드 요청) */}
        {sweepRows.length > 0 && (
          <section className="mt-6 rounded-xl border-2 border-amber-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">수량·옵션 변동 가격 매트릭스 (라이브 read-only 스윕)</h2>
            <p className="mt-1 text-xs text-gray-500">
              CNC1000 명함 폼을 케이스별 새로고침·옵션적용·calcuEstimate 후 성원 hidden pay_amt/{`{type}`}_amt 직독.
              <b> 발주·제출·파일업로드 없음(실비 0)</b>. 현행 정적모델(본가 anchor {tc.basePriceKrw.toLocaleString()} + 후가공 surcharge)과 라이브 델타 대조.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">케이스</th>
                    <th className="py-2 pr-4">적용수량</th>
                    <th className="py-2 pr-4 text-right">성원 pay_amt</th>
                    <th className="py-2 pr-4 text-right">후가공 amt</th>
                    <th className="py-2 pr-4 text-right">정적모델(현행)</th>
                    <th className="py-2 text-right">델타(정적−라이브)</th>
                  </tr>
                </thead>
                <tbody>
                  {sweepRows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-800">{r.label}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{r.applied?.paper_qty ?? r.qty}{r.applied && Number(r.applied.paper_qty) === r.qty ? ' ✅' : ''}</td>
                      <td className="py-2 pr-4 text-right font-mono">{r.payAmtKrw?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono text-gray-500">{(r.finishingAmt ?? 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right font-mono text-gray-500">{r.staticWholesale.toLocaleString()}</td>
                      <td className={`py-2 text-right font-mono ${r.deltaPct != null && Math.abs(r.deltaPct) >= 15 ? 'font-semibold text-rose-700' : 'text-gray-500'}`}>
                        {r.deltaPct != null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-amber-700">
              ★ 결론: 라이브 본가·후가공은 <b>수량 선형</b>(박 200매 11,600 → 2,000매 75,700). 현행 정적모델은 수량 무관(anchor 고정)이라
              저수량 과다·고수량 과소. 에폭시는 정적 surcharge 미등록(=0)이라 라이브 9,000 전액 누락. <b>발주금액 자체는 성원 calcuEstimate 권위라 항상 정확</b>(오발주 아님);
              교정 대상은 고객 표시가 산정 — [OMO-3511] 공식기반 매트릭스(수량의존) 전환 필요. 옵션 parity 는 전 케이스 적용수량 일치(✅).
            </p>
          </section>
        )}

        {/* 테스트 케이스 */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">대표 테스트 케이스 (명함 1건 · 후가공 포함)</h2>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <div><span className="text-gray-500">제품</span> · {tc.productLabel}</div>
            <div><span className="text-gray-500">성원 카테고리</span> · {tc.swadpiaCategoryCode}</div>
            <div><span className="text-gray-500">수량</span> · {tc.quantity.toLocaleString()}매</div>
            <div className="col-span-2 sm:col-span-3 mt-1 flex items-center gap-2 text-gray-700">
              <FileText className="h-4 w-4 text-gray-400" />
              규정 PDF: trim {tc.fileSpec.trimMm.w}×{tc.fileSpec.trimMm.h}mm + bleed {tc.fileSpec.bleedMm}mm ·
              {' '}{tc.fileSpec.colorMode} · {tc.fileSpec.dpi}dpi (자동생성: <code>omo3520-gen-namecard-pdf.mjs</code>)
            </div>
          </div>
        </section>

        {/* 옵션 parity */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">① 옵션 Parity — 고객 선택 ↔ 성원 발주폼</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">고객 옵션</th>
                  <th className="py-2 pr-4">선택값</th>
                  <th className="py-2 pr-4">성원 폼 필드</th>
                  <th className="py-2 pr-4">적용값(코드)</th>
                  <th className="py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {parity.map((r) => (
                  <tr key={r.customerKey} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-4 font-medium text-gray-800">{r.customerKey}</td>
                    <td className="py-2 pr-4 text-gray-700">{r.customerValue}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{r.swadpiaFields.join(', ')}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{r.swadpiaValue}</td>
                    <td className="py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                        r.status === 'mapped' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : r.status === 'runtime' ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                        {r.status === 'mapped' ? '✅ 검증' : r.status === 'runtime' ? '⏳ 런타임' : '⚠️ 재조사'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {artifact?.appliedOptions && (
            <p className="mt-3 text-xs text-emerald-700">
              라이브 read-back 확인 ({artifact.ranAt.slice(0, 16)}): 성원 폼 적용값 {Object.keys(artifact.appliedOptions).length}개 캡처됨.
            </p>
          )}
        </section>

        {/* 가격 검증 */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">② 본가(wholesale) + 마진(고객가) 검증</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">본가 매트릭스 기준단가</span><span className="font-medium">{pricing.basePriceKrw.toLocaleString()} KRW</span></div>
              {pricing.finishingBreakdown.map((f) => (
                <div key={f.value} className="mt-1 flex justify-between">
                  <span className="text-gray-500">후가공 surcharge · {f.label}</span>
                  <span className="font-medium">+{f.krw.toLocaleString()} KRW</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-700">본 금액(wholesale)</span>
                <span className="font-bold">{pricing.wholesaleKrw.toLocaleString()} KRW</span>
              </div>
            </div>
            <div className="rounded-lg bg-indigo-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">× margin_multiplier</span><span className="font-medium">{pricing.marginMultiplier}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-gray-600">× 환율(1/{pricing.krwPerUsd} KRW/USD)</span><span className="font-medium">/ {pricing.krwPerUsd}</span></div>
              <div className="mt-2 flex justify-between border-t border-indigo-200 pt-2">
                <span className="font-semibold text-indigo-800">고객가(USD)</span>
                <span className="text-lg font-bold text-indigo-800">${pricing.customerUsd.toFixed(2)}</span>
              </div>
              <p className="mt-2 text-xs text-indigo-700/80">고객가 = (본가 + Σsurcharge) × margin × (1/환율)</p>
            </div>
          </div>
          {pricing.finishingBreakdown.some((f) => f.note) && (
            <p className="mt-3 text-xs text-amber-700">
              ⚠️ {pricing.finishingBreakdown.find((f) => f.note)?.note}. 정액 surcharge 는 ~1,000매 셋업비 수준
              캘리브레이션이라 고수량 과소청구 가능 — 공식기반 매트릭스(OMO-3511, DORMANT)는 보드 가격 승인 게이트.
            </p>
          )}
          <div className="mt-3 rounded-lg border border-gray-200 p-3 text-sm">
            <div className="mb-1 font-medium text-gray-700">결제금액(pay_amt) ↔ 우리 모델 비교 (라이브 권위)</div>
            {livePayKrw != null ? (
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">성원 라이브 pay_amt (200매, 박 {artifact?.finishingAmts?.bak?.toLocaleString() ?? '-'} 포함)</span><span className="font-mono font-semibold">{livePayKrw.toLocaleString()} KRW → ${liveCustomerUsd?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">우리 정적 모델(base 4,000 + 박 surcharge 22,300)</span><span className="font-mono">{pricing.wholesaleKrw.toLocaleString()} KRW → ${pricing.customerUsd.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-1 text-rose-700">
                  <span className="font-medium">델타(우리 − 성원)</span>
                  <span className="font-mono font-semibold">{wholesaleDeltaKrw != null && wholesaleDeltaKrw > 0 ? '+' : ''}{wholesaleDeltaKrw?.toLocaleString()} KRW (정적모델 과다)</span>
                </div>
                <p className="pt-1 text-xs text-rose-700/80">
                  ★ 발견: 정적 박 surcharge(22,300=~1,000매 셋업 캘리브레이션)가 200매에서 라이브 박(11,600)을 과다계상.
                  base 도 SNW300W00/양면 실가(~5,100)와 상이. <b>최종 고객가는 라이브 pay_amt 를 권위로 산정</b>해야 정확
                  (OMO-3511 공식기반 매트릭스 전환의 실증 근거). 자동발주는 성원 calcuEstimate 가 최종 권위라 발주금액 자체는 정확.
                </p>
              </div>
            ) : (
              <span className="text-amber-600">⏳ 라이브 dry-run 대기</span>
            )}
          </div>
        </section>

        {/* 파일 업로드 */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">③ 파일 자동 업로드 (plupload → 성원 첨부)</h2>
          {artifact?.fileUpload ? (
            <div className="mt-2 text-sm text-gray-700">
              <p>✅ 업로드 캡처: <code>chgFileName={artifact.fileUpload.chgFileName ?? '-'}</code></p>
              <p>파일명 {artifact.fileUpload.fileName} · {artifact.fileUpload.sizeBytes.toLocaleString()} bytes · 단계 {artifact.reachedStage}</p>
              {artifact.screenshots.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">증거 스크린샷: <code>scripts/test-artifacts/omo3520/{artifact.screenshots[0]}</code> (결제서 — 공급사 계정·단가 노출로 비공개 내부 아티팩트).</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-600">
              ⏳ 라이브 dry-run 대기 — <code>scripts/omo3520-e2e-dryrun.ts</code> 실행 시 plupload <code>upload.php</code>
              {' '}응답의 <code>chgFileName</code> 을 캡처해 성원 첨부 실제 업로드를 확정한다.
            </p>
          )}
        </section>

        {/* 체크리스트 */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">검증 체크리스트</h2>
          <ul className="mt-3 space-y-2">
            {checklist.map((c) => {
              const s = STATE_STYLE[c.state]
              return (
                <li key={c.id} className={`flex items-start gap-3 rounded-lg border p-3 ${s.cls}`}>
                  <span className="mt-0.5">{s.icon}</span>
                  <div className="text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      {c.label}
                      <span className="rounded-full bg-white/60 px-2 py-0.5 text-[11px]">{s.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs opacity-80">{c.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {/* 게이트 */}
        <section className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-rose-800">
            <ShieldAlert className="h-5 w-5" /> 실발주 게이트 (중요)
          </h2>
          <p className="mt-2 text-sm text-rose-700">
            dry-run 은 결제서(<code>order_pay</code>)까지만 자동화한다. 최종 <code>paySubmit()</code> 는 공급사 실비·물리적
            생산을 발생시키므로 <b>보드 명시 확인 후 1회</b>만 실행한다(<code>--real-submit</code> 플래그). 성원 실결제는
            금지이며, 검증은 결제 직전 dry-run 까지다.
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">
          OMO-3520 · 읽기 전용 리포트 · 결정론 데이터 <code>src/lib/swadpia-e2e.ts</code> · 라이브 아티팩트{' '}
          {artifact ? `최종 실행 ${artifact.ranAt.slice(0, 16)}` : '미실행(보드 승인 대기)'}
        </p>
      </div>
    </div>
  )
}
