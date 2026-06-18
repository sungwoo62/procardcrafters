// OMO-3483: 성원(swadpia) 기준 전 제품 후가공 옵션 전수검사 — 카테고리 × 후가공 매트릭스.
//
// 배경(보드 지시, OMO-3452 thread 2026-06-18):
//   "성원기준으로 해가지고 다른제품들도 다 후가공 옵션관련되서 전수검사 하고."
//   공급사=성원 확정에 따라, 명함뿐 아니라 스티커/봉투/전단/브로슈어 등 23 카테고리의
//   후가공을 성원 실폼 기준으로 전수검사한다.
//
// 데이터 원천(결정론):
//   scripts/test-artifacts/omo2961/allcat-audit.json — 2026-06-12 Playwright READ-ONLY 라이브
//   전수조사. 각 카테고리 goods_view 폼에서 노출되는 chk_is_* 후가공 토글을 추출한 스냅샷이다.
//   본 파일은 그 스냅샷을 코드화해 "카테고리 × 후가공" 셀 단위 커버리지(우리↔성원 상호)를
//   결정론적으로 산출한다(성원 실호출 없음, 비용 0). 재감사: scripts/omo2961-allcat-audit.mts.
//
// 기존 swadpia-category-audit.ts 는 카테고리별 "매핑 후가공 N/9" 집계만 가졌다. 이 파일은
//   ① 어떤 후가공이 어떤 카테고리에 실제 노출되는지(셀 단위) ② 그 후가공이 자동발주 매핑됐는지
//   ③ surcharge(공급가) 값이 있는지 — 세 축을 한 매트릭스로 합친다.

import { SWADPIA_FINISHING_BY_VALUE } from './swadpia-finishing-fields'
import { FINISHING_SURCHARGE } from './finishing-surcharge'

export const SWADPIA_FINISHING_MATRIX_DATE = '2026-06-12'

// ─── 성원 chk_is_* 토큰 → 우리 후가공(catalog value) 매핑 ──────────────────────
//   finishingValue 가 있으면 finishing-catalog.ts / finishing-fields.ts 의 value 와 연결된다.
//   finishingValue 가 없는 토큰은 우리 카탈로그에 대응 항목이 없는 "성원 전용 후가공"으로,
//   매핑 갭(역방향 누락)이다. needsInvestigation=true 는 토큰 의미 자체가 불확실해 라이브
//   재조사가 필요한 것.

export interface SwadpiaTokenDef {
  /** 성원 폼 chk_is_<token> 의 token */
  token: string
  /** 한국어 명칭(성원 기준 추정 포함) */
  label_ko: string
  /** 대응되는 우리 catalog value (없으면 미커버) */
  finishingValue?: string
  /** 토큰 의미가 불확실 — 라이브 재조사 필요 */
  needsInvestigation?: boolean
  /** 후가공이 아닌 노이즈(배송/프로모 토글 등) — 매트릭스에서 제외 */
  noise?: boolean
}

export const SWADPIA_FINISHING_TOKENS: Record<string, SwadpiaTokenDef> = {
  // 자동발주 검증 완료 9종(전 카테고리 공통 필드명, OMO-2633/2961)
  bak: { token: 'bak', label_ko: '박', finishingValue: 'foil_stamp' },
  ap: { token: 'ap', label_ko: '형압', finishingValue: 'deboss_emboss' },
  domusong: { token: 'domusong', label_ko: '도무송', finishingValue: 'die_cut' },
  tagong: { token: 'tagong', label_ko: '타공', finishingValue: 'drilled_hole' },
  numbering: { token: 'numbering', label_ko: '넘버링', finishingValue: 'numbering' },
  guidori: { token: 'guidori', label_ko: '귀도리', finishingValue: 'round_corner' },
  epoxy: { token: 'epoxy', label_ko: '에폭시', finishingValue: 'epoxy' },
  osi: { token: 'osi', label_ko: '오시', finishingValue: 'score_crease' },
  missing: { token: 'missing', label_ko: '미싱', finishingValue: 'perforation' },
  // 우리 카탈로그에 항목이 있으나 자동발주 미매핑(needs_audit)
  coating: { token: 'coating', label_ko: '코팅', finishingValue: 'coating' },
  binding: { token: 'binding', label_ko: '제본', finishingValue: 'binding' },
  window: { token: 'window', label_ko: '창문', finishingValue: 'window_patch' },
  // 성원 전용 후가공 — 우리 카탈로그 미대응(역방향 누락)
  cutting: { token: 'cutting', label_ko: '재단' },
  add_cutting: { token: 'add_cutting', label_ko: '추가재단' },
  partial_coating: { token: 'partial_coating', label_ko: '부분코팅' },
  bonding: { token: 'bonding', label_ko: '합지' },
  folding: { token: 'folding', label_ko: '접지' },
  laminex: { token: 'laminex', label_ko: '라미넥스(무광코팅)' },
  stitching: { token: 'stitching', label_ko: '중철제본' },
  tape: { token: 'tape', label_ko: '양면테이프' },
  // OMO-3487 의미 확정(2026-06-18, goods_view 정적 폼 READ-ONLY 추출):
  //   dbak   = 디지털박   — dbak_section 유일옵션 BKS30=디지털 (일반 bak 은 BKS10 신규/BKS20 동판).
  //                         'd'=디지털(NOT 양면). 디지털인쇄 제품(디지털명함/엽서)에만 노출.
  //   depoxy = 디지털에폭시 — depoxy_kind=EPK91 에폭시, dbak 와 동일 명명규칙(d=디지털).
  //   우리 카탈로그에 디지털박/디지털에폭시 대응 카드·자동발주·surcharge 미생성 → 역방향 누락
  //   유지(finishingValue 미부여). 필드: scripts/test-artifacts/omo3487/finishing-fields-static.json.
  dbak: { token: 'dbak', label_ko: '디지털박' },
  depoxy: { token: 'depoxy', label_ko: '디지털에폭시' },
  // 후가공 아님 — 노이즈(배송 토글)
  today_sat: { token: 'today_sat', label_ko: '토요일배송', noise: true },
}

// ─── 카테고리별 라이브 후가공 토큰(2026-06-12 스냅샷, dedupe) ──────────────────
//   allcat-audit.json rows[].finishings 그대로(중복 토큰은 dedupe). 노이즈 토큰 포함 —
//   매트릭스 계산 단계에서 SWADPIA_FINISHING_TOKENS[t].noise 로 거른다.

export const SWADPIA_CATEGORY_FINISHING_TOKENS: Record<string, string[]> = {
  CNC1000: ['osi', 'missing', 'bak', 'ap', 'numbering', 'domusong', 'tagong', 'guidori', 'epoxy', 'dbak'],
  CNC2000: ['osi', 'missing', 'bak', 'ap', 'numbering', 'domusong', 'tagong', 'guidori', 'epoxy', 'dbak'],
  CNC3000: ['osi', 'missing', 'bak', 'ap', 'numbering', 'domusong', 'tagong', 'guidori', 'epoxy', 'dbak'],
  CNC4000: ['osi', 'missing', 'bak', 'ap', 'numbering', 'domusong', 'tagong', 'guidori', 'epoxy', 'dbak'],
  CNC5000: ['osi', 'missing', 'bak', 'ap', 'numbering', 'domusong', 'tagong', 'guidori', 'epoxy', 'dbak'],
  CNC6000: ['osi', 'missing', 'bak', 'ap', 'numbering', 'domusong', 'tagong', 'guidori', 'epoxy', 'dbak'],
  CNC8000: ['osi', 'missing', 'bak', 'ap', 'numbering', 'domusong', 'tagong', 'guidori', 'epoxy', 'dbak'],
  CST1000: ['coating', 'cutting', 'bak', 'today_sat'],
  CST2000: ['domusong', 'coating', 'cutting', 'bak', 'add_cutting'],
  CST5000: ['bak', 'coating', 'domusong', 'osi', 'missing', 'ap', 'numbering', 'tagong', 'cutting', 'binding', 'bonding', 'laminex', 'stitching', 'folding'],
  CST7000: ['bak', 'coating', 'domusong', 'osi', 'missing', 'ap', 'numbering', 'tagong', 'cutting', 'binding', 'bonding', 'laminex', 'stitching', 'folding'],
  CLP1000: ['bak', 'domusong', 'coating', 'osi', 'missing', 'ap', 'numbering', 'tagong', 'cutting', 'binding', 'bonding', 'laminex', 'stitching', 'folding'],
  CLF1000: ['folding', 'osi', 'missing', 'bak', 'ap', 'domusong', 'coating', 'numbering', 'tagong', 'cutting', 'binding', 'bonding', 'laminex', 'epoxy', 'stitching'],
  CLF2000: ['folding', 'osi', 'missing', 'bak', 'ap', 'domusong', 'coating', 'numbering', 'tagong', 'cutting', 'binding', 'bonding', 'laminex', 'epoxy', 'stitching'],
  CPR3000: ['folding', 'osi', 'missing', 'bak', 'ap', 'domusong', 'coating', 'numbering', 'tagong', 'cutting', 'binding', 'bonding', 'laminex', 'epoxy', 'stitching'],
  CPR4000: ['osi', 'coating', 'bak', 'ap', 'partial_coating', 'epoxy', 'guidori', 'domusong', 'binding'],
  CDP3000: ['osi', 'missing', 'coating', 'domusong', 'bak', 'ap', 'tagong', 'folding', 'bonding', 'guidori', 'dbak', 'depoxy'],
  CPR2000: ['folding', 'osi', 'missing', 'bak', 'ap', 'domusong', 'coating', 'numbering', 'tagong', 'cutting', 'binding', 'bonding', 'laminex', 'epoxy', 'stitching'],
  CPR5000: ['coating', 'bak', 'ap', 'partial_coating', 'epoxy', 'tape', 'bonding', 'domusong'],
  CEV1000: ['bak', 'tape', 'tagong', 'window', 'domusong'],
  CNR2000: ['binding', 'tagong', 'missing'],
  CCD1000: ['coating', 'cutting', 'osi', 'missing', 'bak', 'ap', 'numbering', 'tagong', 'domusong', 'binding', 'bonding', 'laminex', 'stitching', 'folding'],
  CCD2000: ['coating', 'cutting', 'osi', 'missing', 'bak', 'ap', 'numbering', 'tagong', 'domusong', 'binding', 'bonding', 'laminex', 'stitching', 'folding'],
}

// ─── 매트릭스 셀 산출 ──────────────────────────────────────────────────────────

export type FinishingCellStatus =
  | 'auto_priced' //  ✅ 자동발주 매핑 + surcharge 공급가 보유 → 완전 커버
  | 'auto_unpriced' // 🟡 자동발주 매핑 but surcharge 미적재 → 발주 가능하나 고객가 0(손해 위험)
  | 'needs_audit' //  ⚠️ 우리 카탈로그 존재하나 미매핑 → 카테고리별 라이브 재조사
  | 'unmapped' //     ❌ 성원 전용 후가공, 우리 카탈로그 미대응 → 역방향 누락
  | 'investigate' //  ❓ 토큰 의미 불확실 → 라이브 재조사

export interface FinishingCell {
  token: string
  label_ko: string
  finishingValue?: string
  status: FinishingCellStatus
}

export interface CategoryFinishingRow {
  code: string
  cells: FinishingCell[]
}

/**
 * 한 토큰의 셀 상태를 결정한다.
 *  - finishingValue 없음 → unmapped (investigate 우선)
 *  - finishingValue 있고 finishing-fields status==='mapped':
 *      surcharge 보유 → auto_priced, 아니면 auto_unpriced
 *  - finishingValue 있고 그 외(needs_audit/runtime) → needs_audit
 */
export function cellStatusForToken(token: string): FinishingCellStatus {
  const def = SWADPIA_FINISHING_TOKENS[token]
  if (!def) return 'investigate'
  if (def.needsInvestigation) return 'investigate'
  if (!def.finishingValue) return 'unmapped'
  const mapping = SWADPIA_FINISHING_BY_VALUE[def.finishingValue]
  if (mapping?.status === 'mapped') {
    return FINISHING_SURCHARGE[def.finishingValue] ? 'auto_priced' : 'auto_unpriced'
  }
  return 'needs_audit'
}

/** 카테고리별 후가공 셀 행(노이즈 토큰 제외). */
export function buildFinishingMatrix(): CategoryFinishingRow[] {
  return Object.entries(SWADPIA_CATEGORY_FINISHING_TOKENS).map(([code, tokens]) => ({
    code,
    cells: tokens
      .filter((t) => !SWADPIA_FINISHING_TOKENS[t]?.noise)
      .map((t) => {
        const def = SWADPIA_FINISHING_TOKENS[t]
        return {
          token: t,
          label_ko: def?.label_ko ?? t,
          finishingValue: def?.finishingValue,
          status: cellStatusForToken(t),
        }
      }),
  }))
}

export interface FinishingMatrixSummary {
  /** 라이브에서 발견된 distinct 후가공 토큰(노이즈 제외) */
  distinctTokens: number
  /** 자동발주 매핑 + surcharge 보유 토큰 수 */
  autoPriced: number
  /** 자동발주 매핑 but surcharge 미적재 토큰 수(고객가 0 손해 위험) */
  autoUnpriced: string[]
  /** 카탈로그 존재·미매핑(needs_audit) 토큰 */
  needsAudit: string[]
  /** 성원 전용·우리 미대응(역방향 누락) 토큰 */
  unmapped: string[]
  /** 의미 불확실·재조사 토큰 */
  investigate: string[]
}

/** 매트릭스 전역 요약(중복 토큰을 distinct 로 집계). */
export function finishingMatrixSummary(): FinishingMatrixSummary {
  const seen = new Map<string, FinishingCellStatus>()
  for (const tokens of Object.values(SWADPIA_CATEGORY_FINISHING_TOKENS)) {
    for (const t of tokens) {
      if (SWADPIA_FINISHING_TOKENS[t]?.noise) continue
      if (!seen.has(t)) seen.set(t, cellStatusForToken(t))
    }
  }
  const byStatus = (s: FinishingCellStatus) =>
    [...seen.entries()].filter(([, v]) => v === s).map(([k]) => k).sort()
  return {
    distinctTokens: seen.size,
    autoPriced: byStatus('auto_priced').length,
    autoUnpriced: byStatus('auto_unpriced'),
    needsAudit: byStatus('needs_audit'),
    unmapped: byStatus('unmapped'),
    investigate: byStatus('investigate'),
  }
}
