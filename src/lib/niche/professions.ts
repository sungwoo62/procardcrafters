// 직업별 니치 랜딩 콘텐츠 소스 (OMO-2971).
// 단일 소스로 라우트(generateStaticParams/generateMetadata), 템플릿, JSON-LD, sitemap을 구동한다.
//
// 콘텐츠 운영(수십 개 양산, C2 Content): 두 경로 지원.
//   1) 이 파일 SEED_PROFESSIONS 에 직접 추가(PR) — 즉시 정적 생성.
//   2) procardcrafters Supabase `print_niche_pages` 테이블에 row 삽입 — 코드 배포 없이 추가.
//      (loader 가 DB row 를 slug 기준 병합, 테이블 부재 시 무시하고 SEED 로 폴백)
// 본 이슈 범위: 인프라 + 시드 직업 1~2개(realtors, photographers) 템플릿 검증.

export type FaqItem = { question: string; answer: string }
export type InternalLink = { label: string; href: string }

export type ProfessionContent = {
  /** URL slug, 복수형 권장. 예: 'realtors' → /business-cards/for/realtors */
  slug: string
  /** 복수형 표기. 예: 'Realtors' */
  profession: string
  /** 단수형 표기(문장 삽입용). 예: 'Realtor' */
  professionSingular: string
  h1: string
  metaTitle: string
  metaDescription: string
  heroSubhead: string
  /** 직업 맥락 단락(왜 이 직업에 프리미엄 명함이 통하는가). */
  intro: string
  /** 유스케이스 불릿. */
  useCases: string[]
  /** finishes.ts 의 finish slug 참조(추천 마감). */
  recommendedFinishes: string[]
  faqs: FaqItem[]
  /** 비교/관련 내부링크(다른 직업·마감 페이지로 흐름). */
  internalLinks: InternalLink[]
  /** Offer 최저가(USD). */
  priceFrom: number
}

const SEED_PROFESSIONS: ProfessionContent[] = [
  {
    slug: 'realtors',
    profession: 'Realtors',
    professionSingular: 'Realtor',
    h1: 'Premium Business Cards for Realtors',
    metaTitle: 'Business Cards for Realtors — Foil, Painted Edge & NFC | ProCardCrafters',
    metaDescription:
      'Stand out at every showing and open house. Premium real estate business cards with metallic foil, painted edges and tap-to-share NFC. Designed for realtors. From $39.',
    heroSubhead:
      'The card you hand a buyer at an open house decides whether they remember you. Make it unforgettable.',
    intro:
      "Real estate is a referral business, and your business card is the smallest, most-handled piece of marketing you own. A buyer drops it in a drawer with five others — unless yours is heavier, brighter, and impossible to lose. ProCardCrafters builds premium cards for realtors who want to look like the agent who closes, not the agent who's just starting out.",
    useCases: [
      'Open houses and showings — leave a card that outlasts the listing',
      'Just-listed and just-sold door hangers paired with a matching card',
      'Closing gifts and client folders that feel high-end',
      'NFC tap-to-share that opens your active listings or booking link instantly',
    ],
    recommendedFinishes: ['foil-stamping', 'painted-edges', 'nfc-smart', 'spot-uv'],
    faqs: [
      {
        question: 'Can you add my brokerage logo and required license number?',
        answer:
          'Yes. We place your brokerage branding, license/DRE number and any required disclosures exactly where compliance needs them, and proof every card before it prints.',
      },
      {
        question: 'What is an NFC business card and is it worth it for realtors?',
        answer:
          'An NFC card has a tiny chip — a buyer taps it to their phone and your contact details, active listings or booking page open instantly, with no app. For agents it means a lead is saved before the buyer leaves the showing.',
      },
      {
        question: 'How fast can I get them for an upcoming open house?',
        answer:
          'Standard premium orders ship in 4–6 business days. Rush options are available at checkout if you have a listing going live.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for photographers', href: '/business-cards/for/photographers' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'photographers',
    profession: 'Photographers',
    professionSingular: 'Photographer',
    h1: 'Premium Business Cards for Photographers',
    metaTitle: 'Business Cards for Photographers — Letterpress, Foil & NFC | ProCardCrafters',
    metaDescription:
      'Your business card is a sample of your craft. Premium photography business cards on textured stock with letterpress, foil and QR-to-portfolio. From $39.',
    heroSubhead:
      'Clients judge your eye before they see your gallery. Hand them a card that already proves it.',
    intro:
      "For a photographer, a business card is a tiny print — and people judge your work by the prints you choose. A thin, glossy card undersells a portfolio shot on medium format. ProCardCrafters prints on heavy textured and cotton stocks with letterpress and foil so the card in a client's hand feels like the quality they're paying for, and a QR or NFC tap takes them straight to your portfolio.",
    useCases: [
      'Weddings and events — hand guests a card that leads to their gallery',
      'Studio sessions and client welcome kits that feel premium',
      'Gallery shows, markets and print fairs',
      'QR / NFC tap straight to your portfolio or booking calendar',
    ],
    recommendedFinishes: ['letterpress', 'textured-stock', 'foil-stamping', 'nfc-smart'],
    faqs: [
      {
        question: 'Can I print a photo edge-to-edge on the card?',
        answer:
          'Yes — full-bleed photographic printing is available on our coated stocks. If you want a tactile finish, pair a photo front with a letterpress or foil logo on the back.',
      },
      {
        question: 'Which finish best shows off my photography?',
        answer:
          'Textured cotton stock with a foil or letterpress logo reads as "fine print" and pairs well with image-forward fronts. For event work, an NFC or QR card that opens the client gallery converts best.',
      },
      {
        question: 'Do you offer samples before I order a full run?',
        answer:
          'Premium finishes are best judged by touch. Sample/swatch packs help you compare stocks and finishes before committing to a full order.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for realtors', href: '/business-cards/for/realtors' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
]

// --- 콘텐츠 로더: SEED + (옵션) procardcrafters Supabase print_niche_pages 병합 ---
// RLS 상 published 행은 anon 키로 읽기 가능하므로 service role 불필요.
// sitemap.ts 의 print_products REST 패턴과 동일하게 anon REST 로 조회(빌드/요청 타임 모두 동작).

type DbNicheRow = {
  slug: string
  content: ProfessionContent | null
}

/**
 * DB(print_niche_pages)에서 발행된 직업 콘텐츠를 읽는다.
 * 테이블/환경변수 부재 또는 조회 실패 시 빈 배열로 폴백(비치명적).
 */
async function loadDbProfessions(): Promise<ProfessionContent[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const res = await fetch(
      `${url}/rest/v1/print_niche_pages?select=slug,content&is_published=eq.true`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // 하루 단위 재생성 — C2 가 추가/발행한 직업을 반영하되 매 요청 DB 부하 방지.
        next: { revalidate: 86400 },
      },
    )
    if (!res.ok) return []
    const data = (await res.json()) as DbNicheRow[]
    if (!Array.isArray(data)) return []
    return data
      .map((r) => r.content)
      .filter((c): c is ProfessionContent => Boolean(c && c.slug))
  } catch {
    return []
  }
}

/** SEED 와 DB row 를 slug 기준 병합(DB 우선). */
export async function getAllProfessions(): Promise<ProfessionContent[]> {
  const db = await loadDbProfessions()
  const bySlug = new Map<string, ProfessionContent>()
  for (const p of SEED_PROFESSIONS) bySlug.set(p.slug, p)
  for (const p of db) bySlug.set(p.slug, p) // DB 가 SEED 를 덮어씀
  return Array.from(bySlug.values())
}

export async function getProfessionBySlug(
  slug: string,
): Promise<ProfessionContent | null> {
  const all = await getAllProfessions()
  return all.find((p) => p.slug === slug) ?? null
}

/** 동기 시드 목록(빌드 타임 generateStaticParams 폴백용). */
export function getSeedSlugs(): string[] {
  return SEED_PROFESSIONS.map((p) => p.slug)
}
