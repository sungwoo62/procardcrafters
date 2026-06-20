// OMO-3567 (← OMO-3566 #3 설계): 성원 chkPostPress 조합제약 규칙의 결정론 데이터화 + UI 가드.
//
// 데이터 원천: scripts/test-artifacts/omo3566/31-rules.json (성원 라이브 chkPostPress 소스 직독).
// 사용처: ProductConfigurator 가 후가공 선택 시점에 evaluateFinishingGate(ctx) 를 호출해
//   block(비활성/경고) · force_on(필수 체크고정) · popup(안내) 를 적용한다.
//
// ⚠️ UI 적용은 FINISHING_GATE_ENABLED 플래그(기본 OFF)로 게이트한다 — 고객이 선택 가능한 조합을
//   바꾸는 가시적 변경이므로 보드 승인(OMO-3511 a344e1b4) 후 ON. 규칙 평가 자체는 순수함수라 항상 안전.

// OMO-3567: 조합제약 UI 가드 활성화 플래그(기본 OFF=dormant). 보드 승인 후 ON.
export const FINISHING_GATE_ENABLED = process.env.NEXT_PUBLIC_FINISHING_GATE === 'on'

/** 내부 후가공 catalog value → 성원 후가공 토큰. (게이트 평가 입력 매핑) */
export const FINISHING_VALUE_TO_TOKEN: Record<string, FinishingToken> = {
  foil_stamp: 'bak',
  deboss_emboss: 'ap',
  epoxy: 'epoxy',
  numbering: 'numbering',
  die_cut: 'domusong',
  round_corner: 'guidori',
  score_crease: 'osi',
  perforation: 'missing',
  drilled_hole: 'tagong',
}

/** 성원 후가공 토큰 → 내부 catalog value (역매핑, 가드 판정→UI value 적용). */
export const TOKEN_TO_FINISHING_VALUE: Partial<Record<FinishingToken, string>> = Object.fromEntries(
  Object.entries(FINISHING_VALUE_TO_TOKEN).map(([v, t]) => [t, v]),
) as Partial<Record<FinishingToken, string>>

/** 성원 후가공 토큰(내부 value ↔ 성원 ppType 매핑). */
export type FinishingToken =
  | 'bak' | 'dbak' | 'ap' | 'epoxy' | 'numbering' | 'domusong'
  | 'guidori' | 'osi' | 'missing' | 'tagong'

export interface GateContext {
  categoryCode: string       // 예: CNC1000, CNC2000, CNC8000, CVS3000
  paperCode: string          // 예: VNV233W00
  sizeType?: string          // 예: SZT10 (규격형)
  isStaff?: boolean
  /** 현재 선택된(켜진) 후가공 토큰 집합 */
  selected: Set<FinishingToken>
}

export type GateAction = 'block' | 'force_on' | 'popup'

export interface GateVerdict {
  token: FinishingToken
  action: GateAction
  message?: string
  ruleId: string
}

/** 디지털박(dbak) 허용 용지 9종 (R01). */
export const DBAK_ALLOWED_PAPERS = [
  'AQS256W00', 'ARM310W00', 'INV350MT0', 'RDV310N00', 'SNW300W00',
  'VNV186W00', 'VNV227SW0', 'VNV233W00', 'ARM230W00',
] as const

/** 넘버링 불가 용지 (R03 어두움 + R04 벨벳359). */
export const NUMBERING_BLOCKED_PAPERS = ['NEC350BL0', 'BKN350BL0', 'BKN380BL0', 'VVT359W00'] as const

/** CNC2000 에폭시 불가 용지 (R05). */
export const CNC2000_EPOXY_BLOCKED_PAPERS = ['RBE359W00', 'VVT359W00', 'BKN350BL0', 'BKN380BL0'] as const

/** 카테고리별 필수후가공 (R06~R09). matcher 는 categoryCode.includes 또는 size 동반 조건. */
export const REQUIRED_FINISHING: Array<{ ruleId: string; token: FinishingToken; match: (c: GateContext) => boolean; message?: string }> = [
  { ruleId: 'R06', token: 'domusong', match: c => c.categoryCode.includes('CVS') && c.sizeType === 'SZT10', message: '초대장 규격형은 도무송을 뺄 수 없습니다.' },
  { ruleId: 'R07', token: 'epoxy', match: c => c.categoryCode.includes('CNC6000') || c.categoryCode.includes('CVS6000'), message: '에폭시명함/초대장은 에폭시를 뺄 수 없습니다.' },
  { ruleId: 'R08', token: 'dbak', match: c => c.categoryCode.includes('CNC8000'), message: '디지털박 명함은 디지털 박을 뺄 수 없습니다.' },
  { ruleId: 'R09', token: 'guidori', match: c => c.categoryCode === 'CNC5000' || c.categoryCode === 'CNC3000' },
]

/**
 * 한 후가공 토큰을 켜려 할 때(또는 상태 평가 시) 성원 규칙을 적용한 판정 목록을 반환.
 * 빈 배열 = 제약 없음. ProductConfigurator 는 block→비활성/경고, force_on→체크고정, popup→안내.
 */
export function evaluateFinishingGate(ctx: GateContext): GateVerdict[] {
  const v: GateVerdict[] = []

  // R01: dbak 허용용지 게이트
  if (ctx.selected.has('dbak') && !DBAK_ALLOWED_PAPERS.includes(ctx.paperCode as typeof DBAK_ALLOWED_PAPERS[number])) {
    v.push({ token: 'dbak', action: 'block', ruleId: 'R01', message: '디지털 박이 불가능한 용지입니다.' })
  }
  // R02: bak ↔ dbak 상호배제
  if (ctx.selected.has('bak') && ctx.selected.has('dbak')) {
    v.push({ token: 'dbak', action: 'block', ruleId: 'R02', message: '박과 디지털 박은 동시에 주문할 수 없습니다.' })
  }
  // R03/R04: 넘버링 불가용지
  if (ctx.selected.has('numbering') && (NUMBERING_BLOCKED_PAPERS as readonly string[]).includes(ctx.paperCode)) {
    v.push({ token: 'numbering', action: 'block', ruleId: ctx.paperCode === 'VVT359W00' ? 'R04' : 'R03', message: '해당 용지는 넘버링을 할 수 없습니다(가독성/재질). 상담 요망.' })
  }
  // R05: CNC2000 에폭시 불가용지
  if (ctx.categoryCode === 'CNC2000' && ctx.selected.has('epoxy') && (CNC2000_EPOXY_BLOCKED_PAPERS as readonly string[]).includes(ctx.paperCode)) {
    v.push({ token: 'epoxy', action: 'block', ruleId: 'R05', message: '선택한 용지는 에폭시를 할 수 없습니다.' })
  }
  // R06~R09: 필수후가공
  for (const r of REQUIRED_FINISHING) {
    if (r.match(ctx)) v.push({ token: r.token, action: 'force_on', ruleId: r.ruleId, message: r.message })
  }
  // R10: CNC2000 dbak용지 + bak → 안내 팝업(비-staff)
  if (ctx.categoryCode === 'CNC2000' && !ctx.isStaff && ctx.selected.has('bak') &&
      DBAK_ALLOWED_PAPERS.includes(ctx.paperCode as typeof DBAK_ALLOWED_PAPERS[number])) {
    v.push({ token: 'bak', action: 'popup', ruleId: 'R10', message: '이 용지는 디지털 박 대안이 가능합니다.' })
  }
  return v
}
