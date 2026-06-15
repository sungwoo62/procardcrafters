// OMO-2314: Swadpia 가이드 (sw_guide/main/1/CA01/CB01/CC02/) 의 16개 후가공
// 카탈로그 — 영문명 + 설명 + 생성된 이미지 URL.
// Gemini 3 Pro Image 로 1200×896px JPEG 16장 생성 → Supabase Storage
// `products/finishing/{value}.jpg` 에 저장.
//
// 새 제품에 후가공 옵션을 추가할 때 이 카탈로그에서 가져다 쓰면 됨.

export interface FinishingDef {
  value: string
  label_en: string
  label_ko: string
  description_en: string
  image_url: string
  /** 일반적으로 적용 가능한 제품 카테고리 힌트 (참고용, 강제 아님). */
  fits: string[]
}

const BASE = 'https://ilcfemvqommqyoohfoxw.supabase.co/storage/v1/object/public/products/finishing'

// OMO-3196: 성원(swadpia)에는 있으나 우리 카탈로그에 없던 후가공을 추가했다
// (가공재단/접지/라미넥스/중철/양면테이프/부분코팅). 이들은 Gemini 생성 사진이
// 아직 없으므로(`{value}.jpg` 미존재 → next/image 400), 의미 전달용 인라인 SVG
// 일러스트를 data-URI 로 넣어 깨진 이미지를 방지한다. 실제 사진이 준비되면
// image_url 을 `${BASE}/{value}.jpg` 로 교체하면 된다.
const svg = (inner: string, bg = '#eef2ff'): string =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="${bg}"/>${inner}</svg>`,
  )

const FINISHING_SVG: Record<string, string> = {
  // 가공재단 — 시트 + 점선 재단선 + 칼날
  cutting: svg(
    '<rect x="28" y="20" width="64" height="50" rx="3" fill="#fff" stroke="#c7d2fe"/>' +
      '<line x1="60" y1="12" x2="60" y2="78" stroke="#6366f1" stroke-width="2" stroke-dasharray="5 3"/>' +
      '<path d="M53 8 l7 6 l-7 6 z" fill="#6366f1"/>',
  ),
  // 접지 — 두 패널 + 접는선
  folding: svg(
    '<path d="M30 24 L60 32 L60 70 L30 62 Z" fill="#fff" stroke="#c7d2fe"/>' +
      '<path d="M60 32 L90 24 L90 62 L60 70 Z" fill="#e0e7ff" stroke="#c7d2fe"/>' +
      '<line x1="60" y1="32" x2="60" y2="70" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="3 2"/>',
  ),
  // 라미넥스 — 시트 위 광택 필름 + 대각 글로스 스트릭
  laminex: svg(
    '<defs><linearGradient id="lx" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#a5b4fc" stop-opacity="0.6"/><stop offset="55%" stop-color="#fff" stop-opacity="0.15"/><stop offset="100%" stop-color="#a5b4fc" stop-opacity="0.55"/></linearGradient></defs>' +
      '<rect x="28" y="22" width="64" height="46" rx="3" fill="#fff" stroke="#c7d2fe"/>' +
      '<rect x="28" y="22" width="64" height="46" rx="3" fill="url(#lx)"/>' +
      '<path d="M42 22 L54 22 L38 68 L28 64 L28 60 Z" fill="#fff" opacity="0.55"/>',
  ),
  // 중철(스티치) — 책자 스파인 + 스테이플
  stitching: svg(
    '<rect x="30" y="20" width="60" height="50" rx="2" fill="#fff" stroke="#c7d2fe"/>' +
      '<line x1="60" y1="20" x2="60" y2="70" stroke="#c7d2fe"/>' +
      '<rect x="57" y="30" width="6" height="3" fill="#6366f1"/>' +
      '<rect x="57" y="44" width="6" height="3" fill="#6366f1"/>' +
      '<rect x="57" y="58" width="6" height="3" fill="#6366f1"/>',
  ),
  // 양면테이프 — 접착 스트립
  tape: svg(
    '<rect x="30" y="24" width="60" height="42" rx="3" fill="#fff" stroke="#c7d2fe"/>' +
      '<rect x="36" y="38" width="48" height="14" rx="2" fill="#fde68a" stroke="#f59e0b"/>' +
      '<g fill="#f59e0b" opacity="0.5"><circle cx="44" cy="45" r="1.5"/><circle cx="56" cy="45" r="1.5"/><circle cx="68" cy="45" r="1.5"/><circle cx="78" cy="45" r="1.5"/></g>',
  ),
  // 부분코팅 — 시트 위 부분 광택 영역
  partial_coating: svg(
    '<rect x="28" y="22" width="64" height="46" rx="3" fill="#fff" stroke="#c7d2fe"/>' +
      '<rect x="46" y="32" width="28" height="26" rx="2" fill="#c7d2fe" opacity="0.75"/>' +
      '<rect x="50" y="36" width="7" height="18" fill="#fff" opacity="0.65"/>',
  ),
}

export const FINISHING_CATALOG: FinishingDef[] = [
  {
    value: 'foil_stamp',
    label_en: 'Foil Stamping (Gold)',
    label_ko: '박',
    description_en: 'Hot-stamped gold foil applied to selected areas — luxury statement.',
    image_url: `${BASE}/foil_stamp.jpg`,
    fits: ['business_cards', 'premium_business_cards', 'premium_foil_cards', 'greeting_cards', 'letterpress_cards'],
  },
  {
    value: 'deboss_emboss',
    label_en: 'Deboss / Emboss',
    label_ko: '형압',
    description_en: 'Pressed pattern that creates a tactile recessed (deboss) or raised (emboss) effect.',
    image_url: `${BASE}/deboss_emboss.jpg`,
    fits: ['business_cards', 'premium_business_cards', 'premium_foil_cards', 'letterpress_cards', 'greeting_cards'],
  },
  {
    value: 'coating',
    label_en: 'Coating (Matte / Gloss)',
    label_ko: '코팅',
    description_en: 'Protective laminate finish — matte, gloss, or soft-touch options.',
    image_url: `${BASE}/coating.jpg`,
    fits: ['business_cards', 'premium_business_cards', 'letterpress_cards', 'postcards', 'flyers', 'brochures'],
  },
  {
    value: 'score_crease',
    label_en: 'Scoring / Creasing',
    label_ko: '오시',
    description_en: 'Precise crease line to ensure clean folding without paper cracking.',
    image_url: `${BASE}/score_crease.jpg`,
    fits: ['brochures', 'greeting_cards', 'invitation_cards', 'booklets'],
  },
  {
    value: 'perforation',
    label_en: 'Perforation',
    label_ko: '미싱',
    description_en: 'Dotted tear-off line — for coupons, tickets, or detachable forms.',
    image_url: `${BASE}/perforation.jpg`,
    fits: ['flyers', 'forms', 'postcards', 'hangtag_cards'],
  },
  {
    value: 'drilled_hole',
    label_en: 'Drilled Hole',
    label_ko: '타공',
    description_en: 'Clean round hole punched through — for hang tags, swatches, or string-bound pieces.',
    image_url: `${BASE}/drilled_hole.jpg`,
    fits: ['hangtag_cards', 'labels'],
  },
  {
    value: 'round_corner',
    label_en: 'Rounded Corners',
    label_ko: '귀도리',
    description_en: 'Soft 3mm radius corners for a modern, approachable look.',
    image_url: `${BASE}/round_corner.jpg`,
    fits: ['business_cards', 'premium_business_cards', 'premium_foil_cards', 'letterpress_cards', 'postcards', 'flyers', 'stickers'],
  },
  {
    value: 'die_cut',
    label_en: 'Die Cut',
    label_ko: '도무송',
    description_en: 'Custom contour cut to any shape — perfect for stickers and unique cards.',
    image_url: `${BASE}/die_cut.jpg`,
    fits: ['stickers', 'die_cut_stickers', 'eco_stickers', 'invitation_cards'],
  },
  {
    value: 'numbering',
    label_en: 'Sequential Numbering',
    label_ko: '넘버링',
    description_en: 'Add unique serial numbers — for tickets, vouchers, or limited-edition items.',
    image_url: `${BASE}/numbering.jpg`,
    fits: ['forms', 'postcards', 'flyers'],
  },
  {
    value: 'gluing',
    label_en: 'Pad Glue Binding',
    label_ko: '접착',
    description_en: 'Glue-bound edge — for tear-off notepads, padded forms, and check pads.',
    image_url: `${BASE}/gluing.jpg`,
    fits: ['memo_pads', 'forms', 'notebooks'],
  },
  {
    value: 'multi_die',
    label_en: 'Multi-piece Die Cut',
    label_ko: '문어발',
    description_en: 'Multiple shapes connected on one sheet — easy to detach later, ships as one piece.',
    image_url: `${BASE}/multi_die.jpg`,
    fits: ['stickers', 'die_cut_stickers'],
  },
  {
    value: 'spot_color',
    label_en: 'Spot Color (Pantone)',
    label_ko: '별색',
    description_en: 'Vivid Pantone spot ink for exact brand colors beyond CMYK gamut.',
    image_url: `${BASE}/spot_color.jpg`,
    fits: ['business_cards', 'premium_business_cards', 'premium_foil_cards', 'letterpress_cards', 'posters', 'brochures'],
  },
  {
    value: 'binding',
    label_en: 'Binding',
    label_ko: '제본',
    description_en: 'Saddle-stitch, perfect-bound, or spiral binding for booklets and catalogs.',
    image_url: `${BASE}/binding.jpg`,
    fits: ['booklets', 'notebooks'],
  },
  {
    value: 'scratch_off',
    label_en: 'Scratch-off Coating',
    label_ko: '복권',
    description_en: 'Silver scratch-off layer — reveal hidden codes for lottery, vouchers, or promos.',
    image_url: `${BASE}/scratch_off.jpg`,
    fits: ['postcards', 'flyers'],
  },
  {
    value: 'window_patch',
    label_en: 'Window Patching',
    label_ko: '창문',
    description_en: 'Cellophane window cut into the printed piece — show contents through the front.',
    image_url: `${BASE}/window_patch.jpg`,
    fits: ['envelopes', 'paper_bags'],
  },
  {
    value: 'epoxy',
    label_en: 'Epoxy 3D Resin',
    label_ko: '에폭시',
    description_en: 'Clear raised resin coating — glossy 3D dome over logo or selected area.',
    image_url: `${BASE}/epoxy.jpg`,
    fits: ['business_cards', 'premium_business_cards', 'premium_foil_cards', 'letterpress_cards', 'labels'],
  },
  // ── OMO-3196: 성원(swadpia) 에는 있으나 누락됐던 후가공 6종 추가 ──────────────
  //   value 는 swadpia-finishing-fields.ts 매핑 키와 동일 → 자동발주 파이프라인이
  //   이미 인식한다. 사진 미보유 → FINISHING_SVG data-URI 일러스트 사용.
  //   (성원 bonding/접착 ≈ 기존 gluing, add_cutting/추가재단 ≈ cutting, window ≈
  //    window_patch 로 이미 커버되어 중복 카드를 만들지 않는다.)
  {
    value: 'cutting',
    label_en: 'Custom Cutting',
    label_ko: '가공재단',
    description_en: 'Precision guillotine cutting into multiple custom pieces or non-standard sizes.',
    image_url: FINISHING_SVG.cutting,
    fits: ['stickers', 'die_cut_stickers', 'flyers', 'brochures', 'posters', 'labels'],
  },
  {
    value: 'folding',
    label_en: 'Folding',
    label_ko: '접지',
    description_en: 'Machine folding — bi-fold, tri-fold, or gate-fold for leaflets and brochures.',
    image_url: FINISHING_SVG.folding,
    fits: ['flyers', 'brochures', 'postcards', 'posters'],
  },
  {
    value: 'laminex',
    label_en: 'Laminex Film',
    label_ko: '라미넥스',
    description_en: 'Specialty protective film lamination for extra durability and a refined surface.',
    image_url: FINISHING_SVG.laminex,
    fits: ['stickers', 'die_cut_stickers', 'labels', 'flyers'],
  },
  {
    value: 'stitching',
    label_en: 'Saddle Stitching',
    label_ko: '중철',
    description_en: 'Wire saddle-stitch binding through the spine — clean and economical for booklets.',
    image_url: FINISHING_SVG.stitching,
    fits: ['brochures', 'booklets', 'posters'],
  },
  {
    value: 'tape',
    label_en: 'Double-sided Tape',
    label_ko: '양면테이프',
    description_en: 'Pre-applied adhesive strip for self-seal envelopes and easy mounting.',
    image_url: FINISHING_SVG.tape,
    fits: ['envelopes', 'banners', 'paper_bags'],
  },
  {
    value: 'partial_coating',
    label_en: 'Spot Coating',
    label_ko: '부분코팅',
    description_en: 'Gloss or matte coating applied only to selected areas for a tactile spot-UV effect.',
    image_url: FINISHING_SVG.partial_coating,
    fits: ['booklets', 'brochures', 'banners', 'posters'],
  },
]

export const FINISHING_BY_VALUE: Record<string, FinishingDef> = Object.fromEntries(
  FINISHING_CATALOG.map(f => [f.value, f])
)

// ── OMO-3196 (보드 재요청): 제품별 후가공 목록을 성원(swadpia) 실제 제공분에 맞춘다 ──
//   기존 per-finishing `fits` 는 너무 좁아 명함에 4~6종만 떠 보드가 "성원엔 더 많은데
//   안 맞다"고 지적. 성원 카테고리별 후가공 probe(scripts/test-artifacts/omo3022/probe.json)
//   를 우리 카탈로그 value 로 매핑한 권위 목록으로 교체한다. (성원 dbak/depoxy=박/에폭시
//   중복, add_cutting=cutting, bonding=gluing(접착), window=window_patch 로 통합.)
//   여기 없는 카테고리는 기존 `fits` 로 폴백.
export const CATEGORY_FINISHINGS: Record<string, string[]> = {
  // CNC1000/CNC2000 명함: 성원 9코어(박/형압/도무송/타공/오시/미싱/넘버링/귀도리/에폭시)
  //   + 우리가 마케팅하는 코팅·별색.
  business_cards: ['foil_stamp', 'deboss_emboss', 'coating', 'spot_color', 'round_corner', 'die_cut', 'drilled_hole', 'score_crease', 'perforation', 'numbering', 'epoxy'],
  premium_business_cards: ['foil_stamp', 'deboss_emboss', 'coating', 'spot_color', 'round_corner', 'die_cut', 'drilled_hole', 'score_crease', 'perforation', 'numbering', 'epoxy'],
  premium_foil_cards: ['foil_stamp', 'deboss_emboss', 'coating', 'spot_color', 'round_corner', 'die_cut', 'score_crease', 'epoxy'],
  letterpress_cards: ['foil_stamp', 'deboss_emboss', 'spot_color', 'round_corner', 'score_crease', 'epoxy'],
  // CST1000/CST2000 스티커
  stickers: ['coating', 'cutting', 'die_cut', 'round_corner', 'laminex', 'foil_stamp'],
  die_cut_stickers: ['die_cut', 'cutting', 'coating', 'laminex', 'multi_die', 'foil_stamp'],
  eco_stickers: ['die_cut', 'cutting', 'coating', 'foil_stamp'],
  // CLF1000/CLF2000 전단/리플릿/브로슈어
  flyers: ['coating', 'folding', 'score_crease', 'perforation', 'die_cut', 'drilled_hole', 'numbering', 'cutting', 'binding', 'gluing', 'laminex', 'stitching', 'foil_stamp', 'deboss_emboss', 'epoxy'],
  brochures: ['coating', 'folding', 'score_crease', 'perforation', 'die_cut', 'drilled_hole', 'numbering', 'cutting', 'binding', 'gluing', 'laminex', 'stitching', 'spot_color', 'foil_stamp', 'deboss_emboss', 'epoxy'],
  // CDP3000 엽서
  postcards: ['coating', 'score_crease', 'perforation', 'die_cut', 'drilled_hole', 'folding', 'round_corner', 'numbering', 'gluing', 'foil_stamp', 'deboss_emboss', 'epoxy'],
  // CPR2000 포스터
  posters: ['coating', 'folding', 'cutting', 'binding', 'laminex', 'stitching', 'spot_color', 'foil_stamp', 'deboss_emboss', 'epoxy'],
  // CPR5000 배너/현수막
  banners: ['coating', 'partial_coating', 'tape', 'gluing', 'die_cut', 'foil_stamp', 'deboss_emboss', 'epoxy'],
  // CEV1000 봉투
  envelopes: ['foil_stamp', 'window_patch', 'tape', 'drilled_hole', 'die_cut'],
  // CPR4000 책자/카탈로그
  booklets: ['binding', 'coating', 'partial_coating', 'stitching', 'score_crease', 'round_corner', 'die_cut', 'foil_stamp', 'deboss_emboss', 'epoxy'],
}

/** 제품 카테고리에 노출할 후가공 목록 — 성원 매핑 우선, 없으면 catalog.fits 폴백. */
export function finishingsForCategory(category: string): FinishingDef[] {
  const explicit = CATEGORY_FINISHINGS[category]
  if (explicit) return explicit.map(v => FINISHING_BY_VALUE[v]).filter(Boolean)
  return FINISHING_CATALOG.filter(f => f.fits.includes(category))
}

// ── OMO-2705: 요소(element) 단위 후가공 (Vistaprint식) ─────────────────────────
// 에디터에서 텍스트/벡터 요소에 직접 켜는 후가공 종류. 카탈로그 value 재사용.
// MVP = 박(foil_stamp) 1종. 새 종류 추가 시 ELEMENT_FINISH_KINDS 에만 더하면 됨.
export type FinishKind = 'foil_stamp'

/** 에디터 Finishes 패널에 노출되는 요소 후가공 목록 (MVP: 박만). */
export const ELEMENT_FINISH_KINDS: FinishKind[] = ['foil_stamp']

/** 박 기본 별색 — 설계안 §2 A1 (M100 별색판). */
export const DEFAULT_FOIL_SPOT_COLOR = 'M100'
