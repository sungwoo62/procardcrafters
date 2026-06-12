// OMO-2961: 전 카테고리(23종) 옵션 매핑 라이브 감사 스냅샷.
//   성원 goods_view 폼을 Playwright READ-ONLY 로 전수 조사(2026-06-12)해, 카테고리별로
//   ① 핵심옵션 4종(종이/사이즈/매수/인쇄색) 필드 존재 여부 ② 우리가 자동발주 매핑한
//   후가공 9종 중 몇 개를 제공하는지 ③ 아직 미매핑인 추가 후가공을 기록한 것.
//   재감사: scripts/omo2961-allcat-audit.mts (node --experimental-strip-types --env-file=.env.local).
//   교차검수 대시보드(/admin/qa/swadpia-linkage)가 이 데이터를 그대로 렌더한다.

export const SWADPIA_CATEGORY_AUDIT_DATE = '2026-06-12'

export interface SwadpiaCategoryAudit {
  code: string
  label: string
  /** 핵심옵션 4종(종이/사이즈/매수/인쇄색) 필드가 폼에 모두 존재(우리 alias 적용 후) */
  coreOk: boolean
  /** core 미스 항목(있다면) */
  coreMiss?: string[]
  /** 자동발주 매핑 완료 후가공 9종 중 이 카테고리가 제공하는 수 */
  mappedFinishings: number
  /** 아직 자동발주 미매핑인 추가 후가공(성원 제공) */
  extraFinishings: string[]
}

// 자동발주 매핑 완료 후가공 9종(전 카테고리 공통 필드명 확인): 박/형압/도무송/타공/넘버링/귀도리/에폭시/오시/미싱
export const SWADPIA_MAPPED_FINISHING_COUNT = 9

export const SWADPIA_CATEGORY_AUDIT: SwadpiaCategoryAudit[] = [
  { code: 'CNC1000', label: '명함', coreOk: true, mappedFinishings: 9, extraFinishings: [] },
  { code: 'CNC2000', label: '고급명함', coreOk: true, mappedFinishings: 9, extraFinishings: [] },
  { code: 'CNC3000', label: '메탈/포일명함', coreOk: true, mappedFinishings: 9, extraFinishings: [] },
  { code: 'CNC4000', label: '레터프레스명함', coreOk: true, mappedFinishings: 9, extraFinishings: [] },
  { code: 'CNC5000', label: '투명명함', coreOk: true, mappedFinishings: 9, extraFinishings: [] },
  { code: 'CNC6000', label: 'UV명함', coreOk: true, mappedFinishings: 9, extraFinishings: [] },
  { code: 'CNC8000', label: '펄명함', coreOk: true, mappedFinishings: 9, extraFinishings: [] },
  { code: 'CST1000', label: '스티커', coreOk: true, mappedFinishings: 1, extraFinishings: ['coating', 'cutting'] },
  { code: 'CST2000', label: '도무송스티커', coreOk: true, mappedFinishings: 2, extraFinishings: ['add_cutting', 'coating', 'cutting'] },
  { code: 'CST5000', label: '홀로그램스티커', coreOk: true, mappedFinishings: 7, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'] },
  { code: 'CST7000', label: '롤스티커', coreOk: true, mappedFinishings: 7, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'] },
  { code: 'CLP1000', label: '라벨', coreOk: true, mappedFinishings: 7, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'] },
  { code: 'CLF1000', label: '전단', coreOk: true, mappedFinishings: 8, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'], coreMiss: [] },
  { code: 'CLF2000', label: '브로슈어/메뉴', coreOk: true, mappedFinishings: 8, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'] },
  { code: 'CPR3000', label: '리플렛', coreOk: true, mappedFinishings: 8, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'] },
  { code: 'CPR4000', label: '책자', coreOk: true, mappedFinishings: 6, extraFinishings: ['binding', 'coating', 'partial_coating'] },
  { code: 'CDP3000', label: '엽서', coreOk: true, mappedFinishings: 7, extraFinishings: ['bonding', 'coating', 'folding'] },
  { code: 'CPR2000', label: '포스터', coreOk: true, mappedFinishings: 8, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'], coreMiss: [] },
  { code: 'CPR5000', label: '배너', coreOk: true, mappedFinishings: 4, extraFinishings: ['bonding', 'coating', 'partial_coating', 'tape'] },
  { code: 'CEV1000', label: '봉투', coreOk: true, mappedFinishings: 3, extraFinishings: ['tape', 'window'] },
  { code: 'CNR2000', label: '양식/명세서', coreOk: true, mappedFinishings: 2, extraFinishings: ['binding'] },
  { code: 'CCD1000', label: '벽걸이캘린더', coreOk: true, mappedFinishings: 7, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'] },
  { code: 'CCD2000', label: '탁상캘린더', coreOk: true, mappedFinishings: 7, extraFinishings: ['binding', 'bonding', 'coating', 'cutting', 'folding', 'laminex', 'stitching'] },
]

// 추가 후가공(미매핑) 전체 집합 — 후속 카테고리별 추출 대상(OMO-2904).
export const SWADPIA_UNMAPPED_FINISHINGS = Array.from(
  new Set(SWADPIA_CATEGORY_AUDIT.flatMap((c) => c.extraFinishings)),
).sort()
