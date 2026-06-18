import Link from 'next/link'
import { ArrowLeft, ArrowLeftRight, Database, AlertTriangle, BadgeCheck, ListTree } from 'lucide-react'
import {
  CENSUS,
  buildProductMappingRows,
  productCoverage,
  FOIL_COLOR_MAPPING,
  SWADPIA_ANCHORS,
  buildBaseDiff,
  buildFoilDiff,
  buildOptionMappability,
  CATALOG,
  VAT_RATE,
} from '@/lib/printcity-namecard'

// OMO-3414 (보드 지시 2026-06-17, OMO-3411 파생): printcity 명함 전수 census +
// 우리↔printcity 맵핑 커버리지 + printcity↔성원 가격차 비교 대시보드.
// 데이터: src/data/printcity-namecard-census.json (price-api.dtp21.com/v2 공개 GET JSON 직독).
export const dynamic = 'force-static'

const fmt = (n: number | undefined | null) =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('ko-KR')
const won = (n: number | undefined | null) =>
  n == null || Number.isNaN(n) ? '—' : `${n.toLocaleString('ko-KR')}원`
const pct = (n: number) => (Number.isNaN(n) ? '—' : `${n > 0 ? '+' : ''}${n}%`)

// board ③ capability 검증 결과 (scripts/test-artifacts/omo3414/order-capability.json 요약)
const ORDER_CAPABILITY: { step: string; ok: string; evidence: string }[] = [
  { step: '로그인', ok: '✅ 가능', evidence: 'OAuth/GetAuthorization HTTP 200 + JWT 발급, 멤버명 "올팩마이스터님" 노출, 헤더 로그아웃 표시.' },
  { step: '테스트 주문 진입', ok: '✅ 가능', evidence: '/product/NameCard "주문하기" 동작 → 주문 단계 패널 렌더(파일첨부 UI 6요소).' },
  { step: '파일 업로드', ok: '✅ 가능', evidence: '주문 단계 input[type=file] 확인 → 테스트 PDF 첨부 성공.' },
  { step: '결제', ok: '⛔ 미실행', evidence: '결제 게이트 노출되나 클릭 안함(실발주/결제 금지 — 보드 게이트).' },
]

export default function PrintcityNamecardReport() {
  const products = CENSUS.products
  const cov = productCoverage()
  const mapRows = buildProductMappingRows()
  const baseDiff = buildBaseDiff()
  const foilDiff = buildFoilDiff()
  const optMap = buildOptionMappability()
  const pricedCount = products.filter((p) => p.counts.combos > 0).length
  const foilProduct = products.find((p) => p.hasFoil)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/reports/swadpia-mapping"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> 성원 맵핑 리포트
      </Link>

      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">
          printcity 명함 전수 census · 성원 가격차 비교
        </h1>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        OMO-3454(OMO-3411/3414/3452 파생). printcity <b>실제 스토어프론트</b>(
        <code className="rounded bg-gray-100 px-1">site/seller/printcity</code> menuCategory[명함]) 명함{' '}
        <b>{CENSUS.productCount}제품</b>을 <b>공개 GET JSON API</b>(
        <code className="rounded bg-gray-100 px-1">price-api.dtp21.com/v2</code>)로 직독.
        가격은 OCR/LLM 추론 없이 JSON 직독(읽기전용, 실주문 없음). 캡처:{' '}
        {new Date(CENSUS.capturedAt).toLocaleString('ko-KR')}.
      </p>

      {/* 요약 카드 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={<Database className="h-4 w-4" />} label="명함 제품 census" value={`${CENSUS.productCount}건`} sub={`가격표 적재 ${pricedCount}건`} />
        <SummaryCard icon={<BadgeCheck className="h-4 w-4" />} label="우리 카탈로그 맵핑" value={`${cov.mapped}/${cov.total}`} sub={`갭 ${cov.gaps.length}건`} />
        <SummaryCard icon={<ArrowLeftRight className="h-4 w-4" />} label="박/엣지박 보유" value={`${products.filter((p) => p.hasFoil).length}건`} sub={`${foilProduct?.foilColors.length ?? 0}색(엣지명함)`} />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="가격 직독 방식" value="JSON API" sub="성원=hidden total / printcity=공개 GET" />
      </div>

      {/* 핵심 결론 */}
      <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
        <div className="font-semibold">한 줄 결론</div>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            printcity 명함은 <b>priceComplete 완성형 룩업</b>: 박/엣지박이 옵션축(
            <code className="rounded bg-indigo-100 px-1">bakKindCode</code>)으로 가격표에 <b>번들</b>
            (성원은 base + 박 surcharge <b>분리형</b>). 박 가격을 RE 없이 색상별 완성가로 직독.
          </li>
          <li>
            표준 명함 base 200매: printcity <b>{won(baseDiff.find((r) => r.printcityName === '일반 명함')?.printcityKrw)}</b>{' '}
            vs 성원 앵커 <b>{won(SWADPIA_ANCHORS.baseNamecardWholesaleKrw.krw)}</b>{' '}
            (<b>{pct(baseDiff.find((r) => r.printcityName === '일반 명함')?.diffPct ?? NaN)}</b>).
          </li>
          <li>
            가격 컷오버/공급사 전환은 <b>보드 게이트</b>. 본 페이지는 읽기전용 분석 리포트.
          </li>
        </ul>
      </div>

      {/* 전체 카탈로그 링크 배너 (board ④) */}
      <Link
        href="/reports/printcity-catalog"
        className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 hover:bg-emerald-100"
      >
        <span className="flex items-center gap-2">
          <ListTree className="h-4 w-4" />
          <b>printcity 전체 제품군 전수 크롤링</b> — {CATALOG.productCount}제품 / {CATALOG.categoryCount}개 1차 카테고리 리스트업 보기
        </span>
        <span className="text-emerald-600">→</span>
      </Link>

      {/* 1. census 테이블 */}
      <Section title="① printcity 명함 전수 census" desc="제품별 옵션축·수량범위·대표 base 단가(우리가 printcity 공급 시 원가).">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <Th>제품(KO)</Th><Th>분류</Th><Th>가격결정</Th><Th right>용지</Th><Th right>사이즈</Th>
                <Th right>조합</Th><Th right>수량</Th><Th right>박색</Th><Th right>base 200매</Th><Th right>base 1000매</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{p.nameKO}</td>
                  <td className="text-gray-500">{p.category3rd ?? '—'}</td>
                  <td className="text-gray-500">{p.priceType === 'priceComplete' ? '룩업' : '계산'}</td>
                  <Td right>{p.counts.material}</Td>
                  <Td right>{p.counts.size}</Td>
                  <Td right>{p.counts.combos || <span className="text-amber-600">0(draft)</span>}</Td>
                  <Td right>{p.quantities.length ? `${p.quantities[0]}~${p.quantities[p.quantities.length - 1]}` : '—'}</Td>
                  <Td right>{p.hasFoil ? <span className="font-semibold text-indigo-600">{p.foilColors.length}</span> : '—'}</Td>
                  <Td right>{won(p.baseByQty['200'])}</Td>
                  <Td right>{won(p.baseByQty['1000'])}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 2. 우리↔printcity 맵핑 커버리지 */}
      <Section title="② 우리(procardcrafters) ↔ printcity 맵핑 커버리지" desc={`맵핑 ${cov.mapped}/${cov.total} · 갭 ${cov.gaps.length}건. 양방향: 우리 카탈로그 대응 여부 + printcity 측 미커버.`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <Th>printcity 제품</Th><Th>분류</Th><Th>→ 우리 slug</Th><Th>상태</Th><Th>비고</Th>
              </tr>
            </thead>
            <tbody>
              {mapRows.map((r) => (
                <tr key={r.printcityId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{r.printcityName}{r.hasFoil && <span className="ml-1 rounded bg-indigo-100 px-1 text-xs text-indigo-700">박</span>}</td>
                  <td className="text-gray-500">{r.category3rd ?? '—'}</td>
                  <td>{r.ourLabel ? <code className="rounded bg-gray-100 px-1 text-xs">{r.ourSlug}</code> : <span className="text-gray-400">—</span>}</td>
                  <td>{r.mapped ? <span className="text-green-700">✅ 맵핑</span> : <span className="text-amber-600">⚠️ 갭</span>}</td>
                  <td className="text-xs text-gray-500">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cov.gaps.length > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            갭(우리 미보유): {cov.gaps.map((g) => g.printcityName).join(', ')} — 점자/포토카드/피켓은 명함 외 또는 미취급군.
          </p>
        )}
      </Section>

      {/* 2-B. 옵션 맵핑 가능 상태 (board ①) */}
      <Section title="②-B 옵션 맵핑 가능 상태 (용지·사이즈·도수·코팅·박)" desc="명함 전 제품의 옵션축을 전수 수집 → 우리 카탈로그 대응 가능여부 판정. ✅1:1 / ⚠️큐레이션·검토 / ❌미보유. 큐레이션 규칙 기반, 미검증은 ⚠️로 정직 표기.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <Th>옵션축</Th><Th right>고유옵션</Th><Th right>✅맵핑</Th><Th right>⚠️검토</Th><Th right>❌갭</Th><Th>상태</Th><Th>예시(printcity → 우리)</Th>
              </tr>
            </thead>
            <tbody>
              {optMap.map((a) => (
                <tr key={a.axis} className="border-b border-gray-100 align-top hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{a.axis}</td>
                  <Td right>{a.distinctOptions}</Td>
                  <Td right>{a.mappable}</Td>
                  <Td right>{a.partial}</Td>
                  <Td right>{a.gap}</Td>
                  <td className="px-2">{a.status === '✅' ? <span className="text-green-700">✅ 맵핑</span> : a.status === '⚠️' ? <span className="text-amber-600">⚠️ 부분</span> : <span className="text-red-600">❌ 갭</span>}</td>
                  <td className="px-2 text-xs text-gray-500">
                    {a.examples.slice(0, 4).map((e) => (
                      <div key={e.title}>{e.verdict} <b>{e.title}</b> → {e.ours}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          요약: 도수(단/양면)·표준 사이즈·기본 코팅(무광/유광)은 <b>1:1 맵핑 가능</b>. 수입지 용지 등급과 특수코팅(홀로그램/벨벳)은 <b>개별 큐레이션 필요</b>(⚠️). 박/엣지박은 색상 맵핑표(③) 보유.
        </p>
      </Section>

      {/* 3. 박 색상 맵핑 */}
      <Section title="③ 박(엣지박) 색상 맵핑 · printcity ↔ 우리 ↔ 성원" desc="printcity 엣지박 12색 ↔ 우리 finishing(foil_stamp/별색) ↔ 성원 박종류. ✅검증 / ⏳추정 / ⚠️재조사.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <Th>printcity 코드</Th><Th>색상</Th><Th>→ 우리 finishing</Th><Th>→ 성원(추정)</Th><Th>검증</Th>
              </tr>
            </thead>
            <tbody>
              {FOIL_COLOR_MAPPING.map((f) => (
                <tr key={f.printcityCode} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2"><code className="rounded bg-gray-100 px-1 text-xs">{f.printcityCode}</code></td>
                  <td className="text-gray-900">{f.printcityTitle}</td>
                  <td className="text-gray-600">{f.ourFinishing}</td>
                  <td className="text-gray-600">{f.swadpiaHint}</td>
                  <td>{f.verified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 4. 가격차 — base + 총액/부가세 (board ①) */}
      <Section title="④ 가격차 분석 — base 명함 + 총액·부가세 (printcity vs 성원)" desc={`동일 200매 base 비교. printcity 직독가=공급가(부가세 별도) → 부가세 ${VAT_RATE * 100}% 별산 → 합계(총액). 성원 앵커: ${SWADPIA_ANCHORS.baseNamecardWholesaleKrw.source}.`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <Th>printcity 제품</Th><Th right>수량</Th><Th right>공급가</Th><Th right>부가세(10%)</Th><Th right>합계(총액)</Th><Th right>성원(앵커)</Th><Th right>차액</Th><Th right>차이%</Th>
              </tr>
            </thead>
            <tbody>
              {baseDiff.map((r) => (
                <tr key={r.printcityName} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{r.printcityName}</td>
                  <Td right>{r.qty}매</Td>
                  <Td right>{won(r.printcityKrw)}</Td>
                  <Td right>{won(r.printcityVat)}</Td>
                  <td className="px-2 text-right font-semibold text-gray-900">{won(r.printcityTotal)}</td>
                  <Td right>{won(r.swadpiaKrw)}</Td>
                  <td className={`px-2 text-right ${r.diffKrw < 0 ? 'text-green-700' : 'text-red-600'}`}>{r.diffKrw > 0 ? '+' : ''}{fmt(r.diffKrw)}원</td>
                  <td className={`px-2 text-right font-semibold ${r.diffPct < 0 ? 'text-green-700' : 'text-red-600'}`}>{pct(r.diffPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          차액/차이%는 <b>공급가 기준</b>(성원 앵커도 공급가/도매가). 부가세 별도 가정은 <code className="rounded bg-gray-100 px-1">price-api</code>에 vat 필드 부재(전수 확인)에 근거하며, 아래 ⑥ 로그인 dry-run의 장바구니 합계 라인에서 최종 확인 대상.
        </p>
      </Section>

      {/* 5. 가격차 — 박 */}
      <Section title="⑤ 가격차 분석 — 박(엣지박) 완성가 vs 성원 분리형" desc="printcity 엣지명함 금박-유광 완성가(박 번들) vs 성원 추정(base 앵커 + 박 surcharge 22,300). 모델 구조가 달라 절대 비교는 200매 앵커 구간만 산정.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <Th>박 색상</Th><Th right>수량</Th><Th right>printcity 완성가</Th><Th right>(printcity 박프리미엄)</Th><Th right>성원 추정총액</Th><Th right>차액</Th><Th right>차이%</Th>
              </tr>
            </thead>
            <tbody>
              {foilDiff.map((r) => (
                <tr key={r.qty} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{r.printcityColor}</td>
                  <Td right>{r.qty}매</Td>
                  <Td right>{won(r.printcityTotalKrw)}</Td>
                  <Td right>{Number.isNaN(r.printcityFoilPremiumKrw) ? '—' : `+${fmt(r.printcityFoilPremiumKrw)}원`}</Td>
                  <Td right>{Number.isNaN(r.swadpiaEstTotalKrw) ? '미표집(gap)' : won(r.swadpiaEstTotalKrw)}</Td>
                  <td className={`px-2 text-right ${r.diffKrw < 0 ? 'text-green-700' : 'text-red-600'}`}>{Number.isNaN(r.diffKrw) ? '—' : `${r.diffKrw > 0 ? '+' : ''}${fmt(r.diffKrw)}원`}</td>
                  <td className={`px-2 text-right font-semibold ${r.diffPct < 0 ? 'text-green-700' : 'text-red-600'}`}>{pct(r.diffPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          ⚠️ 성원 base 곡선은 q200=4,000원 단일 앵커만 라이브 검증됨 → 100/1000매 성원 총액은 <b>미표집(gap)</b>으로 비워둠.
          printcity 엣지박은 프리미엄 용지(Extra 350g)에 박 번들이라, 박 단독 단가가 아니라 <b>용지+박 묶음 완성가</b>임을 감안.
          정확 성원 박단가는 자동발주 모달의 성원 재계산(calcuEstimate)이 최종 권위.
        </p>
      </Section>

      {/* 6. 로그인/테스트주문/파일업로드 capability (board ③) */}
      <Section title="⑥ 발주 계정 capability — 로그인 · 테스트주문 · 파일업로드 (dry-run)" desc="printcity 발주 계정(apm0801)으로 로그인→주문진입→파일첨부까지 실세션 dry-run 검증. 결제는 금지(결제 직전 정지). 자격은 .env.local(gitignored).">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <Th>단계</Th><Th>가능여부</Th><Th>증거</Th>
              </tr>
            </thead>
            <tbody>
              {ORDER_CAPABILITY.map((c) => (
                <tr key={c.step} className="border-b border-gray-100 align-top hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{c.step}</td>
                  <td className="px-2 whitespace-nowrap">{c.ok}</td>
                  <td className="px-2 text-xs text-gray-500">{c.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          멤버명 <b>올팩마이스터</b> 확인. 로그인은 <code className="rounded bg-gray-100 px-1">admin.printdeal.co.kr/api/OAuth/GetAuthorization</code> → JWT(sub=apm0801:PC) 발급.
          하니스: <code className="rounded bg-gray-100 px-1">scripts/omo3414-printcity-order-capability-check.mjs</code>,
          증거: <code className="rounded bg-gray-100 px-1">scripts/test-artifacts/omo3414/order-capability.json</code> + 스크린샷.
          ⛔ 결제/실발주 없음(보드 게이트).
        </p>
      </Section>

      {/* 데이터 출처 */}
      <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        <div className="font-semibold text-gray-700">데이터 출처 · 결정론</div>
        <p className="mt-1">{CENSUS.source}</p>
        <p className="mt-0.5">{CENSUS.method}</p>
        <p className="mt-0.5">{CENSUS.note}</p>
        <p className="mt-1">
          크롤러: <code className="rounded bg-gray-100 px-1">scripts/omo3452-printcity-real-namecard-crawl.mjs</code> ·
          census 빌더: <code className="rounded bg-gray-100 px-1">scripts/omo3454-build-printcity-namecard-census.mjs</code> ·
          full artifact: <code className="rounded bg-gray-100 px-1">scripts/test-artifacts/omo3452-printcity-real-namecard.full.json</code> ·
          분석: <code className="rounded bg-gray-100 px-1">src/lib/printcity-namecard.ts</code>
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">{icon}{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mb-3 mt-0.5 text-sm text-gray-500">{desc}</p>
      {children}
    </section>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-2 pb-2 font-medium ${right ? 'text-right' : ''}`}>{children}</th>
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-2 ${right ? 'text-right' : ''} text-gray-700`}>{children}</td>
}
