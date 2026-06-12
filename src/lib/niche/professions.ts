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
    metaTitle: 'Business Cards for Realtors — Foil, Raised Gloss & QR | ProCardCrafters',
    metaDescription:
      'Stand out at every showing and open house. Premium real estate business cards with metallic foil, raised-gloss accents, heavyweight stock and a QR that opens your listings. From $39.',
    heroSubhead:
      'The card you hand a buyer at an open house decides whether they remember you. Make it unforgettable.',
    intro:
      "Real estate is a referral business, and your business card is the smallest, most-handled piece of marketing you own. A buyer drops it in a drawer with five others — unless yours is heavier, brighter, and impossible to lose. ProCardCrafters builds premium cards for realtors who want to look like the agent who closes, not the agent who's just starting out.",
    useCases: [
      'Open houses and showings — leave a card that outlasts the listing',
      'Just-listed and just-sold door hangers paired with a matching card',
      'Closing gifts and client folders that feel high-end',
      'A printed QR that opens your active listings or booking page the second a buyer scans it',
    ],
    recommendedFinishes: ['foil-stamping', 'raised-gloss', 'textured-stock', 'qr-smart'],
    faqs: [
      {
        question: 'Can you add my brokerage logo and required license number?',
        answer:
          'Yes. We place your brokerage branding, license/DRE number and any required disclosures exactly where compliance needs them, and proof every card before it prints.',
      },
      {
        question: 'Can I put a QR code on my realtor business card?',
        answer:
          'Yes. We print a QR that opens your active listings, booking page or contact details in one scan — no app needed. For agents it means a buyer can save you before they leave the showing.',
      },
      {
        question: 'How fast can I get them for an upcoming open house?',
        answer:
          'Standard premium orders ship in 4–6 business days. Rush options are available at checkout if you have a listing going live.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for lawyers', href: '/business-cards/for/lawyers' },
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
    metaTitle: 'Business Cards for Photographers — Textured Stock, Foil & QR | ProCardCrafters',
    metaDescription:
      'Your business card is a sample of your craft. Premium photography business cards on textured cotton stock with embossing, foil and a QR straight to your portfolio. From $39.',
    heroSubhead:
      'Clients judge your eye before they see your gallery. Hand them a card that already proves it.',
    intro:
      "For a photographer, a business card is a tiny print — and people judge your work by the prints you choose. A thin, glossy card undersells a portfolio shot on medium format. ProCardCrafters prints on heavy textured and cotton stocks with embossing and foil so the card in a client's hand feels like the quality they're paying for, and a QR scan takes them straight to your portfolio.",
    useCases: [
      'Weddings and events — hand guests a card that leads to their gallery',
      'Studio sessions and client welcome kits that feel premium',
      'Gallery shows, markets and print fairs',
      'A QR scan straight to your portfolio or booking calendar',
    ],
    recommendedFinishes: ['textured-stock', 'emboss-deboss', 'foil-stamping', 'qr-smart'],
    faqs: [
      {
        question: 'Can I print a photo edge-to-edge on the card?',
        answer:
          'Yes — full-bleed photographic printing is available on our coated stocks. If you want a tactile finish, pair a photo front with an embossed or foil logo on the back.',
      },
      {
        question: 'Which finish best shows off my photography?',
        answer:
          'Textured cotton stock with a foil or embossed logo reads as "fine print" and pairs well with image-forward fronts. For event work, a QR card that opens the client gallery converts best.',
      },
      {
        question: 'Do you proof the card before printing the full run?',
        answer:
          'Yes. Every order is proofed for color and layout before it goes to print, so the textured stock, foil and QR all land exactly where you placed them — no surprises on the full run.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for tattoo artists', href: '/business-cards/for/tattoo-artists' },
      { label: 'Business cards for realtors', href: '/business-cards/for/realtors' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'lawyers',
    profession: 'Lawyers',
    professionSingular: 'Lawyer',
    h1: 'Premium Business Cards for Lawyers & Attorneys',
    metaTitle: 'Business Cards for Lawyers — Foil, Embossing & Premium Stock | ProCardCrafters',
    metaDescription:
      'Premium business cards for lawyers and attorneys. Heavyweight stock, restrained metallic foil and clean embossing that signal the credibility your practice trades on. Proofed before printing. From $39.',
    heroSubhead:
      'In law, credibility is the product. Your card should carry the same weight as your advice.',
    intro:
      "A lawyer's business card is a trust document. Handed across a conference table or passed along in a referral, it telegraphs how seriously a client should take you before you say a word. A flimsy, mass-printed card undercuts a $400-an-hour conversation. ProCardCrafters prints attorneys on heavyweight stock with restrained foil and embossing — the visual language of a practice that bills with confidence.",
    useCases: [
      'Client consultations and conference-room introductions',
      'Referrals between firms, where the card is your first impression by proxy',
      'Bar association functions, CLE conferences and networking events',
      'A printed QR that opens your booking page, vCard or practice profile in one scan',
    ],
    recommendedFinishes: ['foil-stamping', 'emboss-deboss', 'textured-stock', 'qr-smart'],
    faqs: [
      {
        question: 'Can you match my firm’s brand colors and add my bar number?',
        answer:
          'Yes. We match your firm’s palette, place your bar number and any required attorney-advertising disclosures where compliance needs them, and send a proof for your approval before anything prints.',
      },
      {
        question: 'Which finish looks most credible for a law practice?',
        answer:
          'Restraint reads as credibility. Heavyweight uncoated or cotton stock with a single foil or embossed element — your name or firm mark — looks more authoritative than a busy, glossy card. Less ornament, more weight.',
      },
      {
        question: 'Is a QR code appropriate on a professional legal card?',
        answer:
          'Used sparingly, yes. A small QR on the back that opens your booking page or vCard saves a contact instantly without crowding the front. It stays optional — your name and firm remain the focus.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for realtors', href: '/business-cards/for/realtors' },
      { label: 'Business cards for contractors', href: '/business-cards/for/contractors' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'contractors',
    profession: 'Contractors',
    professionSingular: 'Contractor',
    h1: 'Premium Business Cards for Contractors',
    metaTitle: 'Business Cards for Contractors — Heavyweight, Foil & QR | ProCardCrafters',
    metaDescription:
      'Business cards built for contractors and trades. Thick, durable stock, metallic foil and a QR that sends homeowners straight to your quote form or reviews. Proofed before printing. From $39.',
    heroSubhead:
      'A homeowner keeps one contractor’s card on the fridge. Make sure it’s yours.',
    intro:
      "On a job site or at a homeowner's door, your card competes with three others stuck under a magnet. Thin, smudged cardstock says you cut corners — exactly what a homeowner is afraid of. ProCardCrafters prints contractors on thick, rigid stock with bold foil and a scannable QR, so the card that survives the kitchen drawer is the one that calls you back for the next job.",
    useCases: [
      'Estimates and walkthroughs — leave a card a homeowner trusts enough to keep',
      'Job-site signage and door hangers paired with a matching card',
      'Supplier counters, trade desks and referral networks',
      'A printed QR that opens your quote form, Google reviews or project gallery',
    ],
    recommendedFinishes: ['textured-stock', 'foil-stamping', 'die-cut', 'qr-smart'],
    faqs: [
      {
        question: 'Can you print my license number, trades and service area?',
        answer:
          'Yes. We lay out your license number, trade certifications and service area clearly, and proof the card before printing so the details a homeowner checks are correct and easy to read.',
      },
      {
        question: 'Will the cards hold up in a truck or tool bag?',
        answer:
          'That’s what the heavyweight stock is for. Thick, rigid cards with an optional protective coating resist bending, moisture and the wear of a glovebox far better than standard thin cardstock.',
      },
      {
        question: 'What should the QR code on a contractor card link to?',
        answer:
          'The highest-converting target is your quote or estimate request form, so a homeowner can start a job in one scan. Google reviews or a gallery of finished work are strong second choices.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for lawyers', href: '/business-cards/for/lawyers' },
      { label: 'Business cards for tattoo artists', href: '/business-cards/for/tattoo-artists' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'tattoo-artists',
    profession: 'Tattoo Artists',
    professionSingular: 'Tattoo Artist',
    h1: 'Premium Business Cards for Tattoo Artists',
    metaTitle: 'Business Cards for Tattoo Artists — Foil, Die-Cut & QR | ProCardCrafters',
    metaDescription:
      'Business cards as bold as your work. Premium tattoo artist cards with metallic foil, raised gloss, custom die-cut shapes and a QR straight to your portfolio and booking. From $39.',
    heroSubhead:
      'Your card is a flash sheet in someone’s pocket. Make it worth keeping.',
    intro:
      "A tattoo client chooses an artist by their portfolio, and your business card is the smallest piece of it they get to keep. A generic card from a chain printer undersells the same hands they're trusting with permanent ink. ProCardCrafters prints tattoo artists with heavy foil, raised gloss and custom die-cut shapes, and a QR that drops a client straight into your Instagram or booking page before the consultation ends.",
    useCases: [
      'Shop counters and guest spots — a card clients actually keep',
      'Conventions and flash days where every artist hands one out',
      'Aftercare cards and client kits that match your brand',
      'A printed QR straight to your portfolio, Instagram or booking calendar',
    ],
    recommendedFinishes: ['foil-stamping', 'raised-gloss', 'die-cut', 'qr-smart'],
    faqs: [
      {
        question: 'Can you die-cut the card into a custom shape?',
        answer:
          'Yes. We cut cards to custom outlines — rounded, angled or shaped to your logo — so your card stands out in a stack of plain rectangles. Send your mark and we’ll proof the cut before printing.',
      },
      {
        question: 'Can the QR code link to my Instagram or booking page?',
        answer:
          'Absolutely. A printed QR can open your Instagram, portfolio site or booking calendar in one scan. For artists, sending clients straight to your latest work is usually what books the next appointment.',
      },
      {
        question: 'Which finish makes dark, illustrative designs pop?',
        answer:
          'Metallic foil and raised gloss on a matte black stock give dark, line-heavy artwork depth and shine without washing it out. It’s the closest a card gets to the contrast of fresh ink on skin.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for photographers', href: '/business-cards/for/photographers' },
      { label: 'Business cards for contractors', href: '/business-cards/for/contractors' },
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
