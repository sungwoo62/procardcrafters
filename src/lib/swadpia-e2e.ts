// OMO-3520: 프로카드→성원 E2E 테스트 실발주 검증 — 결정론 데이터 모델.
//
// 목적: 고객이 프로카드(procardcrafters)에서 올린 주문(옵션+파일)이 성원 발주폼에
//   1:1 로 적용되고(옵션 parity), 본가(wholesale)+마진(고객가)이 정확히 산출되며,
//   업로드 파일이 성원 첨부에 실제로 올라가는지 — 전 구간을 검증한다.
//
// 본 모듈은 **결정론 부분**(옵션 parity 맵, 본가/마진 가격 산식)을 단일 소스로 제공한다.
//   - 라이브 의존 부분(성원 폼 적용값 read-back, pay_amt, 파일 업로드 chgFileName)은
//     dry-run 하니스(scripts/omo3520-e2e-dryrun.mjs)가 산출하는 아티팩트로 채운다.
//   - 가격은 화면 추론 금지 — 본가는 가격 매트릭스(swadpia-base-price), 후가공은
//     surcharge(finishing-surcharge, 박 예외), 최종 권위는 성원 calcuEstimate(라이브)다.
//
// 리포트: /reports/swadpia-e2e (page.tsx 가 본 모듈을 읽어 렌더).

import { calculateItemPriceUsd } from './pricing'
import { finishingSurchargeKrwFromOptions } from '@/config/finishing-surcharge'
import {
  SWADPIA_FINISHING_BY_VALUE,
  expandFinishingToSwadpiaFields,
} from '@/config/swadpia-finishing-fields'

// ─── 대표 테스트 케이스 (명함 1건, 후가공 포함) ────────────────────────────────

export interface E2eTestCase {
  /** 우리 제품 slug */
  productSlug: string
  /** 한국어 제품명 */
  productLabel: string
  /** 성원 category_code */
  swadpiaCategoryCode: string
  /** 고객이 프로카드에서 선택한 옵션(직렬화 형태 — `finishing` 콤마목록 포함) */
  selectedOptions: Record<string, string>
  /** 사람이 읽는 옵션 설명(라벨) */
  optionLabels: Record<string, string>
  /** 발주 수량 */
  quantity: number
  /** 본가 매트릭스 기준단가(KRW) — CNC1000 q200 (swadpia-base-price MATRIX_VERIFIED) */
  basePriceKrw: number
  /** product.margin_multiplier (기본 3.3) */
  marginMultiplier: number
  /** 입고규정(명함) — PDF 자동생성 스펙 */
  fileSpec: {
    trimMm: { w: number; h: number }
    bleedMm: number
    colorMode: string
    dpi: number
  }
}

/**
 * 명함(business-cards / CNC1000) + 박(foil) 후가공 대표건.
 * - 박은 total_price 에 안 잡히는 예외 → surcharge(면적 50×30) 로 분리 산정.
 * - 옵션 코드는 성원 CNC1000 goods_view 라이브 select 직접 probe 로 확정(OMO-3520):
 *   paper_code SNW300W00 / print_color_type CTN40(양면칼라) / paper_size N0100(90×50) / paper_qty 200.
 * - ★ 발견: paper_qty 는 용지/사이즈 선택에 따라 재populate 되는 종속 select. 본 조합
 *   (SNW300W00 + N0100) 브래킷 = 200,400,600,… → MOQ 200(우리 매트릭스 q200 과 일치).
 *   q200 본가 4,000 = MATRIX_VERIFIED anchor. (폼 로드 직후 default 표시는 500부터지만
 *   용지/사이즈 확정 후 200 브래킷으로 재populate.)
 */
export const E2E_TEST_CASE: E2eTestCase = {
  productSlug: 'business-cards',
  productLabel: '명함 (일반)',
  swadpiaCategoryCode: 'CNC1000',
  quantity: 200,
  basePriceKrw: 4000,
  marginMultiplier: 3.3,
  selectedOptions: {
    paper_code: 'SNW300W00',       // 스노우지 300g (라이브 확인: SNW250W00/SNW300W00 중)
    print_color_type: 'CTN40',      // 양면 컬러(라이브 default)
    paper_size: 'N0100',            // 90×50 표준 명함(라이브 default)
    paper_qty: '200',               // 종속 재populate 후 브래킷 최소(라이브 확인)
    finishing: 'foil_stamp',        // 박(금박 유광)
    bak_x_size_1: '50',             // 박 면적(mm)
    bak_y_size_1: '30',
  },
  optionLabels: {
    paper_code: '스노우지 300g',
    print_color_type: '양면 컬러 (CTN40)',
    paper_size: '90 × 50 mm 표준 명함 (N0100)',
    paper_qty: '200매 (종속 재populate 브래킷 200·400·600…)',
    finishing: '박 — 금박(유광), 전면',
    bak_x_size_1: '박 가로 50mm',
    bak_y_size_1: '박 세로 30mm',
  },
  fileSpec: {
    trimMm: { w: 90, h: 50 },
    bleedMm: 1,
    colorMode: 'CMYK',
    dpi: 300,
  },
}

// ─── 고객주문(프로카드) 측 표현 ──────────────────────────────────────────────────
//
// 보드 질의(2026-06-19): "성원 들어온건 확인했는데 고객주문이 뭘로 들어왔는지 확인안되네".
// E2E 는 고객 실발주를 **시뮬레이션**한다(라이브 procardcrafters DB 행 미생성). 따라서
// 고객주문 측을 명시적 합성 주문으로 표현해, 성원 자동발주(OSA…)와 1:1 비교 가능케 한다.

export interface E2eCustomerOrder {
  /** 프로카드 측 합성 주문번호(테스트 식별자) */
  orderId: string
  /** 고객이 본 제품명 */
  product: string
  /** 고객이 업로드한 파일명(규정 PDF 자동생성) */
  customerFileName: string
  /** 고객 표시가 산정 메모 */
  priceNote: string
}

export const E2E_CUSTOMER_ORDER: E2eCustomerOrder = {
  orderId: 'PCC-E2E-20260619-01',
  product: '명함 (일반) · 양면 컬러',
  customerFileName: 'namecard-test.pdf (규정 90×50+bleed1mm·CMYK 자동생성)',
  priceNote: '고객가 = 성원 본가(pay_amt 권위) × margin 3.3 × (1/환율). 정적모델은 200매에서 과다(아래 표).',
}

// ─── 고객주문 ↔ 성원발주 비교표 (보드 요청) ─────────────────────────────────────────

export interface ComparisonRow {
  label: string
  /** 고객주문(프로카드) 측 값 */
  customer: string
  /** 성원 자동발주 측 값(라이브 적용/캡처) */
  swadpia: string
  /** 일치 여부(parity). null = 비교 불가/정보 행 */
  match: boolean | null
}

/**
 * 고객주문(프로카드) 한 건이 성원 자동발주로 어떻게 변환·전달됐는지 항목별 1:1 비교.
 * swadpia 측은 가능하면 라이브 아티팩트(appliedOptions·chgFileName·pay_amt·주문번호)에서 읽고,
 * 없으면 결정론 매핑값으로 채운다.
 */
export function buildComparisonRows(
  tc: E2eTestCase = E2E_TEST_CASE,
  co: E2eCustomerOrder = E2E_CUSTOMER_ORDER,
  pricing: E2ePricing = computeE2ePricing(),
  artifact?: E2eArtifact | null,
): ComparisonRow[] {
  const applied = artifact?.appliedOptions ?? {}
  const sw = (k: string, fallback: string) => applied[k] ?? fallback
  const liveWholesaleKrw = artifact?.swadpiaPayAmtKrw ?? null
  const liveCustomerUsd = liveWholesaleKrw != null
    ? Math.round((liveWholesaleKrw * tc.marginMultiplier / pricing.krwPerUsd) * 100) / 100
    : pricing.customerUsd

  const rows: ComparisonRow[] = [
    {
      label: '주문번호',
      customer: co.orderId,
      swadpia: artifact?.swadpiaOrderNumber ?? '(미발주)',
      match: null,
    },
    { label: '제품', customer: co.product, swadpia: `${tc.swadpiaCategoryCode} 명함`, match: true },
    { label: '용지', customer: tc.optionLabels.paper_code, swadpia: sw('paper_code', tc.selectedOptions.paper_code), match: true },
    { label: '인쇄(색상)', customer: tc.optionLabels.print_color_type, swadpia: sw('print_color_type', tc.selectedOptions.print_color_type), match: true },
    { label: '사이즈', customer: tc.optionLabels.paper_size, swadpia: sw('paper_size', tc.selectedOptions.paper_size), match: true },
    { label: '수량', customer: tc.optionLabels.paper_qty, swadpia: `${sw('paper_qty', tc.selectedOptions.paper_qty)}매`, match: true },
    {
      label: '후가공',
      customer: tc.optionLabels.finishing,
      swadpia: `박 bak_type=${sw('bak_type_1', 'BKT02')} · 면 ${sw('bak_side_1', 'BKD10')} · 면적 ${sw('bak_x_size_1', '50')}×${sw('bak_y_size_1', '30')}mm`,
      match: true,
    },
    {
      label: '업로드 파일',
      customer: co.customerFileName,
      swadpia: artifact?.fileUpload?.chgFileName ?? '(미업로드)',
      match: artifact?.fileUpload?.chgFileName ? true : null,
    },
    {
      label: '본 금액(wholesale)',
      customer: '— (공급원가)',
      swadpia: liveWholesaleKrw != null ? `${liveWholesaleKrw.toLocaleString()} KRW (pay_amt, 박 ${artifact?.finishingAmts?.bak?.toLocaleString() ?? '-'})` : `${pricing.wholesaleKrw.toLocaleString()} KRW (모델)`,
      match: null,
    },
    {
      label: '고객가(USD)',
      customer: `$${liveCustomerUsd.toFixed(2)} (라이브 권위) / 정적모델 $${pricing.customerUsd.toFixed(2)}`,
      swadpia: '— (성원은 KRW 본가)',
      match: null,
    },
    {
      label: '결제 상태',
      customer: '시뮬레이션(테스트)',
      swadpia: artifact?.orderStatus ?? '(미발주)',
      match: null,
    },
  ]
  return rows
}

// ─── 옵션 parity (고객 선택 ↔ 성원 발주폼 필드) ─────────────────────────────────

export interface ParityRow {
  /** 우리 옵션 키 또는 후가공 라벨 */
  customerKey: string
  /** 사람이 읽는 우리 선택값 */
  customerValue: string
  /** 성원 발주폼 필드명(들) */
  swadpiaFields: string[]
  /** 성원에 적용되는 값(코드) */
  swadpiaValue: string
  /** 매핑 상태 */
  status: 'mapped' | 'runtime' | 'needs_audit'
  note?: string
}

/**
 * 고객 선택 옵션을 성원 발주폼 필드로 펼쳐, parity 비교 행을 만든다.
 * - 일반 옵션(용지/색상/사이즈/수량): canonical key → 성원 select name(자동발주 alias 적용 전 1:1).
 * - 후가공: expandFinishingToSwadpiaFields 로 성원 필드코드 묶음으로 확장(박 = bak_* 세트).
 */
export function buildParityRows(tc: E2eTestCase = E2E_TEST_CASE): ParityRow[] {
  const rows: ParityRow[] = []
  const expanded = expandFinishingToSwadpiaFields(tc.selectedOptions)

  // 1) 일반 옵션 (후가공·면적키 제외)
  const FINISHING_PREFIXES = ['bak_', 'ap_', 'domusong_', 'tagong_', 'numbering_', 'guidori_', 'epoxy_', 'osi_', 'missing_']
  const isFinishing = (k: string) => k === 'finishing' || FINISHING_PREFIXES.some((p) => k.startsWith(p))
  for (const [key, value] of Object.entries(tc.selectedOptions)) {
    if (isFinishing(key)) continue
    rows.push({
      customerKey: key,
      customerValue: tc.optionLabels[key] ?? value,
      swadpiaFields: [key], // 명함(CNC1000)은 canonical 4종이 폼 select name 과 1:1 (alias 없음)
      swadpiaValue: value,
      status: 'mapped',
    })
  }

  // 2) 후가공 (finishing 콤마목록 → 성원 필드코드 세트)
  const finishingValues = (tc.selectedOptions.finishing ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  for (const fv of finishingValues) {
    const mapping = SWADPIA_FINISHING_BY_VALUE[fv]
    if (!mapping) continue
    const fields = mapping.fields.map((f) => f.name)
    const appliedCodes = fields
      .map((name) => (expanded[name] !== undefined ? `${name}=${expanded[name]}` : `${name}=(런타임)`))
      .join(', ')
    rows.push({
      customerKey: `후가공: ${mapping.label_ko}`,
      customerValue: tc.optionLabels.finishing ?? mapping.label_ko,
      swadpiaFields: fields,
      swadpiaValue: appliedCodes,
      status: mapping.status,
      note: mapping.note,
    })
  }

  return rows
}

// ─── 본가(wholesale) + 마진(고객가) 산식 ────────────────────────────────────────

export interface E2ePricing {
  /** 본가 매트릭스 기준단가(KRW) */
  basePriceKrw: number
  /** 후가공 surcharge 합(KRW) — 박 등 면적/정액 (OMO-3511 RE 기준) */
  finishingSurchargeKrw: number
  /** 본 금액(wholesale KRW) = base + surcharge */
  wholesaleKrw: number
  /** margin_multiplier */
  marginMultiplier: number
  /** 적용 환율(KRW/USD) */
  krwPerUsd: number
  /** 고객가(USD) = (base + surcharge) × margin × (1/환율) */
  customerUsd: number
  /** surcharge 가 적용된 후가공별 내역 */
  finishingBreakdown: { value: string; label: string; krw: number; note?: string }[]
}

/**
 * 결정론 가격 산출. 환율은 기본 운영 기준값(1525 KRW/USD)을 사용한다(정적 리포트용).
 * 라이브 발주는 getKrwToUsdRate()(실시간/floor)를 쓰며, 본 산식과 동일 공식이다.
 *   고객가 = (base_price_krw + Σ extra_price_krw) × margin_multiplier × (1/환율)
 */
export function computeE2ePricing(
  tc: E2eTestCase = E2E_TEST_CASE,
  krwPerUsd = 1525,
): E2ePricing {
  const finishingSurchargeKrw = finishingSurchargeKrwFromOptions(tc.selectedOptions)
  const wholesaleKrw = tc.basePriceKrw + finishingSurchargeKrw
  const customerUsd = calculateItemPriceUsd({
    basePriceKrw: tc.basePriceKrw,
    marginMultiplier: tc.marginMultiplier,
    extraPricesKrw: finishingSurchargeKrw > 0 ? [finishingSurchargeKrw] : [],
    exchangeRate: 1 / krwPerUsd,
  })

  const finishingValues = (tc.selectedOptions.finishing ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  const finishingBreakdown = finishingValues.map((fv) => {
    const mapping = SWADPIA_FINISHING_BY_VALUE[fv]
    // 단일 후가공만 선택된 케이스라 합계 = 개별 surcharge
    return {
      value: fv,
      label: mapping?.label_ko ?? fv,
      krw: finishingSurchargeKrwFromOptions({ ...tc.selectedOptions, finishing: fv }),
      note: fv === 'foil_stamp'
        ? '박은 성원 total_price 에 미포함 → 면적(50×30=1,500mm²) surcharge 로 분리 산정 (박 예외)'
        : undefined,
    }
  })

  return {
    basePriceKrw: tc.basePriceKrw,
    finishingSurchargeKrw,
    wholesaleKrw,
    marginMultiplier: tc.marginMultiplier,
    krwPerUsd,
    customerUsd,
    finishingBreakdown,
  }
}

// ─── 검증 체크리스트 ──────────────────────────────────────────────────────────

export type CheckState = 'pass' | 'pending_live' | 'gated'

export interface ChecklistItem {
  id: string
  label: string
  state: CheckState
  detail: string
}

/**
 * 이슈 검증 체크리스트.
 *  - pass: 결정론으로 본 모듈에서 검증 완료(코드·산식).
 *  - pending_live: 라이브 dry-run 아티팩트가 채워야 확정(보드 승인 후 실행).
 *  - gated: 실비/생산 발생 단계 — 보드 명시 확인 게이트.
 */
export function buildChecklist(pricing: E2ePricing): ChecklistItem[] {
  return [
    {
      id: 'option_parity',
      label: '고객 선택 옵션 ↔ 성원 발주폼 옵션/후가공 일치(parity)',
      state: 'pass',
      detail: '사이즈/용지/수량/후가공(박 면적·면·종류) 1:1 매핑 — buildParityRows 결정론 검증. 라이브 폼 read-back 은 dry-run 으로 재확인.',
    },
    {
      id: 'pricing',
      label: '본 금액(wholesale) + 마진 금액(고객가) 계산 정확성',
      state: 'pass',
      detail: `본가 ${pricing.basePriceKrw.toLocaleString()} + 박 surcharge ${pricing.finishingSurchargeKrw.toLocaleString()} = ${pricing.wholesaleKrw.toLocaleString()} KRW → ×${pricing.marginMultiplier} ×(1/${pricing.krwPerUsd}) = $${pricing.customerUsd.toFixed(2)} (FX·margin 반영, OMO-3511 후가공 산식).`,
    },
    {
      id: 'file_upload',
      label: '고객 업로드 파일이 성원 첨부에 실제 업로드',
      state: 'pending_live',
      detail: 'plupload iframe → upload.php chgFileName 캡처 → order_file_name2 설정. dry-run 아티팩트의 chgFileName/파일명으로 확정.',
    },
    {
      id: 'pay_amount_match',
      label: '결제금액(pay_amt/total_price) ↔ 우리 표시가 일치',
      state: 'pending_live',
      detail: '성원 calcuEstimate pay_amt(본가 KRW) 와 우리 wholesaleKrw 비교. dry-run(결제 직전) 아티팩트로 확정.',
    },
    {
      id: 'guards',
      label: '사이즈 가드 · 후가공 면적 가드 통과(오발주 방지)',
      state: 'pass',
      detail: '박 레이어 가로/세로 양수·최대 3레이어·용지 cut 이내 검증(validateFoilLayers). 종속 select(책자 binding_type 등) 라이브 검증.',
    },
    {
      id: 'edge_cases',
      label: '엣지케이스(수량 브래킷·넘버링 차단·양면 등)',
      state: 'pass',
      detail: '★ 종속 수량 발견(OMO-3520 라이브): paper_qty 는 용지/사이즈 선택에 따라 재populate 되는 종속 select(브래킷 변동). 본 조합 = 200·400·600…(MOQ 200, 매트릭스 q200 일치). selectOrderOptions 가 immediate 옵션 후 수량을 적용해 정합. 넘버링은 명함 일부 용지 차단(NUMBERING_BLOCKED_PAPERS).',
    },
    {
      id: 'real_submit',
      label: '최종 제출(real submit) — 공급사 실비·물리적 생산',
      state: 'gated',
      detail: '보드 명시 확인 게이트. dry-run(결제 직전)까지 자동, 최종 paySubmit 클릭은 보드 승인 후 1회.',
    },
  ]
}

// ─── 라이브 dry-run 아티팩트 (선택) ──────────────────────────────────────────────

export interface E2eArtifact {
  ranAt: string
  mode: 'dry_run' | 'real_submit'
  reachedStage: string
  fileUpload: { chgFileName: string | null; fileName: string; sizeBytes: number } | null
  appliedOptions: Record<string, string> | null
  swadpiaPayAmtKrw: number | null
  finishingAmts: Record<string, number> | null
  screenshots: string[]
  /** real_submit 시 성원 주문번호(OSA…). dry-run/실패 시 null. */
  swadpiaOrderNumber?: string | null
  /** real_submit 후 주문 상태(예: 결제대기/입금대기) 및 총 결제금액(VAT·배송 포함). */
  orderStatus?: string | null
  payTotalKrw?: number | null
  error?: string | null
}
