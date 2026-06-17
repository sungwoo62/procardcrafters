import Link from 'next/link'
import { ArrowLeft, AlertTriangle, ArrowLeftRight } from 'lucide-react'
import { PRODUCT_GROUPS } from '@/config/product-nav'
import { CATEGORY_MAP } from '@/lib/swadpia'
import {
  SWADPIA_CATALOG,
  reverseMissingSwadpia,
  reverseCoverageSummary,
} from '@/lib/swadpia-coverage'
import InteractiveMappingTable, { type GroupWithRows } from './InteractiveMappingTable'

// OMO-3058 / OMO-3095 / OMO-3148: 우리 사이트 전체 제품 ↔ 성원(swadpia.co.kr) 제품(category_code) 맵핑 현황 리포트.
// PRODUCT_GROUPS(제품 네비)와 CATEGORY_MAP(성원 라우팅)을 단일 소스로 읽어 항상 최신 동기화.
//
// OMO-3148(보드 요청): 정적 표 → 행 클릭 시 성원 라이브 옵션 ↔ 우리 적용 옵션 비교가
// 펼쳐지는 인터랙티브 뷰로 복원. 표/요약 내용은 최신 검증 데이터로 유지하고, 펼침 상세는
// read-only /api/swadpia-mapping/detail 만 호출한다(쓰기 엔드포인트 없음 → prod 안전).
//
// OMO-3095(2026-06-13) 라이브 검증 정정: holographic-stickers 는 CST5000(스페셜)이 아니라
// CST6000(팬시롤) 로 라우팅. 성원 라이브 격자상 홀로그램 용지(STR050HN1 홀로그램 민무늬 Pet)는
// CST6000 에만 존재하고, CST5000 은 샤인실버·금은무광·저온유포·PVC 만 보유(홀로그램 없음).
export const dynamic = 'force-static'

// 성원 category_code → 성원 제품명(한국어). OMO-3409: 단일 진실원천을
// src/lib/swadpia-coverage.ts(SWADPIA_CATALOG)로 통합 — 양방향 커버리지가 같은 소스에서 파생된다.
const SWADPIA_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SWADPIA_CATALOG).map(([code, e]) => [code, e.label]),
)

// 성원 라우팅이 잘못된(라이브 검증 미반영) 코드 — 표에 경고 표시.
// OMO-3097: 배너 CPR5000(종이홀더) 오매핑은 CRP5100/4000/3000·COD1100 으로 정정 완료 → 비움.
const KNOWN_MISMATCH: Record<string, string> = {}

// OMO-3097: 의도적 미연동(공란≠미취급 구분). 성원에 대응 카테고리가 없거나 타공장 생산군.
const SWADPIA_UNSUPPORTED: Record<string, string> = {
  'hangtag-cards': '성원 택(hangtag) 전용 카테고리/격자 부재 — 별도 공급',
  'paper-pop': '성원 POP 카테고리 부재 — 타공장 생산군',
  'foam-pop': '성원 POP 카테고리 부재 — 타공장 생산군',
  'general-notebooks': '대량 노트 성원 미취급 — 타공장 생산군',
  'spring-notebooks': '대량 스프링노트 성원 미취급 — 타공장 생산군',
  'diaries': '대량 다이어리 성원 미취급 — 타공장 생산군',
}

type Row = {
  slug: string
  label: string
  code: string | null
  swadpiaName: string
  mapped: boolean
  warn: boolean
  unsupported: boolean
  unsupportedNote?: string
}

function buildRows(items: { slug: string; label: string }[]): Row[] {
  return items.map(({ slug, label }) => {
    const code = CATEGORY_MAP[slug] ?? null
    const mapped = code !== null
    const unsupported = !mapped && slug in SWADPIA_UNSUPPORTED
    return {
      slug,
      label,
      code,
      swadpiaName: code
        ? SWADPIA_CATEGORY_LABEL[code] ?? '(라벨 미정)'
        : unsupported
          ? '성원 미취급/타공급'
          : '— 미연동 —',
      mapped,
      warn: code ? code in KNOWN_MISMATCH : false,
      unsupported,
      unsupportedNote: unsupported ? SWADPIA_UNSUPPORTED[slug] : undefined,
    }
  })
}

export default function SwadpiaMappingReport() {
  const groups: GroupWithRows[] = PRODUCT_GROUPS.map((g) => ({
    key: g.key,
    title: g.title,
    rows: buildRows(g.items),
  }))
  const allRows = groups.flatMap((g) => g.rows)
  const total = allRows.length
  const mappedCount = allRows.filter((r) => r.mapped).length
  const unsupportedCount = allRows.filter((r) => r.unsupported).length
  const unmappedCount = total - mappedCount - unsupportedCount
  const warnCount = allRows.filter((r) => r.warn).length

  // OMO-3409 양방향 커버리지
  // 우리→성원: 매핑(=자동발주·실시간가격 가능) 비율. unsupported(타공급)는 분모에서 제외.
  const forwardEligible = total - unsupportedCount
  const forwardPct = forwardEligible === 0 ? 0 : Math.round((mappedCount / forwardEligible) * 100)
  // 성원→우리: 성원 카탈로그 중 우리가 커버한 비율 + 역방향 누락 리스트.
  const reverse = reverseCoverageSummary()
  const reverseMissing = reverseMissingSwadpia()

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/products"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> 제품 목록
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">
        성원(swadpia) 제품 맵핑 현황
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        OMO-3058 · OMO-3095 · OMO-3097 · 우리 사이트 전체 제품 ↔ 성원 category_code 매핑. 소스:{' '}
        <code className="rounded bg-gray-100 px-1">src/config/product-nav.ts</code> ·{' '}
        <code className="rounded bg-gray-100 px-1">src/lib/swadpia.ts</code>
      </p>

      {/* OMO-3095 정정 안내 */}
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
        <div className="font-semibold text-green-900">
          OMO-3095 정정(2026-06-13 라이브 검증)
        </div>
        <div className="mt-1 text-green-800">
          <code className="rounded bg-green-100 px-1">holographic-stickers</code> 의 성원
          라우팅을 <code className="rounded bg-green-100 px-1">CST5000</code>(스페셜) →{' '}
          <code className="rounded bg-green-100 px-1">CST6000</code>(팬시롤) 로 정정했습니다.
          성원 라이브 격자상 홀로그램 용지(STR050HN1 · 홀로그램 민무늬 Pet 50μ)는 CST6000
          에만 존재하며, CST5000 은 샤인실버·금은무광·저온유포·PVC 만 보유합니다(홀로그램 없음).
        </div>
      </div>

      {/* OMO-3097 정정 안내 */}
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
        <div className="font-semibold text-green-900">
          OMO-3097 잔여 정정(2026-06-13 라이브 전수 검증)
        </div>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-green-800">
          <li>
            <b>배너 오매핑 정정</b>: banners·x·rollup 은{' '}
            <code className="rounded bg-green-100 px-1">CPR5000</code>(종이홀더, CPR≠CRP 오타)
            로 오라우팅됐었음 → 현수막{' '}
            <code className="rounded bg-green-100 px-1">CRP5100</code>·배너{' '}
            <code className="rounded bg-green-100 px-1">CRP4000</code>·미니배너{' '}
            <code className="rounded bg-green-100 px-1">COD1100</code> 으로 정정. (성원 미취급
            아님 — 라이브 격자 실재)
          </li>
          <li>
            <b>펄 명함</b>:{' '}
            <code className="rounded bg-green-100 px-1">CNC8000</code> 은 라이브에 실재하나
            펄지가 없어, 펄 용지(다이니티 골드펄 250g)를 보유한{' '}
            <code className="rounded bg-green-100 px-1">CNC2000</code> 고급지명함으로 정정.
          </li>
          <li>
            <b>공란 채움</b>: 초대장(CVS1000)·청첩장(CDP2000)·연하장(CCM2000)·떡메모지(CNR3000)·포스트잇(CPS7000)·투명/크라프트/에코
            스티커(CST1000 용지옵션)·쇼핑백(CPK)·박스(CHI3000) 라이브 확인 후 연동.
          </li>
          <li>
            <b>미취급 명시</b>: 택(hangtag)·POP·대량 노트/다이어리는 성원 카테고리 부재 →
            &lsquo;성원 미취급/타공급&rsquo;으로 구분 표기(공란≠미취급).
          </li>
        </ul>
      </div>

      {/* 요약 통계 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-xs text-gray-500">전체 제품</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">{mappedCount}</div>
          <div className="text-xs text-green-600">성원 연동됨</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-2xl font-bold text-red-700">{unmappedCount}</div>
          <div className="text-xs text-red-600">미연동(코드 미확인)</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-2xl font-bold text-gray-700">{unsupportedCount}</div>
          <div className="text-xs text-gray-500">성원 미취급(타공급)</div>
        </div>
      </div>

      {/* OMO-3409: 상호(양방향) 커버리지 — 우리→성원 / 성원→우리 */}
      <section className="mt-8">
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <ArrowLeftRight className="h-5 w-5 text-indigo-600" /> 상호(양방향) 커버리지
        </div>
        <p className="mt-1 text-sm text-gray-500">
          보드 지시(OMO-3238): 맵핑은 <strong>상호</strong>로 본다 — 우리 제품이 성원에
          매핑됐는지(자동발주 가능), 그리고 성원 카탈로그 중 <strong>우리가 못 덮은 것(역방향 누락)</strong>.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* 우리 → 성원 */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
            <div className="flex items-baseline justify-between">
              <div className="font-semibold text-indigo-900">우리 → 성원</div>
              <div className="text-2xl font-bold text-indigo-700">{forwardPct}%</div>
            </div>
            <div className="mt-1 text-xs text-indigo-700">
              자동발주·실시간가격 가능 제품 비율 (성원 미취급/타공급 {unsupportedCount}종 제외)
            </div>
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              <li>
                <span className="font-semibold text-green-700">✅ 매핑됨(자동발주):</span> {mappedCount}종
              </li>
              <li>
                <span className="font-semibold text-red-600">❌ 미연동(코드 미확인):</span> {unmappedCount}종
              </li>
              <li>
                <span className="font-semibold text-gray-500">▫ 성원 미취급(수동/타공급):</span> {unsupportedCount}종
              </li>
            </ul>
          </div>

          {/* 성원 → 우리 */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-baseline justify-between">
              <div className="font-semibold text-amber-900">성원 → 우리</div>
              <div className="text-2xl font-bold text-amber-700">{reverse.coveragePct}%</div>
            </div>
            <div className="mt-1 text-xs text-amber-700">
              성원 카탈로그 {reverse.catalogTotal}종 중 우리 slug 로 커버한 비율
            </div>
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              <li>
                <span className="font-semibold text-green-700">✅ 커버됨:</span> {reverse.coveredCount}종
              </li>
              <li>
                <span className="font-semibold text-amber-700">⚠️ 역방향 누락(커버 후보):</span> {reverse.gapCount}종
              </li>
              <li>
                <span className="font-semibold text-gray-500">▫ 의도적 미커버(중복/타공급):</span> {reverse.intentionalCount}종
              </li>
            </ul>
          </div>
        </div>

        {/* 역방향 누락 드릴다운: 성원에 있는데 우리가 못 덮은 카테고리 */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-amber-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-200 bg-amber-50 text-left text-amber-900">
                <th className="p-2 font-medium">성원 코드</th>
                <th className="p-2 font-medium">성원 제품명</th>
                <th className="p-2 font-medium whitespace-nowrap">분류</th>
                <th className="p-2 font-medium">미커버 사유 / 메모</th>
              </tr>
            </thead>
            <tbody>
              {reverseMissing.map((m) => (
                <tr key={m.code} className="border-b border-amber-100 align-top last:border-0">
                  <td className="p-2">
                    <code className="rounded bg-amber-100 px-1 text-amber-900">{m.code}</code>
                  </td>
                  <td className="p-2 text-gray-800">{m.label}</td>
                  <td className="p-2 whitespace-nowrap">
                    {m.gapKind === 'gap' ? (
                      <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        ⚠️ 커버 후보
                      </span>
                    ) : (
                      <span className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        ▫ 의도적
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-xs text-gray-500">{m.gapNote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          ※ 커버 여부는 <code className="rounded bg-gray-100 px-1">CATEGORY_MAP</code>(slug→code)에서
          라이브 파생됩니다. 후가공·사이즈·용지 축의 양방향 상태는{' '}
          <Link href="/admin/qa/swadpia-linkage" className="text-indigo-600 underline">
            옵션 연동 소켓 교차검수
          </Link>{' '}
          화면을 참조하세요.
        </p>
      </section>

      {/* 보드 직접 질의 답변 — OMO-3097 라이브검증으로 연동 완료, OMO-3148 갱신 */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
        <div className="font-semibold text-blue-900">
          Q. /products/transparent-stickers 는 성원 무슨 제품 맵핑?
        </div>
        <div className="mt-1 text-blue-800">
          <strong>A. 성원 연동됨 — </strong>
          <code className="rounded bg-blue-100 px-1">CST1000</code>(재단형 스티커, 투명데드롱 25
          용지옵션)로 맵핑되었습니다(OMO-3097 라이브검증). 같은 CST1000 의 용지옵션 변형으로
          크라프트(<code className="rounded bg-blue-100 px-1">kraft-stickers</code>)·에코
          (<code className="rounded bg-blue-100 px-1">eco-stickers</code>)도 함께 연동되어
          성원 자동발주·실시간 가격조회 대상입니다. (도무송형은 별도{' '}
          <code className="rounded bg-blue-100 px-1">CST2000</code>.)
        </div>
      </div>

      {/* OMO-3409 보드 지시: 성원이 베이스(메인) — 우리가 주도 아님 */}
      <div className="mt-8 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
        <div className="font-semibold text-indigo-900">기준은 성원(메인) — 우리는 성원 베이스를 미러링</div>
        <div className="mt-1 text-indigo-800">
          맵핑/세팅의 <strong>작업 베이스는 성원</strong>입니다(성원 카탈로그를 그대로 가져와 우리 옵션·제품을 맞춤).
          아래 행을 펼치면 각 축(용지·인쇄색상·사이즈·수량·후가공)에서 <strong>성원 베이스 대비 우리 적용률</strong>과
          <strong className="text-red-700"> 성원 베이스 미반영(메꿀 누락)</strong>,
          <strong className="text-amber-700"> 성원 베이스 이탈(우리 임의 항목 — 정합 필요)</strong>을 봅니다.
          우리가 임의로 만든 옵션(예: 흑백·스노우지·100매)은 성원 베이스로 정합해야 할 대상입니다.
        </div>
      </div>

      {/* 그룹별 표 (행 클릭 → 성원(베이스)↔우리 비교 펼침, OMO-3148/OMO-3409) */}
      <InteractiveMappingTable groups={groups} />

      {/* 코드 오류 경고 */}
      {warnCount > 0 && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> 코드 오류 의심 항목
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
            {Object.entries(KNOWN_MISMATCH).map(([code, note]) => (
              <li key={code}>
                <code className="rounded bg-amber-100 px-1">{code}</code> — {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">
        ※ 미연동 제품은 성원 카테고리가 없거나(노트/다이어리/박스/쇼핑백 등 자체·타공장
        생산군), 성원에 대응 코드가 아직 확인되지 않은 항목입니다. 연동 추가 시{' '}
        <code className="rounded bg-gray-100 px-1">CATEGORY_MAP</code> 에 슬러그→코드만
        등록하면 가격조회·자동발주가 함께 적용됩니다.
      </p>
    </div>
  )
}
