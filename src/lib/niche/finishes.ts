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
  /**
   * 마감을 보여주는 실사진(추천옵션 관련, OMO-3211 보드 요청).
   * Unsplash(next.config remotePatterns 허용 호스트) — 전부 HTTP 200 검증(2026-06-15).
   */
  image: string
  /**
   * ProductConfigurator 후가공 옵션 value(주문 가능 마감만).
   * "추천옵션대로 만들기" 딥링크가 /products/...?finishing= 에 실어 프리셀렉트.
   * 미설정(undefined)=주문 후가공 토글이 아닌 마감(용지/QR 아트워크 등) → 프리셀렉트 제외.
   * 매핑 근거: src/config/finishing-surcharge.ts (foil_stamp/deboss_emboss/die_cut 만 주문가).
   */
  configValue?: string
}

// Unsplash 사진 ID — 각 마감 주제별. clean 쿼리스트링으로 next/image·img 모두 안전.
const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`

export const FINISHES: Finish[] = [
  {
    slug: 'foil-stamping',
    name: 'Metallic Foil Stamping',
    blurb: 'Gold, silver, rose-gold and holographic foils that catch the light the moment you hand a card over.',
    icon: '✨',
    image: IMG('1597979732130-9d2ad18df38b'),
    configValue: 'foil_stamp',
  },
  {
    slug: 'emboss-deboss',
    name: 'Embossing & Debossing',
    blurb: 'Raised or recessed impressions pressed into thick stock — a tactile, crafted finish you feel before you read a word.',
    icon: '🔲',
    image: IMG('1699662585308-fcb113a0a4ba'),
    configValue: 'deboss_emboss',
  },
  {
    slug: 'raised-gloss',
    name: 'Raised Epoxy Gloss',
    blurb: 'Clear, glossy raised accents over a matte card — logos and details that stand up off the surface and catch the eye.',
    icon: '💧',
    image: IMG('1777652918753-d66882b15391'),
  },
  {
    slug: 'textured-stock',
    name: 'Textured & Specialty Stock',
    blurb: 'Heavyweight cotton, linen and specialty papers that signal quality the instant a card is in someone’s hand.',
    icon: '🧵',
    image: IMG('1516409590654-e8d51fc2d25c'),
  },
  {
    slug: 'die-cut',
    name: 'Die-Cut & Rounded Shapes',
    blurb: 'Rounded corners, custom outlines and cut-out shapes that make a card unmistakably yours in a stack of rectangles.',
    icon: '✂️',
    image: IMG('1765483469974-3f544df12caf'),
    configValue: 'die_cut',
  },
  {
    slug: 'qr-smart',
    name: 'QR Smart Cards',
    blurb: 'A printed QR code that opens your portfolio, listings, booking link or contact details in one scan — no app, nothing to install.',
    icon: '📲',
    image: IMG('1595079676339-1534801ad6cf'),
  },
]

/** 추천 마감 중 주문 가능한 configValue 만 추출(딥링크 프리셋용). */
export function presetFinishingValues(slugs: string[]): string[] {
  return slugs
    .map((s) => BY_SLUG.get(s)?.configValue)
    .filter((v): v is string => Boolean(v))
}

const BY_SLUG = new Map(FINISHES.map((f) => [f.slug, f]))

export function getFinish(slug: string): Finish | undefined {
  return BY_SLUG.get(slug)
}

export function getFinishes(slugs: string[]): Finish[] {
  return slugs.map((s) => BY_SLUG.get(s)).filter((f): f is Finish => Boolean(f))
}
