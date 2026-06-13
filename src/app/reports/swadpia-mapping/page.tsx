import Link from 'next/link'
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { PRODUCT_GROUPS } from '@/config/product-nav'
import { CATEGORY_MAP } from '@/lib/swadpia'

// OMO-3058 / OMO-3095: 우리 사이트 전체 제품 ↔ 성원(swadpia.co.kr) 제품(category_code) 맵핑 현황 리포트.
// 보드 질의 — "/products/transparent-stickers 는 성원 무슨 제품 맵핑인가" + 전체 맵핑 현황.
// PRODUCT_GROUPS(제품 네비)와 CATEGORY_MAP(성원 라우팅)을 단일 소스로 읽어 항상 최신 동기화.
//
// OMO-3095(2026-06-13) 라이브 검증 정정: holographic-stickers 는 CST5000(스페셜)이 아니라
// CST6000(팬시롤) 로 라우팅. 성원 라이브 격자상 홀로그램 용지(STR050HN1 홀로그램 민무늬 Pet)는
// CST6000 에만 존재하고, CST5000 은 샤인실버·금은무광·저온유포·PVC 만 보유(홀로그램 없음).
export const dynamic = 'force-static'

// 성원 category_code → 성원 제품명(한국어). swadpia.ts / swadpia-order.ts 의 라이브
// 조사 주석을 근거로 정리. (CNCxxxx=명함, CSTxxxx=스티커, CLPxxxx=라벨, CLF/CPR=인쇄물,
// CEV=봉투, CNR=전표, CCD=캘린더, CDP=엽서)
const SWADPIA_CATEGORY_LABEL: Record<string, string> = {
  CNC1000: '일반 명함',
  CNC2000: '고급(프리미엄) 명함',
  CNC3000: '메탈·포일 명함',
  CNC4000: '아트지 300g 명함',
  CNC5000: 'PET 투명 명함',
  CNC6000: 'UV 코팅 명함',
  CNC8000: '펄 UV 명함',
  CST1000: '일반 스티커',
  CST2000: '도무송(다이컷) 스티커',
  CST4000: '디지털 메탈박(포일·백색잉크) 스티커', // OMO-3083 라이브검증, 현재 미연동 slug
  CST5000: '스페셜 스티커(저온/방수·은지·PVC)', // OMO-3095: 홀로그램 아님(샤인실버/금은무광/저온유포/PVC)
  CST6000: '팬시롤 스티커(홀로그램·투명 Pet)', // OMO-3095: STR050HN1 홀로그램 용지 보유
  CST7000: '팬시롤 스티커(투명 PP)',
  CLP1000: '라벨 스티커(롤)',
  CLF1000: '전단지',
  CLF2000: '브로슈어/메뉴',
  CPR2000: '포스터',
  CPR3000: '리플렛/팜플렛',
  CPR4000: '책자(중철·무선제본)',
  CPR5000: '종이홀더 ⚠️',
  CDP3000: '엽서',
  CEV1000: '봉투',
  CNR2000: '양식·전표(영수증/견적서/거래명세서/NCR)',
  CCD1000: '벽걸이 캘린더',
  CCD2000: '탁상/미니 캘린더',
}

// 성원 라우팅이 잘못된(라이브 검증 미반영) 코드 — 표에 경고 표시.
const KNOWN_MISMATCH: Record<string, string> = {
  CPR5000:
    'CPR5000 은 실제로는 "종이홀더" 다. 배너류는 성원 CRP5100/4000/3000·COD1100 이 정답이나 라이브 수정(OMO-2636)이 미머지 상태 → 현재 배너 4종은 잘못된 코드로 라우팅됨.',
}

type Row = {
  slug: string
  label: string
  code: string | null
  swadpiaName: string
  mapped: boolean
  warn: boolean
}

function buildRows(items: { slug: string; label: string }[]): Row[] {
  return items.map(({ slug, label }) => {
    const code = CATEGORY_MAP[slug] ?? null
    const mapped = code !== null
    return {
      slug,
      label,
      code,
      swadpiaName: code ? SWADPIA_CATEGORY_LABEL[code] ?? '(라벨 미정)' : '— 미연동 —',
      mapped,
      warn: code ? code in KNOWN_MISMATCH : false,
    }
  })
}

export default function SwadpiaMappingReport() {
  const allRows = PRODUCT_GROUPS.flatMap((g) => buildRows(g.items))
  const total = allRows.length
  const mappedCount = allRows.filter((r) => r.mapped).length
  const unmappedCount = total - mappedCount
  const warnCount = allRows.filter((r) => r.warn).length

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
        OMO-3058 · OMO-3095 · 우리 사이트 전체 제품 ↔ 성원 category_code 매핑. 소스:{' '}
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
          <div className="text-xs text-red-600">미연동(자체/타공장)</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-2xl font-bold text-amber-700">{warnCount}</div>
          <div className="text-xs text-amber-600">코드 오류 의심</div>
        </div>
      </div>

      {/* 보드 직접 질의 답변 */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
        <div className="font-semibold text-blue-900">
          Q. /products/transparent-stickers 는 성원 무슨 제품 맵핑?
        </div>
        <div className="mt-1 text-blue-800">
          <strong>A. 현재 성원 미연동(맵핑 없음)</strong> 입니다. transparent-stickers
          는 제품 네비/상세 페이지는 존재하지만 CATEGORY_MAP 에 항목이 없어 성원
          자동발주·실시간 가격조회 대상이 아닙니다. 성격상 성원{' '}
          <code className="rounded bg-blue-100 px-1">CST1000(일반)</code>/
          <code className="rounded bg-blue-100 px-1">CST2000(도무송)</code> 계열의
          투명 PVC 변형이 후보이나, 성원에 별도 투명 스티커 카테고리 코드가 확인되기
          전까지는 연동 보류 상태입니다.
        </div>
      </div>

      {/* 그룹별 표 */}
      {PRODUCT_GROUPS.map((group) => {
        const rows = buildRows(group.items)
        return (
          <section key={group.key} className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              {group.title}{' '}
              <span className="text-sm font-normal text-gray-400">
                ({rows.filter((r) => r.mapped).length}/{rows.length} 연동)
              </span>
            </h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">우리 제품</th>
                    <th className="px-3 py-2 font-medium">슬러그</th>
                    <th className="px-3 py-2 font-medium">성원 코드</th>
                    <th className="px-3 py-2 font-medium">성원 제품명</th>
                    <th className="px-3 py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.slug} className={r.mapped ? '' : 'bg-red-50/40'}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {r.label}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">
                        {r.slug}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">
                        {r.code ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {r.swadpiaName}
                        {r.warn && (
                          <span className="ml-1 inline-flex items-center text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.mapped ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="h-4 w-4" /> 연동
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" /> 미연동
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

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
