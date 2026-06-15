// OMO-2633: 후가공(finishing) → 성원애드피아(swadpia) 발주 폼 필드 매핑.
//
// 배경:
//   `finishing-catalog.ts` 의 후가공은 설명/이미지만 있는 "마케팅 카드"였다.
//   풀 자동발주(`swadpia-order.ts` 의 selectOrderOptions)는 selectedOptions 의
//   key 를 성원 goods_view 페이지의 select[name]/radio[name] 과 1:1로 매칭해
//   값을 채운다. 따라서 후가공을 "주문 옵션"으로 만들려면 각 후가공이 실제
//   성원 폼의 어떤 필드(name)/값(value)에 대응되는지 알아야 한다.
//
//   이 파일은 성원 명함 카테고리(CNC1000) goods_view 페이지를 라이브로 조사해
//   추출한 실제 필드명/옵션값을 기록한 것이다. (조사일: 2026-06-08, OMO-2633)
//   → selectedOptions 에 이 필드명으로 값을 넣으면 selectOrderOptions 가
//     별도 수정 없이 그대로 발주 폼에 적용한다.
//
// 한계(정직하게 명시):
//   - 일부 select(osi_direction, missing_direction, guidori_type, epoxy_type,
//     *_exist_dongpan, domusong_exist_mok)는 성원 페이지에서 선택한 사이즈/용지에
//     따라 JS로 동적 채워진다. HTML 정적 파싱으로는 옵션값이 안 나오므로
//     `runtimeOnly: true` 로 표시. 런타임(Playwright) 추출 또는 카테고리별
//     재조사가 필요하다.
//   - 박/형압/도무송은 최대 3세트(_1/_2/_3) 반복 필드를 가진다. 1세트만 기본 매핑.
//   - coating/spot_color/gluing/binding/multi_die/scratch_off/window_patch 는
//     CNC1000(명함) 폼에 단일 select 가 없거나(코팅=인쇄옵션/라디오), 다른
//     카테고리(봉투/책자/스티커) 전용이다. 카테고리별 재조사 필요 → `needsAudit`.

export interface SwadpiaFinishingField {
  /** 성원 폼 select/radio name */
  name: string
  /** HTML 정적 파싱으로 추출한 옵션값 (value=label_ko). 비어 있으면 runtimeOnly 참고. */
  options?: Record<string, string>
  /** 사이즈/용지에 따라 JS 로 동적 채워지는 필드 — 런타임 추출 필요. */
  runtimeOnly?: boolean
}

export interface SwadpiaFinishingMapping {
  /** finishing-catalog.ts 의 value 와 동일 키 */
  finishingValue: string
  /** 한국어 명칭(성원 기준) */
  label_ko: string
  /** 이 후가공을 발주 폼에 적용하기 위해 채워야 하는 필드들 */
  fields: SwadpiaFinishingField[]
  /** 매핑 신뢰도: 'mapped' = 검증됨, 'runtime' = 런타임 추출 필요, 'needs_audit' = 카테고리별 재조사 필요 */
  status: 'mapped' | 'runtime' | 'needs_audit'
  note?: string
}

// ─── 검증된 매핑 (CNC1000 명함 기준, 2026-06-08 라이브 조사) ────────────────

export const SWADPIA_FINISHING_FIELDS: SwadpiaFinishingMapping[] = [
  {
    finishingValue: 'foil_stamp',
    label_ko: '박',
    status: 'mapped',
    note: '박은 최대 3세트(_1/_2/_3). 기본 1세트 매핑. bak_exist_dongpan 은 동판 보유여부 선택 후 JS 채움.',
    fields: [
      { name: 'bak_section_1', options: { BKS10: '신규', BKS20: '보유동판' } },
      { name: 'bak_side_1', options: { BKD10: '전면', BKD20: '후면', BKD30: '양면' } },
      {
        name: 'bak_type_1',
        options: {
          BKT02: '금박(유광)', BKT09: '금박(무광)', BKT01: '은박(유광)', BKT10: '은박(무광)',
          BKT03: '청박(유광)', BKT04: '적박(유광)', BKT05: '녹박(유광)', BKT06: '먹박(유광)',
          BKT11: '홀로그램박(은펄)', BKT12: '홀로그램박(별)', BKT13: '홀로그램박(물방울)', BKT16: '로즈골드박(유광)',
        },
      },
      { name: 'bak_compare_1', options: { BAC10: '내용같음', BAC11: '내용틀림' } },
      { name: 'bak_exist_dongpan_1', runtimeOnly: true },
    ],
  },
  {
    finishingValue: 'deboss_emboss',
    label_ko: '형압',
    status: 'mapped',
    note: '형압(ap_*). 최대 3세트. 기본 1세트 매핑.',
    fields: [
      { name: 'ap_section_1', options: { APS10: '신규', APS20: '보유동판' } },
      { name: 'ap_type_1', options: { APT10: '앞으로 돌출', APT20: '뒤로 돌출' } },
      { name: 'ap_compare_1', options: { BAC10: '내용같음', BAC11: '내용틀림' } },
      { name: 'ap_exist_dongpan_1', runtimeOnly: true },
    ],
  },
  {
    finishingValue: 'die_cut',
    label_ko: '도무송',
    status: 'mapped',
    fields: [
      {
        name: 'domusong_section',
        options: { DMS20: '전체도무송', DMS21: '부분도무송', DMS30: '고객보관목형(전체)', DMS31: '고객보관목형(부분)' },
      },
      {
        name: 'domusong_type',
        options: { DMT51: '라운드,사각,원', DMT52: '꼭지점 6개이하', DMT53: '사물모양', DMT54: '미니홀더', DMT55: '박스펼친면' },
      },
      { name: 'domusong_num', options: { '1': '1개', '2': '2개', '3': '3개', '4': '4개' } },
      { name: 'domusong_exist_mok', runtimeOnly: true },
    ],
  },
  {
    finishingValue: 'drilled_hole',
    label_ko: '타공',
    status: 'mapped',
    fields: [
      { name: 'tagong_num', options: { '1': '1개', '2': '2개', '3': '3개', '4': '4개' } },
      { name: 'tagong_size', options: { '3': '3mm', '4': '4mm', '5': '5mm', '6': '6mm', '7': '7mm', '8': '8mm' } },
    ],
  },
  {
    finishingValue: 'numbering',
    label_ko: '넘버링',
    status: 'mapped',
    fields: [
      { name: 'numbering_type', options: { NBT10: '일반넘버링', NBT20: '난수넘버링' } },
      {
        name: 'numbering_kind',
        options: {
          NBN11: '6자리 1개 정매수', NBN12: '6자리 2개 정매수',
          NBN13: '6자리 1개 용지끝까지', NBN14: '6자리 2개 용지끝까지',
        },
      },
    ],
  },
  // ── OMO-2961: 런타임 추출 4종 라이브 추출 완료(2026-06-12) → 자동발주 검증 ──
  //   성원 CNC1000 폼을 Playwright READ-ONLY 로 활성화해 옵션값·필수필드·surcharge 확인.
  //   증거: scripts/test-artifacts/omo2961/{runtime-probe,verify-defaults,verify-amt}.json
  {
    finishingValue: 'round_corner',
    label_ko: '귀도리',
    status: 'mapped',
    note: '라이브 검증(OMO-2961): guidori_type + guidori_position1~4(체크박스). 기본=네귀도리 4mm(GDR40, 4모서리 전체). surcharge ₩3,000 확인.',
    fields: [
      {
        name: 'guidori_type',
        options: {
          GDR40: '네귀도리(4mm)', GDR30: '세귀도리(4mm)', GDR20: '두귀도리(4mm)', GDR10: '한귀도리(4mm)',
          GDR80: '네귀도리(6mm)', GDR70: '세귀도리(6mm)', GDR60: '두귀도리(6mm)', GDR50: '한귀도리(6mm)',
        },
      },
      { name: 'guidori_position1' }, { name: 'guidori_position2' },
      { name: 'guidori_position3' }, { name: 'guidori_position4' },
    ],
  },
  {
    finishingValue: 'epoxy',
    label_ko: '에폭시',
    status: 'mapped',
    note: '라이브 검증(OMO-2961): epoxy_type + epoxy_kind(타입선택 후 JS 동적 채움 → 발주시 첫 유효옵션 자동선택). 기본=전면(EPT10)+EPK10. surcharge ₩22,500 확인.',
    fields: [
      { name: 'epoxy_type', options: { EPT10: '전면', EPT20: '후면', EPT30: '양면' } },
      { name: 'epoxy_kind', runtimeOnly: true },
    ],
  },
  {
    finishingValue: 'score_crease',
    label_ko: '오시',
    status: 'mapped',
    note: '라이브 검증(OMO-2961): osi_num + osi_direction. 기본=1줄 중앙(OSN01)+가로방향(OMD10). surcharge ₩7,000 확인. ※옵션은 사이즈별 차이 가능 — 미존재 시 자동 제외.',
    fields: [
      {
        name: 'osi_num',
        options: {
          OSN01: '1줄(중앙)', OSN11: '1줄(중앙아님)', OSN02: '2줄', OSN03: '3줄',
          OSN04: '2줄(십자)', OSN05: '오시2줄(양끝10mm미만)', OSN06: '오시2줄(오시간격30mm미만)',
        },
      },
      { name: 'osi_direction', options: { OMD10: '가로방향(길게)', OMD20: '세로방향(짧게)' } },
    ],
  },
  {
    finishingValue: 'perforation',
    label_ko: '미싱',
    status: 'mapped',
    note: '라이브 검증(OMO-2961): missing_num + missing_direction. 기본=1줄 중앙(MSN01)+가로방향(OMD10). surcharge ₩7,000 확인. ※옵션은 사이즈별 차이 가능 — 미존재 시 자동 제외.',
    fields: [
      {
        name: 'missing_num',
        options: {
          MSN01: '1줄(중앙)', MSN11: '1줄(중앙아님)', MSN02: '2줄', MSN03: '3줄',
          MSN04: '2줄(십자)', MSN05: '미싱2줄(양끝10mm미만)', MSN06: '미싱2줄(미싱간격30mm미만)',
        },
      },
      { name: 'missing_direction', options: { OMD10: '가로방향(길게)', OMD20: '세로방향(짧게)' } },
    ],
  },
  // ── 명함(CNC1000) 폼에 단일 select 없음 / 카테고리별 재조사 필요 ──
  {
    finishingValue: 'coating',
    label_ko: '코팅',
    status: 'needs_audit',
    note: '명함은 코팅이 용지/인쇄 옵션(print_color_type) 혹은 라디오로 통합됨. 카테고리별 재조사 필요.',
    fields: [],
  },
  {
    finishingValue: 'spot_color',
    label_ko: '별색',
    status: 'needs_audit',
    note: '별색은 인쇄방식(print_color_type) 변형일 가능성. 카테고리별 재조사 필요.',
    fields: [],
  },
  { finishingValue: 'gluing', label_ko: '접착', status: 'needs_audit', note: '메모지/양식 전용. 해당 카테고리 폼 조사 필요.', fields: [] },
  { finishingValue: 'multi_die', label_ko: '문어발', status: 'needs_audit', note: '스티커 전용. 스티커 카테고리 폼 조사 필요.', fields: [] },
  { finishingValue: 'binding', label_ko: '제본', status: 'needs_audit', note: '책자 전용. 책자 카테고리 폼 조사 필요.', fields: [] },
  { finishingValue: 'scratch_off', label_ko: '복권', status: 'needs_audit', fields: [] },
  { finishingValue: 'window_patch', label_ko: '창문', status: 'needs_audit', note: '봉투/지함 전용.', fields: [] },
]

export const SWADPIA_FINISHING_BY_VALUE: Record<string, SwadpiaFinishingMapping> =
  Object.fromEntries(SWADPIA_FINISHING_FIELDS.map((m) => [m.finishingValue, m]))

/** 자동발주에 바로 적용 가능한(정적 옵션값 검증 완료) 후가공 value 목록. */
export const AUTO_ORDERABLE_FINISHINGS: string[] = SWADPIA_FINISHING_FIELDS.filter(
  (m) => m.status === 'mapped',
).map((m) => m.finishingValue)

// ─── 자동발주 기본값(가장 보편적인 선택) — OMO-2635 ────────────────────────
//
// 후가공을 고객이 "토글"로만 선택하는 v1에서, 각 후가공의 성원 폼 필드를
// 어떤 값으로 채울지 정한다. (서브 선택 UI가 추가되면 selected_options 에
// 개별 필드코드를 직접 넣어 override 가능 — expandFinishingToSwadpiaFields 가
// 명시값을 기본값보다 우선한다.)
//   - runtimeOnly 필드(bak_exist_dongpan_1 등)는 사이즈/보유여부 선택 후
//     성원 페이지가 JS로 채우므로 여기서 비움.
//   - 박/형압 단가는 박 면적(가로×세로 mm)에 비례한다(성원 calcuBakPrice:
//     bak_x_size>0 && bak_y_size>0 이어야 단가 산출, OMO-2647 라이브 검증).
//     면적 미지정 시 surcharge=0 이 되어 무료 발주가 되므로, 면적 입력 UI가
//     붙기 전까지 보수적 기본 면적(50×30mm, 로고 영역 가정)을 채운다. 고객이
//     selected_options 에 bak_x_size_1/bak_y_size_1 을 직접 넣으면 그 값이 우선.
export const DEFAULT_FINISHING_FIELD_VALUES: Record<string, Record<string, string>> = {
  foil_stamp: {
    bak_section_1: 'BKS10', // 신규
    bak_side_1: 'BKD10',    // 전면
    bak_type_1: 'BKT02',    // 금박(유광)
    bak_compare_1: 'BAC10', // 내용같음
    bak_x_size_1: '50',     // 박 면적 기본값(mm) — 면적 입력 UI 전 placeholder
    bak_y_size_1: '30',
  },
  deboss_emboss: {
    ap_section_1: 'APS10', // 신규
    ap_type_1: 'APT10',    // 앞으로 돌출
    ap_compare_1: 'BAC10', // 내용같음
    ap_x_size_1: '50',     // 형압 면적 기본값(mm) — 면적 입력 UI 전 placeholder
    ap_y_size_1: '30',
  },
  die_cut: {
    domusong_section: 'DMS20', // 전체도무송
    domusong_type: 'DMT51',    // 라운드,사각,원
    domusong_num: '1',
  },
  drilled_hole: {
    tagong_num: '1',
    tagong_size: '4', // 4mm
  },
  numbering: {
    numbering_type: 'NBT10', // 일반넘버링
    numbering_kind: 'NBN11', // 6자리 1개 정매수
    // numbering_kind 옵션은 정적 HTML 에 주석처리돼 있고 성원 settingNumberingKind()
    // 가 런타임에 채운다(activateFinishings 가 chk 체크 후 자동 호출). 단, 일부 용지
    // (스노우지 250/300g 등)는 calcuNumberingPrice 가 넘버링을 차단한다 — 그 상품/용지
    // 에선 surcharge=0 이며 자동발주에서 자동 제외된다(OMO-2647 라이브 검증).
  },
  // ── OMO-2961: 런타임 4종 (라이브 추출 기본값) ──────────────────────────────
  //   guidori_position1~4(체크박스) 와 epoxy_kind(동적 populate)는 activateFinishings
  //   가 코드로 처리한다(네귀도리=4모서리 전체 체크, epoxy_kind=첫 유효옵션). 여기엔
  //   select 기본값만 둔다.
  round_corner: {
    guidori_type: 'GDR40', // 네귀도리(4mm) = 4모서리 전체
  },
  epoxy: {
    epoxy_type: 'EPT10', // 전면
  },
  score_crease: {
    osi_num: 'OSN01',      // 1줄(중앙)
    osi_direction: 'OMD10', // 가로방향(길게)
  },
  perforation: {
    missing_num: 'MSN01',      // 1줄(중앙)
    missing_direction: 'OMD10', // 가로방향(길게)
  },
}

/**
 * 주문의 selected_options 를 성원 발주 폼 필드코드로 확장한다.
 *
 * 흐름: 고객 selected_options(`finishing` = 콤마구분 value 목록, 예 "foil_stamp,drilled_hole")
 *  → 각 후가공의 DEFAULT_FINISHING_FIELD_VALUES(또는 selected_options 에 직접 넣은
 *    명시 필드코드)를 병합한 성원 필드코드 맵을 반환.
 *
 * selectOrderOptions(swadpia-order.ts) 가 이 키들을 select[name]/radio[name] 에
 * 그대로 적용하므로, 반환 맵을 options_snapshot 에 병합하면 자동발주에 후가공이 적용된다.
 *
 * 안전성: `finishing` 키가 없으면 입력을 그대로 반환(기존 주문 무영향).
 *         성원 폼에 존재하지 않는 `finishing` 키 자체는 반환 맵에서 제거한다.
 */
export function expandFinishingToSwadpiaFields(
  selectedOptions: Record<string, string>,
): Record<string, string> {
  const finishingRaw = selectedOptions.finishing
  if (!finishingRaw) return { ...selectedOptions }

  // finishing 키를 제외한 나머지(명시 필드코드 포함)는 그대로 통과
  const { finishing: _drop, ...rest } = selectedOptions
  void _drop
  const out: Record<string, string> = { ...rest }

  const values = finishingRaw.split(',').map((v) => v.trim()).filter(Boolean)
  for (const value of values) {
    const defaults = DEFAULT_FINISHING_FIELD_VALUES[value]
    if (!defaults) continue // runtime/needs_audit 후가공은 자동발주 미지원(스킵)
    for (const [field, code] of Object.entries(defaults)) {
      // 이미 명시된 필드코드가 있으면 우선(서브 선택 UI override)
      if (out[field] === undefined) out[field] = code
    }
  }
  return out
}

// ─── OMO-3257: 박(foil) 멀티레이어 (최대 3 레이어 면적 합산) ─────────────────
//
// 박 금액 = Σ(레이어별 가로×세로 면적 단가). 성원 JS 근거(OMO-3238 확정):
//   settingExistBakDongpan(2/3) 로 레이어 2/3 행 생성 → 레이어별 calcuBakPrice()
//   → setPPBakAmtSum() 으로 bak_amt 합산. [+] 로 최대 3 레이어.
// 결정론: 가격은 성원 응답 bak_amt/pay_amt 에서만 읽고, 치수는 고객 입력값(추론 금지).

/** 박 레이어 최대 개수(성원 _1/_2/_3 세트). */
export const MAX_FOIL_LAYERS = 3

/** 박 종류(BKT0x) / 면(BKD10/20/30) 기본값. UI 미선택 시 사용. */
export const FOIL_DEFAULT_BAK_TYPE = 'BKT02' // 금박(유광)
export const FOIL_DEFAULT_BAK_SIDE = 'BKD10' // 전면

export interface FoilLayer {
  /** 박 영역 가로(mm) */
  x_size: number
  /** 박 영역 세로(mm) */
  y_size: number
  /** 박 종류 BKT0x (미지정 시 FOIL_DEFAULT_BAK_TYPE) */
  bak_type?: string
  /** 박 면 BKD10(전면)/BKD20(후면)/BKD30(양면) (미지정 시 FOIL_DEFAULT_BAK_SIDE) */
  bak_side?: string
}

export interface FoilLayerValidation {
  ok: boolean
  /** 사용자 노출용 한국어 오류 메시지(레이어별). ok=true 면 빈 배열. */
  errors: string[]
}

/**
 * 성원 박 사이즈 가드(chk_size_low/high)는 라이브 RE(OMO-3262) 결과 **고정 면적창이
 * 아니라 용지 cut 규격(가로/세로 mm) 대비 per-axis 상한**으로 확인됐다:
 *   유효 조건 = 0 < x ≤ cutX && 0 < y ≤ cutY (면적 하한 없음 — 2×2mm 도 정상).
 * 따라서 검증에 paperCut(용지 재단 규격 mm)을 주면 per-axis 로 차단하고,
 * 없으면 양수·개수만 본다(거짓거부 방지). 정밀 per-axis 데이터 배선은 OMO-3264.
 */
export interface FoilPaperCut {
  /** 용지 재단 가로(mm) */
  cutX: number
  /** 용지 재단 세로(mm) */
  cutY: number
}

/**
 * 박 레이어 배열을 검증한다.
 *  - 개수 1..MAX_FOIL_LAYERS, 각 레이어 가로/세로 > 0.
 *  - paperCut 가 주어지면 성원 chk_size_high 와 동일하게 per-axis 상한(가로/세로 ≤ 용지 cut)
 *    을 적용한다. paperCut 미지정 시 양수 검사만(면적창 가정 제거 — OMO-3262 RE).
 */
export function validateFoilLayers(
  layers: FoilLayer[],
  paperCut?: FoilPaperCut,
): FoilLayerValidation {
  const errors: string[] = []
  if (layers.length < 1) errors.push('박 레이어가 최소 1개 필요합니다.')
  if (layers.length > MAX_FOIL_LAYERS) {
    errors.push(`박 레이어는 최대 ${MAX_FOIL_LAYERS}개까지 추가할 수 있습니다.`)
  }
  layers.forEach((l, i) => {
    const n = i + 1
    const x = Number(l.x_size)
    const y = Number(l.y_size)
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) {
      errors.push(`박 레이어 ${n}: 가로·세로(mm)를 0보다 큰 값으로 입력하세요.`)
      return
    }
    if (paperCut) {
      if (x > paperCut.cutX) {
        errors.push(`박 레이어 ${n}: 가로 ${x}mm 가 용지 규격(${paperCut.cutX}mm)보다 큽니다.`)
      }
      if (y > paperCut.cutY) {
        errors.push(`박 레이어 ${n}: 세로 ${y}mm 가 용지 규격(${paperCut.cutY}mm)보다 큽니다.`)
      }
    }
  })
  return { ok: errors.length === 0, errors }
}

/**
 * 박 레이어 배열 → 성원 발주 폼 필드코드(bak_*_N) 평면 맵.
 * activateFinishings(swadpia-order.ts) 가 이 키들을 폼에 적용한다.
 * 최대 3 레이어까지만 직렬화(초과분은 무시).
 */
export function foilLayersToFields(layers: FoilLayer[]): Record<string, string> {
  const out: Record<string, string> = {}
  layers.slice(0, MAX_FOIL_LAYERS).forEach((l, i) => {
    const idx = i + 1
    out[`bak_section_${idx}`] = 'BKS10' // 신규
    out[`bak_side_${idx}`] = l.bak_side || FOIL_DEFAULT_BAK_SIDE
    out[`bak_type_${idx}`] = l.bak_type || FOIL_DEFAULT_BAK_TYPE
    out[`bak_compare_${idx}`] = 'BAC10' // 내용같음
    out[`bak_x_size_${idx}`] = String(l.x_size)
    out[`bak_y_size_${idx}`] = String(l.y_size)
  })
  return out
}

/**
 * 평면 옵션맵(bak_*_N)에서 박 레이어 배열을 복원한다.
 * surcharge 합산·발주 면적 가드에서 공용으로 쓴다. bak_x_size_N 또는 bak_y_size_N
 * 가 존재하는 인덱스만 레이어로 본다(1..3).
 */
export function parseFoilLayersFromOptions(opts: Record<string, string>): FoilLayer[] {
  const layers: FoilLayer[] = []
  for (let i = 1; i <= MAX_FOIL_LAYERS; i++) {
    const x = opts[`bak_x_size_${i}`]
    const y = opts[`bak_y_size_${i}`]
    if (x === undefined && y === undefined) continue
    layers.push({
      x_size: Number(x),
      y_size: Number(y),
      bak_type: opts[`bak_type_${i}`],
      bak_side: opts[`bak_side_${i}`],
    })
  }
  return layers
}
