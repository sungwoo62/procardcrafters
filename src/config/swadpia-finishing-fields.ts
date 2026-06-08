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
  {
    finishingValue: 'round_corner',
    label_ko: '귀도리',
    status: 'runtime',
    note: 'guidori_type 옵션은 사이즈 선택 후 JS 동적 채움. 런타임 추출 필요.',
    fields: [{ name: 'guidori_type', runtimeOnly: true }],
  },
  {
    finishingValue: 'epoxy',
    label_ko: '에폭시',
    status: 'runtime',
    note: 'epoxy_type 옵션은 JS 동적 채움. 런타임 추출 필요.',
    fields: [{ name: 'epoxy_type', runtimeOnly: true }],
  },
  {
    finishingValue: 'score_crease',
    label_ko: '오시',
    status: 'runtime',
    note: 'osi_num/osi_direction 은 사이즈에 따라 JS 동적 채움. 런타임 추출 필요.',
    fields: [
      { name: 'osi_num', runtimeOnly: true },
      { name: 'osi_direction', runtimeOnly: true },
    ],
  },
  {
    finishingValue: 'perforation',
    label_ko: '미싱',
    status: 'runtime',
    note: 'missing_num/missing_direction 은 사이즈에 따라 JS 동적 채움. 런타임 추출 필요.',
    fields: [
      { name: 'missing_num', runtimeOnly: true },
      { name: 'missing_direction', runtimeOnly: true },
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
