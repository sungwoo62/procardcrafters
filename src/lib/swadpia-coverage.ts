// OMO-3409: PCCF ↔ 성원(swadpia) 양방향 커버리지 단일 소스.
//
//   보드 지시(OMO-3238): "맵핑 비교할 때 상호간에 뭐 되어있고 뭐 안되어있는지" 보여라.
//   → 한 곳에서 두 방향 커버리지를 파생해 리포트/검수 화면이 모두 같은 진실원천을 읽게 한다.
//     ① 우리→성원: 우리 제품 slug 중 성원 코드 매핑 됨/안 됨 (= 자동발주·실시간가격 가능 여부).
//     ② 성원→우리: 성원 카탈로그(category_code) 중 우리가 커버 못한 것 = 역방향 누락.
//
//   드리프트 0 원칙: 커버 여부는 CATEGORY_MAP(slug→code, swadpia.ts)에서 라이브 파생한다.
//   CATEGORY_MAP 에 slug→code 만 추가하면 양 방향 커버리지가 동시에 갱신된다.
//   가격은 hidden total_price 직독 경로(swadpia.ts)를 따르며 이 파일은 매핑 메타만 다룬다(가격 추론 없음).

import { CATEGORY_MAP } from './swadpia'

// 성원 카탈로그: 라이브 전수조사(OMO-3097/3106 계열)로 문서화한 성원 category_code →
// 한국어 제품명 + (역방향 누락 시) 미커버 사유. SWADPIA_CATEGORY_LABEL(리포트 페이지)의
// 단일 진실원천 — 새 성원 카테고리를 확인하면 여기에만 추가한다.
export interface SwadpiaCatalogEntry {
  /** 성원 제품명(한국어) */
  label: string
  /** 우리가 아직 커버하지 못한 경우의 사유(역방향 누락 분류). 커버되면 무시됨. */
  gapNote?: string
  /** 사유 분류: intentional=의도적 미커버(타공급/중복), gap=커버 후보(미연동) */
  gapKind?: 'intentional' | 'gap'
}

export const SWADPIA_CATALOG: Record<string, SwadpiaCatalogEntry> = {
  // 명함 (CNCxxxx)
  CNC1000: { label: '일반지명함' },
  CNC2000: { label: '고급지명함(펄지 옵션 포함)' },
  CNC3000: { label: '카드명함(메탈·포일 Luxury)' },
  CNC4000: { label: '하이브리드명함(아트지 300g)' },
  CNC5000: { label: '투명하이브리드명함(PET)' },
  CNC6000: { label: '디지털박/에폭시명함(UV·특수후가공)' },
  CNC8000: {
    label: '프리미엄 명함(반누보·랑데뷰 등 9종)',
    gapKind: 'intentional',
    gapNote: '펄지 부재 → 펄 명함은 CNC2000 으로 라우팅. 반누보/랑데뷰 전용 격자는 미연동(수요 시 추가).',
  },
  // 스티커 (CSTxxxx)
  CST1000: { label: '재단형 스티커(투명데드롱·크라프트·모조 용지옵션)' },
  CST2000: { label: '도무송(다이컷) 스티커' },
  CST3000: {
    label: '차량 스티커',
    gapKind: 'gap',
    gapNote: '차량용 스티커 전용 slug 없음 — 커버 후보(라이브 격자 실재).',
  },
  CST4000: {
    label: '디지털 메탈박(포일·백색잉크) 스티커',
    gapKind: 'gap',
    gapNote: '메탈박 스티커 전용 slug 없음 — 커버 후보(OMO-3083 라이브검증).',
  },
  CST5000: {
    label: '스페셜 스티커(저온/방수·은지·PVC)',
    gapKind: 'gap',
    gapNote: '저온/방수·은지·PVC 전용 slug 없음 — 홀로그램은 CST6000 으로 분리 라우팅, 나머지 미커버.',
  },
  CST6000: { label: '팬시롤 스티커(홀로그램·투명 Pet)' },
  CST7000: { label: '팬시롤 스티커(투명 PP)' },
  // 라벨 (CLPxxxx)
  CLP1000: { label: '라벨 스티커(롤)' },
  // 인쇄물 (CLF/CPRxxxx)
  CLF1000: { label: '전단지' },
  CLF2000: { label: '브로슈어/메뉴' },
  CPR2000: { label: '포스터' },
  CPR3000: { label: '리플렛/팜플렛' },
  CPR4000: { label: '책자(중철·무선제본)' },
  CPR5000: {
    label: '종이홀더',
    gapKind: 'gap',
    gapNote: '종이홀더 전용 slug 없음 — 배너 오매핑 정정(OMO-3097)으로 비게 됨. 커버 후보.',
  },
  // 디스플레이 (CRP/CODxxxx)
  CRP5100: { label: '현수막(150denier)' },
  CRP4000: { label: '배너(페트 210µ)' },
  CRP3000: {
    label: '배너/메쉬(페트·메쉬 1000denier)',
    gapKind: 'gap',
    gapNote: '대형 메쉬 배너 전용 slug 없음 — x/rollup 은 CRP4000(210µ) 사용. 메쉬 커버 후보.',
  },
  COD1100: { label: '종이미니배너' },
  // 우편·초대장·연하장 (CDP/CVS/CCMxxxx)
  CDP2000: { label: '디지털청첩장/초대장' },
  CDP3000: { label: '엽서' },
  CVS1000: { label: '초대장/상품권(일반)' },
  CVS6000: {
    label: '에폭시초대장',
    gapKind: 'gap',
    gapNote: '에폭시 초대장 전용 slug 없음 — 일반 초대장은 CVS1000 커버. 에폭시형 미커버.',
  },
  CCM2000: { label: '디자인연하장' },
  CCM4000: {
    label: '연하장',
    gapKind: 'gap',
    gapNote: '연하장(디자인 외) 전용 slug 없음 — 디자인연하장은 CCM2000 커버. 일반 연하장 커버 후보.',
  },
  // 봉투·서식 (CEV/CNRxxxx)
  CEV1000: { label: '봉투' },
  CNR2000: { label: '양식·전표(영수증/견적서/거래명세서/NCR)' },
  CNR3000: { label: '떡메모지' },
  // 메모·포스트잇 (CPSxxxx)
  CPS7000: { label: '사각 포스트잇' },
  CPS7100: {
    label: '모양 포스트잇',
    gapKind: 'gap',
    gapNote: '모양(다이컷) 포스트잇 전용 slug 없음 — 사각은 CPS7000 커버. 모양 커버 후보.',
  },
  // 캘린더 (CCDxxxx)
  CCD1000: { label: '벽걸이 캘린더' },
  CCD2000: { label: '탁상/미니 캘린더' },
  // 패키징 (CHI/CDP/CPKxxxx)
  CHI3000: { label: '판지/박스(양면마닐라·메탈팩보드)' },
  CDP1600: {
    label: '디지털 판지/박스',
    gapKind: 'gap',
    gapNote: '디지털(소량) 판지/박스 전용 slug 없음 — 일반 박스는 CHI3000 커버. 디지털 박스 커버 후보.',
  },
  CPK2000: { label: '리본&브레이드 쇼핑백' },
  CPK3000: { label: '손잡이 쇼핑백' },
  CPK4000: { label: '일반 쇼핑백' },
  CPK5000: {
    label: '소량 쇼핑백',
    gapKind: 'gap',
    gapNote: '소량 쇼핑백 전용 slug 없음 — 일반/손잡이/리본 쇼핑백은 커버. 소량형 커버 후보.',
  },
}

/** 우리 slug 가 라우팅하는 성원 코드 집합(= 역방향 "커버됨" 판정 기준). */
export function coveredSwadpiaCodes(): Set<string> {
  return new Set(Object.values(CATEGORY_MAP))
}

export interface ReverseMissingEntry {
  code: string
  label: string
  gapNote?: string
  gapKind: 'intentional' | 'gap'
}

/**
 * 성원→우리 역방향 누락: 성원 카탈로그 중 우리 어떤 slug 도 라우팅하지 않는 코드.
 * gapKind 미지정 누락은 'gap'(커버 후보)으로 본다.
 */
export function reverseMissingSwadpia(): ReverseMissingEntry[] {
  const covered = coveredSwadpiaCodes()
  return Object.entries(SWADPIA_CATALOG)
    .filter(([code]) => !covered.has(code))
    .map(([code, e]) => ({
      code,
      label: e.label,
      gapNote: e.gapNote,
      gapKind: e.gapKind ?? 'gap',
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

export interface ReverseCoverageSummary {
  /** 성원 카탈로그 총 코드 수(우리가 문서화한 범위) */
  catalogTotal: number
  /** 우리 slug 로 커버된 성원 코드 수 */
  coveredCount: number
  /** 역방향 누락 총 수 */
  missingCount: number
  /** 누락 중 의도적 미커버(타공급/중복) */
  intentionalCount: number
  /** 누락 중 커버 후보(미연동) */
  gapCount: number
  /** 성원→우리 커버리지 % (의도적 미커버 포함 분모) */
  coveragePct: number
}

export function reverseCoverageSummary(): ReverseCoverageSummary {
  const catalogTotal = Object.keys(SWADPIA_CATALOG).length
  const missing = reverseMissingSwadpia()
  const coveredCount = catalogTotal - missing.length
  const intentionalCount = missing.filter((m) => m.gapKind === 'intentional').length
  const gapCount = missing.filter((m) => m.gapKind === 'gap').length
  return {
    catalogTotal,
    coveredCount,
    missingCount: missing.length,
    intentionalCount,
    gapCount,
    coveragePct: catalogTotal === 0 ? 0 : Math.round((coveredCount / catalogTotal) * 100),
  }
}
