// 프리미엄 마감 카탈로그 — ProCardCrafters 차별화 축(OMO-2970 플랜 §2).
// 직업별 니치 페이지의 "프리미엄 마감 그리드" 섹션과 추천 마감 매핑에 공유 사용.

export type Finish = {
  slug: string
  name: string
  /** 1~2문장 마케팅 블러브(en-US). */
  blurb: string
  /** 이모지 아이콘(시각 그리드용, 외부 자산 의존 없음). */
  icon: string
}

export const FINISHES: Finish[] = [
  {
    slug: 'foil-stamping',
    name: 'Metallic Foil Stamping',
    blurb: 'Gold, silver, rose-gold and holographic foils that catch the light the moment you hand a card over.',
    icon: '✨',
  },
  {
    slug: 'letterpress',
    name: 'Letterpress',
    blurb: 'Deep, tactile impressions pressed into thick cotton stock — the gold standard for crafted, high-touch brands.',
    icon: '🅿️',
  },
  {
    slug: 'painted-edges',
    name: 'Painted Edges',
    blurb: 'A bold band of color along the edge of an ultra-thick card. Impossible to ignore in a stack.',
    icon: '🎨',
  },
  {
    slug: 'spot-uv',
    name: 'Spot UV Gloss',
    blurb: 'Raised, glossy accents on a matte card — logos and details that you can feel as well as see.',
    icon: '💧',
  },
  {
    slug: 'textured-stock',
    name: 'Textured & Specialty Stock',
    blurb: 'Linen, cotton, kraft and suede-touch papers that signal quality before a word is read.',
    icon: '🧵',
  },
  {
    slug: 'nfc-smart',
    name: 'NFC / QR Smart Cards',
    blurb: 'Tap-to-share digital cards: a single card opens your portfolio, listings, booking link or contact details instantly.',
    icon: '📲',
  },
]

const BY_SLUG = new Map(FINISHES.map((f) => [f.slug, f]))

export function getFinish(slug: string): Finish | undefined {
  return BY_SLUG.get(slug)
}

export function getFinishes(slugs: string[]): Finish[] {
  return slugs.map((s) => BY_SLUG.get(s)).filter((f): f is Finish => Boolean(f))
}
