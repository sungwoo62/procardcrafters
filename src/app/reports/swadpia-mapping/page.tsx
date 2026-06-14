import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { PRODUCT_GROUPS } from '@/config/product-nav'
import { CATEGORY_MAP } from '@/lib/swadpia'
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

// 성원 category_code → 성원 제품명(한국어). swadpia.ts / swadpia-order.ts 의 라이브
// 조사 주석을 근거로 정리. (CNCxxxx=명함, CSTxxxx=스티커, CLPxxxx=라벨, CLF/CPR=인쇄물,
// CEV=봉투, CNR=전표, CCD=캘린더, CDP=엽서)
const SWADPIA_CATEGORY_LABEL: Record<string, string> = {
  CNC1000: '일반지명함',
  CNC2000: '고급지명함(펄지 옵션 포함)', // OMO-3097: 다이니티 골드펄 250g → 펄 명함 라우팅
  CNC3000: '카드명함(메탈·포일 Luxury)',
  CNC4000: '하이브리드명함(아트지 300g)',
  CNC5000: '투명하이브리드명함(PET)',
  CNC6000: '디지털박/에폭시명함(UV·특수후가공)',
  CNC8000: '프리미엄 명함(반누보·랑데뷰 등 9종) — 펄지 없음, 현재 미연동', // OMO-3097: 라이브 실재 카테고리지만 펄 용지 부재
  CST1000: '재단형 스티커(투명데드롱·크라프트·모조 용지옵션)',
  CST2000: '도무송(다이컷) 스티커',
  CST3000: '차량 스티커', // OMO-3097 라이브검증
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
  CPR5000: '종이홀더', // OMO-3097: 배너 오매핑 정정으로 더 이상 사용 안 함
  CRP5100: '현수막(150denier)', // OMO-3097 라이브검증
  CRP4000: '배너(페트 210µ)', // OMO-3097 라이브검증
  CRP3000: '배너/메쉬(페트·메쉬 1000denier)', // OMO-3097 라이브검증
  COD1100: '종이미니배너', // OMO-3097 라이브검증
  CDP2000: '디지털청첩장/초대장', // OMO-3097 라이브검증
  CDP3000: '엽서',
  CVS1000: '초대장/상품권(일반)', // OMO-3097 라이브검증
  CVS6000: '에폭시초대장', // OMO-3097 라이브검증
  CCM2000: '디자인연하장', // OMO-3097 라이브검증
  CCM4000: '연하장', // OMO-3097 라이브검증
  CEV1000: '봉투',
  CNR2000: '양식·전표(영수증/견적서/거래명세서/NCR)',
  CNR3000: '떡메모지', // OMO-3097 라이브검증
  CPS7000: '사각 포스트잇', // OMO-3097 라이브검증
  CPS7100: '모양 포스트잇', // OMO-3097 라이브검증
  CCD1000: '벽걸이 캘린더',
  CCD2000: '탁상/미니 캘린더',
  CHI3000: '판지/박스(양면마닐라·메탈팩보드)', // OMO-3097 라이브검증
  CDP1600: '디지털 판지/박스', // OMO-3097 라이브검증
  CPK2000: '리본&브레이드 쇼핑백', // OMO-3097 라이브검증
  CPK3000: '손잡이 쇼핑백', // OMO-3097 라이브검증
  CPK4000: '일반 쇼핑백', // OMO-3097 라이브검증
  CPK5000: '소량 쇼핑백', // OMO-3097 라이브검증
}

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

      {/* 그룹별 표 (행 클릭 → 성원↔우리 비교 펼침, OMO-3148) */}
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
