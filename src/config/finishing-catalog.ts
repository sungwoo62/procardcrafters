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
]

export const FINISHING_BY_VALUE: Record<string, FinishingDef> = Object.fromEntries(
  FINISHING_CATALOG.map(f => [f.value, f])
)

// ── OMO-2705: 요소(element) 단위 후가공 (Vistaprint식) ─────────────────────────
// 에디터에서 텍스트/벡터 요소에 직접 켜는 후가공 종류. 카탈로그 value 재사용.
// MVP = 박(foil_stamp) 1종. 새 종류 추가 시 ELEMENT_FINISH_KINDS 에만 더하면 됨.
export type FinishKind = 'foil_stamp'

/** 에디터 Finishes 패널에 노출되는 요소 후가공 목록 (MVP: 박만). */
export const ELEMENT_FINISH_KINDS: FinishKind[] = ['foil_stamp']

/** 박 기본 별색 — 설계안 §2 A1 (M100 별색판). */
export const DEFAULT_FOIL_SPOT_COLOR = 'M100'
