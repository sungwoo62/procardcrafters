// 프리미엄 마감 카탈로그 — ProCardCrafters 차별화 축(OMO-2970 플랜 §2).
// 직업별 니치 페이지의 "프리미엄 마감 그리드" 섹션과 추천 마감 매핑에 공유 사용.
//
// ⚠️ 정직성 게이트(OMO-2972 가드레일 · 회사정책 OMO-2760):
//   여기 나열한 마감은 전부 실제 생산처(성원애드피아/Sungwon Adpia) 카탈로그에서
//   생산 가능함이 검증된 것만 둔다. 검증 근거: src/config/swadpia-finishing-fields.ts
//   (2026-06-08 라이브 조사) — 박(foil)·형압(emboss/deboss)·에폭시(raised gloss)·
//   도무송(die-cut)·용지(stock)·인쇄 QR.
//   제외(생산 불가 → 카피에서 빼야 하는 것):
//     - NFC 칩 카드: 성원 카탈로그에 칩 임베딩 없음 → 'tap-to-share/NFC' 주장 금지.
//       (QR 은 단순 인쇄 아트워크라 100% 생산 가능 → qr-smart 로 대체 유지)
//     - Painted/colored edges(엣지 도색): 성원 카탈로그에 엣지 컬러링 필드 없음 → 제외.
//     - True letterpress(잉크 레터프레스): 성원은 형압(emboss/deboss)만 → 형압으로 정직 표기.

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
    slug: 'emboss-deboss',
    name: 'Embossing & Debossing',
    blurb: 'Raised or recessed impressions pressed into thick stock — a tactile, crafted finish you feel before you read a word.',
    icon: '🔲',
  },
  {
    slug: 'raised-gloss',
    name: 'Raised Epoxy Gloss',
    blurb: 'Clear, glossy raised accents over a matte card — logos and details that stand up off the surface and catch the eye.',
    icon: '💧',
  },
  {
    slug: 'textured-stock',
    name: 'Textured & Specialty Stock',
    blurb: 'Heavyweight cotton, linen and specialty papers that signal quality the instant a card is in someone’s hand.',
    icon: '🧵',
  },
  {
    slug: 'die-cut',
    name: 'Die-Cut & Rounded Shapes',
    blurb: 'Rounded corners, custom outlines and cut-out shapes that make a card unmistakably yours in a stack of rectangles.',
    icon: '✂️',
  },
  {
    slug: 'qr-smart',
    name: 'QR Smart Cards',
    blurb: 'A printed QR code that opens your portfolio, listings, booking link or contact details in one scan — no app, nothing to install.',
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
