// OMO-3159: 고객용 견적서(PDF) 팬톤 테마.
//
// 두 가지를 제공한다:
//   1) PANTONE_QUOTE_THEME — 견적서 문서 자체의 큐레이션 팬톤 팔레트
//      (헤더 / 액센트 / 표 강조 / 잉크 / 보조). 인쇄 보존을 위해 Pantone 근사 sRGB.
//   2) PRODUCT_PANTONE_MIXES — 제품군별 "어울리는 팬톤 조합 1~2종" 추천.
//      견적서에 "Recommended Pantone color mix" 섹션으로 노출되어,
//      비회원 고객이 디자인 방향을 잡도록 돕는다(북극성: 고객 만족도 향상).
//
// 주의(정직성 가드 OMO-2975): 여기 값은 우리 자체 큐레이션 팔레트다. 성원/타사
// 별색표·자산을 복제하지 않는다. Pantone 코드는 업계 표준 별색 참조 표기일 뿐이며,
// sRGB 근사값은 화면/문서 표시용(실제 인쇄 별색은 잉크 매칭 시 확정)이다.

export interface PantoneSwatch {
  /** Pantone 별색 참조 코드 (예: "286 C"). */
  pantone: string
  /** 사람이 읽는 색 이름. */
  name: string
  /** 화면/PDF 표시용 sRGB 근사 (#RRGGBB). */
  hex: string
}

export interface PantoneMix {
  /** 믹스 이름 (예: "Executive Navy & Gold"). */
  label: string
  /** 어떤 인상을 주는지 한 줄 설명(영문 — 견적서가 영문이므로). */
  mood: string
  /** 1~2색 조합. */
  swatches: PantoneSwatch[]
}

/** 견적서 문서 테마 팔레트. */
export const PANTONE_QUOTE_THEME = {
  /** 헤더 밴드 / 제목. Pantone 286 C. */
  header: { pantone: '286 C', name: 'Reflex Blue', hex: '#0033A0' } as PantoneSwatch,
  /** 액센트 라인 / 강조 숫자. Pantone 2925 C. */
  accent: { pantone: '2925 C', name: 'Sky', hex: '#009CDE' } as PantoneSwatch,
  /** 표 헤더 배경 틴트(액센트의 옅은 톤). */
  tableHeaderBg: { pantone: '2975 C', name: 'Light Sky', hex: '#BFE3F2' } as PantoneSwatch,
  /** 본문 잉크. Pantone Black 6 C. */
  ink: { pantone: 'Black 6 C', name: 'Rich Black', hex: '#101820' } as PantoneSwatch,
  /** 보조 텍스트 / 구분선. Pantone Cool Gray 7 C. */
  muted: { pantone: 'Cool Gray 7 C', name: 'Cool Gray', hex: '#97999B' } as PantoneSwatch,
  /** 합계 강조(긍정). Pantone 354 C. */
  positive: { pantone: '354 C', name: 'Fresh Green', hex: '#00B140' } as PantoneSwatch,
} as const

/**
 * 제품 카테고리(database.ts ProductCategory) → 추천 팬톤 믹스 1~2종.
 * 매칭 안 되면 DEFAULT_PANTONE_MIXES 사용.
 */
export const PRODUCT_PANTONE_MIXES: Record<string, PantoneMix[]> = {
  business_cards: [
    {
      label: 'Executive Navy & Gold',
      mood: 'Trusted, premium, finance & law',
      swatches: [
        { pantone: '533 C', name: 'Deep Navy', hex: '#243E5E' },
        { pantone: '871 C', name: 'Metallic Gold', hex: '#85754E' },
      ],
    },
    {
      label: 'Modern Mono',
      mood: 'Clean, minimal, tech & design',
      swatches: [
        { pantone: 'Black 6 C', name: 'Rich Black', hex: '#101820' },
        { pantone: '2925 C', name: 'Sky Accent', hex: '#009CDE' },
      ],
    },
  ],
  premium_business_cards: [
    {
      label: 'Luxe Charcoal & Champagne',
      mood: 'High-end, boutique, hospitality',
      swatches: [
        { pantone: '447 C', name: 'Charcoal', hex: '#3D3935' },
        { pantone: '7501 C', name: 'Champagne', hex: '#E1D2B6' },
      ],
    },
  ],
  stickers: [
    {
      label: 'Pop Punch',
      mood: 'Playful, youthful, retail & events',
      swatches: [
        { pantone: '213 C', name: 'Hot Pink', hex: '#E10098' },
        { pantone: '2995 C', name: 'Bright Cyan', hex: '#00A9E0' },
      ],
    },
  ],
  die_cut_stickers: [
    {
      label: 'Sunset Pop',
      mood: 'Warm, energetic, lifestyle brands',
      swatches: [
        { pantone: '137 C', name: 'Marigold', hex: '#FFA300' },
        { pantone: '199 C', name: 'Coral Red', hex: '#D50032' },
      ],
    },
  ],
  flyers: [
    {
      label: 'Fresh Market',
      mood: 'Approachable, promotions & local',
      swatches: [
        { pantone: '354 C', name: 'Fresh Green', hex: '#00B140' },
        { pantone: '137 C', name: 'Marigold', hex: '#FFA300' },
      ],
    },
  ],
  brochures: [
    {
      label: 'Corporate Teal',
      mood: 'Informative, B2B & corporate',
      swatches: [
        { pantone: '321 C', name: 'Teal', hex: '#008C95' },
        { pantone: 'Cool Gray 9 C', name: 'Slate', hex: '#75787B' },
      ],
    },
  ],
  postcards: [
    {
      label: 'Soft Rose',
      mood: 'Friendly, invitations & direct mail',
      swatches: [
        { pantone: '210 C', name: 'Rose', hex: '#F99FC9' },
        { pantone: '534 C', name: 'Indigo', hex: '#1B365D' },
      ],
    },
  ],
  posters: [
    {
      label: 'Bold Statement',
      mood: 'High-impact, events & campaigns',
      swatches: [
        { pantone: '2745 C', name: 'Deep Violet', hex: '#221C5E' },
        { pantone: '108 C', name: 'Vivid Yellow', hex: '#FEDB00' },
      ],
    },
  ],
  banners: [
    {
      label: 'Signal Red',
      mood: 'Attention-grabbing, sale & promo',
      swatches: [
        { pantone: '186 C', name: 'Signal Red', hex: '#C8102E' },
        { pantone: 'Black 6 C', name: 'Rich Black', hex: '#101820' },
      ],
    },
  ],
}

export const DEFAULT_PANTONE_MIXES: PantoneMix[] = [
  {
    label: 'PCC Signature Blue',
    mood: 'Versatile, professional, on-brand',
    swatches: [
      { pantone: '286 C', name: 'Reflex Blue', hex: '#0033A0' },
      { pantone: '2925 C', name: 'Sky', hex: '#009CDE' },
    ],
  },
]

/** 카테고리로 추천 팬톤 믹스를 고른다(없으면 기본). */
export function pantoneMixesForCategory(category: string | null | undefined): PantoneMix[] {
  if (category && PRODUCT_PANTONE_MIXES[category]) return PRODUCT_PANTONE_MIXES[category]
  return DEFAULT_PANTONE_MIXES
}

/** "#RRGGBB" → pdf-lib rgb() 입력용 0~1 트리플. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return { r, g, b }
}
