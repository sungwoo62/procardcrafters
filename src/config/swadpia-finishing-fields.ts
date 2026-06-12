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
  // ── OMO-3022: 추가 후가공 11종 라이브 추출(2026-06-13) ────────────────────────
  //   scripts/omo3022-probe.mts 로 전 카테고리 goods_view 폼을 READ-ONLY 활성화해
  //   chk_is_{type} 패널의 select/input 필드명·옵션값을 추출. 증거: scripts/test-artifacts/omo3022/probe.json
  //   옵션값이 카테고리별로 다른 필드(coating_type/folding_type/laminex_num 등)는
  //   activateFinishings 가 chk 클릭 후 첫 유효옵션을 자동선택한다(numbering_kind 패턴).
  {
    finishingValue: 'coating',
    label_ko: '코팅',
    status: 'runtime',
    note: '필드추출 완료(chk_is_coating, coating_type/coating_amt). ⚠️자동발주 미확정: chk 토글이 카테고리별 상이 — 캘린더(CCD)에선 토글 가능, 엽서(CDP3000)·스티커(CST1000)에선 단순 .click()으로 안 켜짐(JS 검증/라디오 추정), 배너(CPR5000)는 기본 ON. 카테고리별 활성화 핸들러 확인 후 mapped 승격. 라이브검증: scripts/test-artifacts/omo3022/verify.json',
    fields: [{ name: 'coating_type', runtimeOnly: true }],
  },
  {
    finishingValue: 'cutting',
    label_ko: '가공재단',
    status: 'runtime',
    note: '필드추출 완료(chk_is_cutting, cutting_type{CTT10~CTT50}+add_cut_x/y_size+add_parts_num). ⚠️자동발주 미확정: 면적비례(박/형압류)인데 CTT10 기본+50×30mm 로 cutting_amt=0. 과금 cutting_type 식별 + chgCuttingSize() 재계산 시퀀스 필요(OMO-2647 박 패턴).',
    fields: [
      { name: 'cutting_type', options: { CTT10: '재단1', CTT20: '재단2', CTT30: '재단3', CTT40: '재단4', CTT50: '재단5' } },
      { name: 'add_cut_margin_1', options: { '0': '0mm', '1': '1mm', '2': '2mm' } },
      { name: 'add_parts_num_1', runtimeOnly: true },
    ],
  },
  {
    finishingValue: 'binding',
    label_ko: '제본',
    status: 'mapped',
    note: '라이브 검증(OMO-3022): CNR2000에서 binding_amt=₩8,000 확인. binding_type{BDT10}+binding_add_set{BDS10~BDS40}+bundle_type(런타임). ※책자(CPR4000)는 제본이 상품구성 자체 → 별도(self).',
    fields: [
      { name: 'binding_type', options: { BDT10: '제본' } },
      { name: 'binding_add_set', options: { BDS10: '세트1', BDS20: '세트2', BDS30: '세트3', BDS40: '세트4' } },
      { name: 'bundle_type', runtimeOnly: true },
    ],
  },
  {
    finishingValue: 'folding',
    label_ko: '접지',
    status: 'mapped',
    note: '라이브 검증(OMO-3022): CPR3000에서 folding_amt=₩20,000 확인. folding_type{FDT01~}(런타임)+folding_direction(WL/HS)+select_folding_stair{FDO01,FDO02}.',
    fields: [
      { name: 'folding_type', runtimeOnly: true },
      { name: 'folding_direction', runtimeOnly: true },
      { name: 'select_folding_stair', options: { FDO01: '단1', FDO02: '단2' } },
    ],
  },
  {
    finishingValue: 'bonding',
    label_ko: '접착',
    status: 'runtime',
    note: '필드추출 완료(chk_is_bonding, bonding_type{BOT10~BOT60}+bonding_num+bonding_x/y_size). ⚠️자동발주 미확정: 면적비례인데 BOT10+50×30mm 로 bonding_amt=0. 과금 BOT 식별 + chgBondingType() 시퀀스 필요.',
    fields: [
      {
        name: 'bonding_type',
        options: { BOT10: '접착1', BOT20: '접착2', BOT30: '접착3', BOT40: '접착4', BOT50: '접착5', BOT60: '접착6' },
      },
    ],
  },
  {
    finishingValue: 'gluing',
    label_ko: '접착',
    status: 'runtime',
    note: '카탈로그 gluing(접착) → 성원 bonding 동일. bonding 자동발주 미확정 동일 적용. [[bonding]] 참조.',
    fields: [
      {
        name: 'bonding_type',
        options: { BOT10: '접착1', BOT20: '접착2', BOT30: '접착3', BOT40: '접착4', BOT50: '접착5', BOT60: '접착6' },
      },
    ],
  },
  {
    finishingValue: 'laminex',
    label_ko: '라미넥스',
    status: 'runtime',
    note: '필드추출 완료(chk_is_laminex, laminex_num). ⚠️자동발주 미확정: CST5000에서 laminex_num 옵션이 populate 안 됨(용지 의존 추정) → surcharge=0. 라미넥스 제공 용지에서 재검증 필요.',
    fields: [{ name: 'laminex_num', runtimeOnly: true }],
  },
  {
    finishingValue: 'stitching',
    label_ko: '중철/스티치',
    status: 'mapped',
    note: '라이브 검증(OMO-3022): CPR2000에서 stitching_amt=₩40,000 확인. stitching_type(런타임,예 SHT40)+stitching_direction{SHD10,SHD20}.',
    fields: [
      { name: 'stitching_type', runtimeOnly: true },
      { name: 'stitching_direction', options: { SHD10: '가로', SHD20: '세로' } },
    ],
  },
  {
    finishingValue: 'window',
    label_ko: '창문',
    status: 'mapped',
    note: '라이브 검증(OMO-3022): CEV1000(봉투)에서 window_amt=₩77,000 확인. window_size(85*40 등 규격, 런타임 자동선택)+window_num.',
    fields: [{ name: 'window_size', runtimeOnly: true }],
  },
  {
    finishingValue: 'window_patch',
    label_ko: '창문',
    status: 'mapped',
    note: '카탈로그 window_patch(창문) → 성원 window 와 동일 매핑(라이브 검증됨). [[window]] 참조.',
    fields: [{ name: 'window_size', runtimeOnly: true }],
  },
  {
    finishingValue: 'tape',
    label_ko: '양면테이프',
    status: 'mapped',
    note: '라이브 검증(OMO-3022): CEV1000(봉투)에서 tape_amt=₩23,000 확인. tape_type{TAP10~TAP40}(런타임 자동선택)+tape_num+tape_size.',
    fields: [{ name: 'tape_type', runtimeOnly: true }],
  },
  {
    finishingValue: 'partial_coating',
    label_ko: '부분코팅',
    status: 'runtime',
    note: '필드추출 완료(chk_is_partial_coating, partial_coating_x/y_size+partial_coating_amt). ⚠️자동발주 미확정: CPR5000에서 면적 입력+calcuEstimate 후에도 amt=0(전용 recalc 부재). 책자(CPR4000)/배너 전용 과금식 확인 필요.',
    fields: [],
  },
  // ── 여전히 재조사 필요(자동발주 미지원, 명확한 chk_is 없음/구조 모호) ──
  {
    finishingValue: 'spot_color',
    label_ko: '별색',
    status: 'needs_audit',
    note: '별색은 chk_is 토글이 아니라 인쇄색 선택(fside_spot_color SPC60~ / cover_color_info)에 내포됨. 후가공 토글로 분리 불가 → 인쇄색 옵션으로 다뤄야 함.',
    fields: [],
  },
  {
    finishingValue: 'multi_die',
    label_ko: '문어발',
    status: 'needs_audit',
    note: '문어발(다중조각 도무송)은 도무송(domusong) + add_parts_num 조합으로 추정되나 단독 chk_is 없음. die_cut/cutting 과 구조 중첩 → 별도 검증 필요.',
    fields: [],
  },
  {
    finishingValue: 'add_cutting',
    label_ko: '추가재단',
    status: 'needs_audit',
    note: 'CST2000(도무송스티커) 전용 chk_is_add_cutting. add_cut_x/y_size + add_cutting_amt + add_parts_num. cutting 과 필드 중첩(add_cut_*)이라 자동 라우팅 모호 → cutting 으로 통합 운용, 단독 매핑 보류.',
    fields: [],
  },
  { finishingValue: 'scratch_off', label_ko: '복권', status: 'needs_audit', note: '전 카테고리 probe 에서 chk_is 미발견(성원 미제공 추정).', fields: [] },
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
  // ── OMO-3022: 추가 후가공 11종 기본값(라이브 추출 2026-06-13) ──────────────────
  //   `__fin_<type>` 는 가상 활성화 마커다. coating/laminex 처럼 모든 핵심필드가
  //   런타임 자동선택이라 seed 할 구체 필드코드가 없는 후가공도, 이 마커로 chk_is_<type>
  //   활성화를 트리거한다(마커는 폼에 전송되지 않음 — isFinishingKey/activateFinishings 만 인식).
  //   면적 비례 후가공(cutting/bonding/partial_coating)은 박/형압과 동일하게 보수적 기본
  //   면적(50×30mm placeholder)을 채워 surcharge=0(무료발주)를 방지한다. 고객이
  //   selected_options 에 명시 필드코드/면적을 넣으면 그 값이 우선(expandFinishing override).
  // 라이브 surcharge 확인된 5종만 자동발주 기본값 등록(binding/folding/stitching/window/tape).
  // coating/cutting/bonding/gluing/laminex/partial_coating 은 status='runtime'(자동발주 미확정)
  // — DEFAULT 미등록 → expandFinishingToSwadpiaFields 가 안전하게 스킵(0원 무료발주 방지).
  binding: { __fin_binding: '1', binding_type: 'BDT10', binding_add_set: 'BDS10' },
  folding: { __fin_folding: '1', select_folding_stair: 'FDO01' },    // folding_type/direction 런타임 자동
  stitching: { __fin_stitching: '1', stitching_direction: 'SHD10' }, // stitching_type 런타임 자동
  window: { __fin_window: '1', window_num: '1' },                   // window_size 런타임 자동
  window_patch: { __fin_window: '1', window_num: '1' },             // 창문 = window
  tape: { __fin_tape: '1', tape_num: '1' },                         // tape_type 런타임 자동
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
