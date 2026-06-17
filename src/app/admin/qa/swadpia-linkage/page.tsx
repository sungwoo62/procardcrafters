// OMO-2961: 우리사이트 ↔ 성원애드피아 옵션 연동 "소켓" 교차검수 대시보드.
//
//   배경(보드 요청):
//     "각 소켓이 맞는지 교차검수 — 옵션이 틀어지면 큰일. 풀링크 줘봐, 웹 만들어서 보고해."
//   → 후가공/옵션 매핑이 코드 곳곳에 흩어져 있으면 드리프트(소리없는 어긋남)가 난다.
//     이 페이지는 매핑의 단일 진실원천(config) 을 그대로 읽어, 각 "소켓"(고객 후가공
//     → 성원 발주폼 필드)의 상태와 자동 교차검수 결과를 한 화면에서 보여준다.
//
//   설계 원칙:
//     - 정적 데모가 아니라 config 에서 라이브 파생 → 코드가 바뀌면 이 화면도 자동 반영(드리프트 0).
//     - 교차검수(cross-check)는 빌드/요청 시점에 실제로 변환을 돌려 선언↔구현 일치를 검사한다.
//     - DB/네트워크 비의존(성원 실호출 없음, 비용가드) → 어디서든 즉시 로드.
//
//   인증: middleware 가 /admin/* 를 isAllowedAdmin 으로 게이트 → 별도 가드 불필요.
export const dynamic = 'force-dynamic'

import { FINISHING_CATALOG, FINISHING_BY_VALUE } from '@/config/finishing-catalog'
import {
  SWADPIA_FINISHING_FIELDS,
  SWADPIA_FINISHING_BY_VALUE,
  AUTO_ORDERABLE_FINISHINGS,
  DEFAULT_FINISHING_FIELD_VALUES,
  expandFinishingToSwadpiaFields,
  type SwadpiaFinishingMapping,
} from '@/config/swadpia-finishing-fields'
import {
  SWADPIA_CATEGORY_AUDIT,
  SWADPIA_CATEGORY_AUDIT_DATE,
  SWADPIA_MAPPED_FINISHING_COUNT,
  SWADPIA_UNMAPPED_FINISHINGS,
} from '@/config/swadpia-category-audit'
import {
  reverseCoverageSummary,
  reverseMissingSwadpia,
} from '@/lib/swadpia-coverage'

// ─── 교차검수 로직 (선언 config ↔ 실제 변환) ──────────────────────────────────

type CheckResult = { id: string; label: string; pass: boolean; detail: string }

function runCrossChecks(): CheckResult[] {
  const checks: CheckResult[] = []

  // A. 카탈로그 ↔ 매핑 1:1 (양쪽 누락 없음)
  const catalogValues = new Set(FINISHING_CATALOG.map((f) => f.value))
  const mappingValues = new Set(SWADPIA_FINISHING_FIELDS.map((m) => m.finishingValue))
  const missingInMapping = [...catalogValues].filter((v) => !mappingValues.has(v))
  const missingInCatalog = [...mappingValues].filter((v) => !catalogValues.has(v))
  checks.push({
    id: 'A',
    label: '카탈로그 ↔ 성원필드 매핑 1:1 (고아 소켓 없음)',
    pass: missingInMapping.length === 0 && missingInCatalog.length === 0,
    detail:
      missingInMapping.length === 0 && missingInCatalog.length === 0
        ? `${catalogValues.size}개 후가공이 양쪽에 모두 정의됨`
        : `매핑누락:[${missingInMapping.join(',') || '없음'}] / 카탈로그누락:[${missingInCatalog.join(',') || '없음'}]`,
  })

  // B. status='mapped' ⟺ DEFAULT_FINISHING_FIELD_VALUES 보유 (자동발주 정합성)
  const declaredAuto = new Set(AUTO_ORDERABLE_FINISHINGS)
  const hasDefaults = new Set(Object.keys(DEFAULT_FINISHING_FIELD_VALUES))
  const autoNoDefault = [...declaredAuto].filter((v) => !hasDefaults.has(v))
  const defaultNotAuto = [...hasDefaults].filter((v) => !declaredAuto.has(v))
  checks.push({
    id: 'B',
    label: "자동발주(status='mapped') ⟺ 기본값(DEFAULT) 보유 일치",
    pass: autoNoDefault.length === 0 && defaultNotAuto.length === 0,
    detail:
      autoNoDefault.length === 0 && defaultNotAuto.length === 0
        ? `${declaredAuto.size}개 자동발주 후가공 전부 발주 기본값 보유`
        : `기본값없는 자동:[${autoNoDefault.join(',') || '없음'}] / 자동아닌 기본값:[${defaultNotAuto.join(',') || '없음'}]`,
  })

  // C. 변환 round-trip: 각 자동발주 후가공에 대해 expandFinishingToSwadpiaFields 가
  //    finishing 키를 제거하고 비어있지 않은 성원 필드코드를 실제로 생성하는지.
  const transformFails: string[] = []
  for (const v of AUTO_ORDERABLE_FINISHINGS) {
    const out = expandFinishingToSwadpiaFields({ finishing: v })
    if ('finishing' in out) transformFails.push(`${v}(finishing키 잔류)`)
    else if (Object.keys(out).length === 0) transformFails.push(`${v}(빈 결과)`)
  }
  checks.push({
    id: 'C',
    label: '고객선택 → 성원필드 변환 실제동작 (finishing 키 소거 + 필드 생성)',
    pass: transformFails.length === 0,
    detail: transformFails.length === 0 ? `${AUTO_ORDERABLE_FINISHINGS.length}개 변환 정상` : transformFails.join(', '),
  })

  // D. 선언↔구현: 자동발주 후가공의 정적(non-runtime) 선언필드가 변환결과에 모두 채워지는지.
  const wireGaps: string[] = []
  for (const v of AUTO_ORDERABLE_FINISHINGS) {
    const mapping = SWADPIA_FINISHING_BY_VALUE[v]
    const out = expandFinishingToSwadpiaFields({ finishing: v })
    const staticFields = mapping.fields.filter((f) => !f.runtimeOnly).map((f) => f.name)
    const unfilled = staticFields.filter((name) => out[name] === undefined)
    if (unfilled.length) wireGaps.push(`${v}:[${unfilled.join(',')}]`)
  }
  checks.push({
    id: 'D',
    label: '선언된 정적필드 전부 자동충전 (소켓 완전배선)',
    pass: wireGaps.length === 0,
    detail: wireGaps.length === 0 ? '자동발주 후가공의 모든 정적필드가 기본값으로 채워짐' : `미배선: ${wireGaps.join(' / ')}`,
  })

  return checks
}

const STATUS_META: Record<SwadpiaFinishingMapping['status'], { ko: string; cls: string }> = {
  mapped: { ko: '자동발주 검증', cls: 'bg-green-100 text-green-800 border-green-300' },
  runtime: { ko: '런타임 추출 필요', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  needs_audit: { ko: '카테고리 재조사', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
}

export default function SwadpiaLinkageDashboard() {
  const checks = runCrossChecks()
  const allPass = checks.every((c) => c.pass)

  const counts = SWADPIA_FINISHING_FIELDS.reduce(
    (acc, m) => {
      acc[m.status] += 1
      return acc
    },
    { mapped: 0, runtime: 0, needs_audit: 0 } as Record<SwadpiaFinishingMapping['status'], number>,
  )
  const total = SWADPIA_FINISHING_FIELDS.length

  // OMO-3409: 양방향 축별 커버리지 매트릭스 (제품/후가공/사이즈/용지)
  const reverse = reverseCoverageSummary()
  const reverseMissing = reverseMissingSwadpia()
  // 후가공 역방향 누락 = 성원 카테고리가 제공하나 우리가 자동발주 미매핑한 추가 후가공.
  const finishingReverseMissing = SWADPIA_UNMAPPED_FINISHINGS.length
  // 핵심옵션(사이즈/용지)은 카테고리별 1:1 패스스루(런타임 json_data) — coreOk 비율로 본다.
  const coreOkCount = SWADPIA_CATEGORY_AUDIT.filter((c) => c.coreOk).length
  const coreTotal = SWADPIA_CATEGORY_AUDIT.length

  type AxisRow = {
    axis: string
    forward: string
    reverse: string
    status: '✅' | '⏳' | '⚠️'
    note: string
  }
  const axisMatrix: AxisRow[] = [
    {
      axis: '제품(카테고리)',
      forward: `${reverse.coveredCount}/${reverse.catalogTotal} 커버 (${reverse.coveragePct}%)`,
      reverse: `누락 ${reverse.missingCount} (커버후보 ${reverse.gapCount} / 의도적 ${reverse.intentionalCount})`,
      status: reverse.gapCount === 0 ? '✅' : '⚠️',
      note: '커버 판정은 CATEGORY_MAP(slug→code) 라이브 파생. 역방향 누락 상세는 /reports/swadpia-mapping.',
    },
    {
      axis: '후가공(옵션코드)',
      forward: `자동발주 검증 ${counts.mapped} + 런타임추출 ${counts.runtime}`,
      reverse: `재조사 ${counts.needs_audit} · 추가 후가공 미매핑 ${finishingReverseMissing}종`,
      status: counts.needs_audit === 0 && finishingReverseMissing === 0 ? '✅' : '⏳',
      note: '박은 total_price 미포착 → 별색 surcharge 분리 산정(finishing-surcharge).',
    },
    {
      axis: '사이즈(paper_size)',
      forward: `핵심옵션 ${coreOkCount}/${coreTotal} 카테고리 1:1 패스스루`,
      reverse: '런타임 json_data 파생 — 정적 열거 대상 아님',
      status: coreOkCount === coreTotal ? '✅' : '⚠️',
      note: '멀티사이즈/디지털/토너는 hidden total_price 크롤 적재로 보강(SWADPIA_MATRIX_ROUTING).',
    },
    {
      axis: '용지(paper_code)',
      forward: `핵심옵션 ${coreOkCount}/${coreTotal} 카테고리 1:1 패스스루`,
      reverse: '런타임 json_data 파생 — 정적 열거 대상 아님',
      status: coreOkCount === coreTotal ? '✅' : '⚠️',
      note: '용지별 유효수량(매수)은 사다리 스냅(OMO-2485)으로 흡수.',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">옵션 연동 소켓 교차검수 — 우리사이트 ↔ 성원애드피아 (OMO-2961)</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          고객 에디터에서 고르는 후가공/옵션이 성원애드피아 발주폼의 어떤 필드로 들어가는지를 "소켓"이라 부른다.
          이 화면은 매핑의 <strong>단일 진실원천(config)</strong> 을 그대로 읽어 각 소켓의 상태와{' '}
          <strong>자동 교차검수 결과</strong>를 보여준다. 정적 캡처가 아니라 코드에서 라이브 파생되므로
          매핑이 바뀌면 이 화면도 자동으로 따라간다(드리프트 0). 성원 실호출 없음(비용 0).
        </p>
      </header>

      {/* 종합 상태 */}
      <section
        className={`rounded-lg border p-4 ${allPass ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-2xl ${allPass ? 'text-green-600' : 'text-red-600'}`}>{allPass ? '✓' : '✗'}</span>
          <div>
            <div className="font-semibold text-gray-900">
              교차검수 종합: {allPass ? '전체 통과 — 연동 정합성 이상 없음' : '주의 — 어긋난 소켓 발견(아래 상세)'}
            </div>
            <div className="text-sm text-gray-600">
              후가공 소켓 {total}종 · 자동발주 검증 {counts.mapped} / 런타임 추출 {counts.runtime} / 카테고리 재조사{' '}
              {counts.needs_audit}
            </div>
          </div>
        </div>
      </section>

      {/* OMO-3409: 양방향 축별 커버리지 매트릭스 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">
          양방향 축별 커버리지 매트릭스 — 우리↔성원 (OMO-3409)
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          보드 지시(OMO-3238): 맵핑은 <strong>상호</strong>로 본다. 제품·후가공·사이즈·용지 축마다
          <strong> 우리→성원(커버)</strong> 과 <strong>성원→우리(누락)</strong> 를 한 줄로 비교한다.
          제품 축 역방향 누락 상세는 <code>/reports/swadpia-mapping</code> 의 "상호 커버리지" 섹션을 본다.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div className="text-xs text-indigo-600">성원→우리 제품 커버리지</div>
            <div className="text-2xl font-bold text-indigo-700">{reverse.coveragePct}%</div>
            <div className="text-xs text-indigo-500">
              {reverse.coveredCount}/{reverse.catalogTotal}종
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs text-amber-600">제품 역방향 누락(커버후보)</div>
            <div className="text-2xl font-bold text-amber-700">{reverse.gapCount}</div>
            <div className="text-xs text-amber-500">의도적 미커버 {reverse.intentionalCount}종 별도</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="text-xs text-green-600">후가공 자동발주/런타임</div>
            <div className="text-2xl font-bold text-green-700">
              {counts.mapped}/{counts.runtime}
            </div>
            <div className="text-xs text-green-500">재조사 {counts.needs_audit}종</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">후가공 역방향 미매핑</div>
            <div className="text-2xl font-bold text-gray-700">{finishingReverseMissing}</div>
            <div className="text-xs text-gray-400">성원 추가 후가공(OMO-2904)</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600 border-b">
                <th className="p-2 font-medium">축</th>
                <th className="p-2 font-medium">우리 → 성원 (커버)</th>
                <th className="p-2 font-medium">성원 → 우리 (누락)</th>
                <th className="p-2 font-medium whitespace-nowrap">상태</th>
                <th className="p-2 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {axisMatrix.map((a) => (
                <tr key={a.axis} className="border-b align-top hover:bg-gray-50">
                  <td className="p-2 font-medium text-gray-800 whitespace-nowrap">{a.axis}</td>
                  <td className="p-2 text-gray-700">{a.forward}</td>
                  <td className="p-2 text-gray-700">{a.reverse}</td>
                  <td className="p-2 text-lg whitespace-nowrap">{a.status}</td>
                  <td className="p-2 text-xs text-gray-500 max-w-xs">{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 제품 역방향 누락 드릴다운 */}
        <details className="rounded border border-amber-200 bg-amber-50/50">
          <summary className="cursor-pointer p-3 text-sm font-medium text-amber-900">
            성원→우리 제품 역방향 누락 {reverse.missingCount}종 펼쳐보기
          </summary>
          <div className="overflow-x-auto border-t border-amber-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-amber-50 text-left text-amber-800 border-b border-amber-200">
                  <th className="p-2 font-medium">성원 코드</th>
                  <th className="p-2 font-medium">성원 제품명</th>
                  <th className="p-2 font-medium whitespace-nowrap">분류</th>
                  <th className="p-2 font-medium">미커버 사유</th>
                </tr>
              </thead>
              <tbody>
                {reverseMissing.map((m) => (
                  <tr key={m.code} className="border-b border-amber-100 align-top last:border-0">
                    <td className="p-2">
                      <code className="text-xs text-amber-900">{m.code}</code>
                    </td>
                    <td className="p-2 text-gray-800">{m.label}</td>
                    <td className="p-2 whitespace-nowrap text-xs">
                      {m.gapKind === 'gap' ? (
                        <span className="text-amber-700">⚠️ 커버후보</span>
                      ) : (
                        <span className="text-gray-500">▫ 의도적</span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-gray-500">{m.gapNote ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* 자동 교차검수 4종 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">자동 교차검수 (요청 시점 실행)</h2>
        <div className="space-y-2">
          {checks.map((c) => (
            <div
              key={c.id}
              className={`flex items-start gap-3 rounded border p-3 text-sm ${
                c.pass ? 'bg-white border-gray-200' : 'bg-red-50 border-red-300'
              }`}
            >
              <span className={`mt-0.5 font-bold ${c.pass ? 'text-green-600' : 'text-red-600'}`}>
                {c.pass ? 'PASS' : 'FAIL'}
              </span>
              <div>
                <div className="font-medium text-gray-800">
                  [{c.id}] {c.label}
                </div>
                <div className="text-gray-500">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 후가공 소켓 매트릭스 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">후가공 소켓 매트릭스 ({total}종)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600 border-b">
                <th className="p-2 font-medium">후가공 (한/영)</th>
                <th className="p-2 font-medium">연동 상태</th>
                <th className="p-2 font-medium">성원 발주폼 필드</th>
                <th className="p-2 font-medium">자동발주 기본값</th>
                <th className="p-2 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {SWADPIA_FINISHING_FIELDS.map((m) => {
                const cat = FINISHING_BY_VALUE[m.finishingValue]
                const meta = STATUS_META[m.status]
                const defaults = DEFAULT_FINISHING_FIELD_VALUES[m.finishingValue]
                return (
                  <tr key={m.finishingValue} className="border-b align-top hover:bg-gray-50">
                    <td className="p-2">
                      <div className="font-medium text-gray-800">
                        {m.label_ko}{' '}
                        <span className="text-gray-400 font-normal">/ {cat?.label_en ?? m.finishingValue}</span>
                      </div>
                      <code className="text-xs text-gray-400">{m.finishingValue}</code>
                    </td>
                    <td className="p-2">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs whitespace-nowrap ${meta.cls}`}>
                        {meta.ko}
                      </span>
                    </td>
                    <td className="p-2">
                      {m.fields.length === 0 ? (
                        <span className="text-gray-400 text-xs">— (필드 미조사)</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {m.fields.map((f) => (
                            <li key={f.name} className="text-xs">
                              <code className="text-gray-700">{f.name}</code>{' '}
                              {f.runtimeOnly ? (
                                <span className="text-amber-600">(런타임)</span>
                              ) : (
                                <span className="text-gray-400">({Object.keys(f.options ?? {}).length}값)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="p-2">
                      {defaults ? (
                        <ul className="space-y-0.5">
                          {Object.entries(defaults).map(([k, v]) => (
                            <li key={k} className="text-xs text-gray-600">
                              <code>{k}</code>=<code className="text-green-700">{v}</code>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-gray-500 max-w-xs">{m.note ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 핵심 옵션 패스스루 경로 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">
          핵심 주문옵션 연동 (종이종류·매수·디자인건수·기타) — OMO-2961 라이브 검증 2026-06-12
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600 border-b">
                <th className="p-2 font-medium">우리 옵션</th>
                <th className="p-2 font-medium">성원 폼 필드</th>
                <th className="p-2 font-medium">연동</th>
                <th className="p-2 font-medium">비고 (성원 명함폼 실측)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['종이종류', 'paper_code', '✅ 1:1', '스노우지 250/300g 등 — 선택값 그대로 전달'],
                ['사이즈', 'paper_size', '✅ 1:1', '90×50 등 — 1:1 패스스루'],
                ['매수(수량)', 'paper_qty', '✅ 사다리 스냅', '종이별 수량옵션(최대 57종) 자동 리로드 → 가장 가까운 유효수량 스냅(OMO-2485)'],
                ['인쇄색', 'print_color_type', '✅ 1:1', '양면칼라/단면칼라/인쇄없음 (카테고리별 alias 변환)'],
                ['디자인건수', 'order_count', '✅ 기본 1', '우리는 1주문=1디자인 모델 → 1 고정(성원 기본값과 동일, 1~120 지원)'],
                ['디자인방식', 'f/b_design_type', '✅ 해당없음', '우리는 고객 파일 직접 업로드(order_path=ODP10) → 성원이 업로드 파일을 디자인으로 인식. design_type 은 "디자인 의뢰" 주문에서만 쓰는 필드라 파일업로드 경로에선 숨김/미사용(정상)'],
              ].map(([ours, field, status, note]) => (
                <tr key={field} className="border-b align-top hover:bg-gray-50">
                  <td className="p-2 font-medium text-gray-800">{ours}</td>
                  <td className="p-2"><code className="text-xs text-gray-700">{field}</code></td>
                  <td className="p-2 whitespace-nowrap text-green-700">{status}</td>
                  <td className="p-2 text-xs text-gray-500">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-sm text-gray-600 leading-relaxed bg-gray-50 border rounded p-4 space-y-2">
          <p>
            핵심 옵션은 후가공과 달리 <strong>이름 1:1 패스스루</strong>다. 고객 <code>selected_options</code> 의 key 가
            성원 goods_view 폼의 <code>select[name]</code> 와 동일해 <code>selectOrderOptions</code>(swadpia-order.ts)가
            별도 변환 없이 채운다(카테고리별 차이는 <code>SWADPIA_FIELD_ALIAS</code> 로 흡수).
          </p>
          <p>
            라이브 파리티 감사: 표준 카테고리 22종 옵션 일치(OMO-2902), 대표 3종 E2E + 성원 발주폼 dry-run
            스샷으로 가격까지 대조(OMO-2903). 비표준 16종은 DB 폴백가로 발주(라이브 swadpia 우회), 그중 4종
            (스티커·도무송·전단·엽서)은 generic 옵션 미매핑 → 보드 결정 대기(OMO-2904).
          </p>
        </div>
      </section>

      {/* OMO-2961: 전 카테고리 라이브 감사 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">
          전 카테고리 옵션 매핑 감사 ({SWADPIA_CATEGORY_AUDIT.length}종 · 라이브 스냅샷 {SWADPIA_CATEGORY_AUDIT_DATE})
        </h2>
        <p className="text-sm text-gray-600">
          성원 goods_view 폼을 카테고리별로 전수 조사한 결과. <strong>핵심옵션(종이·사이즈·매수·인쇄색)은 {SWADPIA_CATEGORY_AUDIT.filter((c) => c.coreOk).length}/{SWADPIA_CATEGORY_AUDIT.length} 카테고리 매핑 완료.</strong>{' '}
          자동발주 후가공 {SWADPIA_MAPPED_FINISHING_COUNT}종(박·형압·도무송·타공·넘버링·귀도리·에폭시·오시·미싱)은 전 카테고리 공통 필드명이라 제공 카테고리 어디서든 작동한다.
          각 카테고리의 "추가 후가공"(코팅·재단·제본·접지·창·테이프 등)은 아직 미매핑 → 카테고리별 추출 진행(OMO-2904).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600 border-b">
                <th className="p-2 font-medium">카테고리</th>
                <th className="p-2 font-medium">핵심옵션</th>
                <th className="p-2 font-medium">매핑 후가공</th>
                <th className="p-2 font-medium">미매핑 추가 후가공</th>
              </tr>
            </thead>
            <tbody>
              {SWADPIA_CATEGORY_AUDIT.map((c) => (
                <tr key={c.code} className="border-b align-top hover:bg-gray-50">
                  <td className="p-2">
                    <span className="font-medium text-gray-800">{c.label}</span>{' '}
                    <code className="text-xs text-gray-400">{c.code}</code>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {c.coreOk ? (
                      <span className="text-green-700">✅ 매핑</span>
                    ) : (
                      <span className="text-red-600">✗ {(c.coreMiss ?? []).join(',')}</span>
                    )}
                  </td>
                  <td className="p-2 text-gray-600">
                    {c.mappedFinishings}/{SWADPIA_MAPPED_FINISHING_COUNT}
                  </td>
                  <td className="p-2 text-xs text-gray-400">
                    {c.extraFinishings.length ? c.extraFinishings.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          <strong>미매핑 추가 후가공 전체({SWADPIA_UNMAPPED_FINISHINGS.length}종):</strong>{' '}
          {SWADPIA_UNMAPPED_FINISHINGS.join(', ')} — 카테고리별 런타임 추출 대상(OMO-2904).
          비카드 카테고리(전단/포스터/브로슈어 등)의 인쇄색은 성원이 앞/뒷면 색상도수(fside_color_amount)로
          분리해 받으므로 값코드(CTN↔도수) 정합화도 함께 진행한다.
        </p>
      </section>

      <footer className="text-xs text-gray-400 border-t pt-4 space-y-1">
        <div>
          데이터 원천: <code>src/config/swadpia-finishing-fields.ts</code> ·{' '}
          <code>src/config/finishing-catalog.ts</code> (성원 CNC1000 라이브 조사 2026-06-08, OMO-2633).
        </div>
        <div>
          관련: OMO-2902 파리티 감사 · OMO-2903 E2E/dry-run · OMO-2904 비표준 커버 · OMO-2830 주문 교차검증 패널.
        </div>
      </footer>
    </div>
  )
}
