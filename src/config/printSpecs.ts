// OMO-2709 [Part C] 성원 규격 템플릿 다운로드 — 스펙 SSOT.
//
// 고객이 사이즈·후가공을 선택하면 이 설정을 바탕으로 트림/블리드/세이프 가이드 +
// M100 별색(스팟) 레이어 placeholder 가 들어간 PDF/SVG/AI 템플릿을 생성한다.
//
// 치수(mm)는 EditorClient `PRODUCT_DIMS` 와 동일한 값을 거울처럼 유지한다.
// (에디터 캔버스와 다운로드 템플릿이 트림/블리드/세이프에서 어긋나면 안 되므로.)
//
// 후가공 → 별색 규칙은 [OMO-2704] 라이브 검증 결정문을 그대로 따른다:
//   · 후가공은 별도 파일이 아니라 "디자인 합본 단일 AI 의 별색 레이어"
//   · 별색은 스팟 채널 1도, 외형은 M100(=DeviceCMYK 0,1,0,0) 으로 지정
//   · K100·process CMYK 금지, 레지마크 작도 불필요(단일파일 자동정합)

export interface PrintSpecDims {
  widthMm: number
  heightMm: number
  /** 재단 바깥 여백(블리드). 트림 기준 사방으로 확장. */
  bleedMm: number
  /** 재단 안쪽 안전선. 이 안에 중요한 내용 배치. */
  safeMm: number
}

// EditorClient PRODUCT_DIMS 와 동일 — 변경 시 양쪽 함께 수정할 것.
export const PRINT_SPEC_DIMS: Record<string, PrintSpecDims> = {
  business_cards:         { widthMm: 85,  heightMm: 55,  bleedMm: 3, safeMm: 3 },
  premium_business_cards: { widthMm: 85,  heightMm: 55,  bleedMm: 3, safeMm: 3 },
  premium_foil_cards:     { widthMm: 85,  heightMm: 55,  bleedMm: 3, safeMm: 3 },
  letterpress_cards:      { widthMm: 85,  heightMm: 55,  bleedMm: 3, safeMm: 3 },
  stickers:               { widthMm: 70,  heightMm: 70,  bleedMm: 3, safeMm: 3 },
  die_cut_stickers:       { widthMm: 70,  heightMm: 70,  bleedMm: 3, safeMm: 5 },
  flyers:                 { widthMm: 148, heightMm: 210, bleedMm: 3, safeMm: 5 },
  brochures:              { widthMm: 148, heightMm: 210, bleedMm: 3, safeMm: 5 },
  postcards:              { widthMm: 152, heightMm: 102, bleedMm: 3, safeMm: 3 },
  posters:                { widthMm: 210, heightMm: 297, bleedMm: 3, safeMm: 5 },
  banners:                { widthMm: 200, heightMm: 300, bleedMm: 5, safeMm: 10 },
}

export const DEFAULT_SPEC_DIMS: PrintSpecDims = { widthMm: 85, heightMm: 55, bleedMm: 3, safeMm: 3 }

export function resolveSpecDims(productSlug: string): PrintSpecDims {
  // 라우팅 슬러그는 하이픈(business-cards), 치수 키는 언더스코어(business_cards)일 수 있어 양쪽 시도.
  const norm = productSlug.replace(/-/g, '_')
  return PRINT_SPEC_DIMS[productSlug] ?? PRINT_SPEC_DIMS[norm] ?? DEFAULT_SPEC_DIMS
}

// M100 별색(외형). DeviceCMYK 0,1,0,0 / 근사 RGB #EC008C.
// SVG 는 RGB 공간이라 근사색으로 그리되, 레이어명/주석으로 "별색 M100 = 스팟 1도"임을 명시한다.
export const M100_CMYK = { c: 0, m: 1, y: 0, k: 0 } as const
export const M100_RGB_HEX = '#EC008C'

export interface FinishingSpotRule {
  /** finishing-catalog.ts value 와 동일 키 */
  value: string
  label_ko: string
  /** 별색 레이어명(일러스트에서 그대로 보임). */
  spotLayerName: string
  /** 고객 안내 문구(템플릿 상단 주석). */
  note: string
}

// 성원 별색 레이어로 출력 가능한 후가공만 등록(박/형압/도무송/스팟UV 계열).
// 그 외 후가공(코팅·오시·미싱 등)은 별색판이 아니라 발주 옵션이므로 템플릿 레이어 대상 아님.
export const FINISHING_SPOT_RULES: Record<string, FinishingSpotRule> = {
  foil_stamp: {
    value: 'foil_stamp',
    label_ko: '박',
    spotLayerName: 'M100_별색_박',
    note: '박 적용 영역을 이 레이어에 M100(별색 1도)으로 작도하세요. K100·CMYK 금지.',
  },
  deboss_emboss: {
    value: 'deboss_emboss',
    label_ko: '형압',
    spotLayerName: 'M100_별색_형압',
    note: '형압(엠보/디보스) 영역을 이 레이어에 M100(별색 1도)으로 작도하세요.',
  },
  domusong: {
    value: 'domusong',
    label_ko: '도무송',
    spotLayerName: 'M100_별색_도무송',
    note: '도무송(칼선) 경로를 이 레이어에 M100(별색 1도) 선으로 작도하세요.',
  },
  spot_uv: {
    value: 'spot_uv',
    label_ko: '에폭시/스팟UV',
    spotLayerName: 'M100_별색_에폭시',
    note: '에폭시(스팟UV) 영역을 이 레이어에 M100(별색 1도)으로 작도하세요.',
  },
}

export function resolveFinishingRules(values: string[]): FinishingSpotRule[] {
  return values
    .map((v) => FINISHING_SPOT_RULES[v])
    .filter((r): r is FinishingSpotRule => Boolean(r))
}

export type TemplateFormat = 'pdf' | 'svg' | 'ai'

export const TEMPLATE_FORMATS: TemplateFormat[] = ['pdf', 'svg', 'ai']
