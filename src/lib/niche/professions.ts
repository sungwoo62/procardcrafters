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
  {
    slug: 'dentists',
    profession: 'Dentists',
    professionSingular: 'Dentist',
    h1: 'Premium Business Cards for Dentists & Dental Practices',
    metaTitle: 'Business Cards for Dentists — Clean, Premium Stock & QR Recall | ProCardCrafters',
    metaDescription:
      'Appointment and referral cards for dental practices. Clean heavyweight stock, restrained foil and a QR that opens online booking or recall reminders. Proofed before printing. From $39.',
    heroSubhead:
      'A patient keeps your card until their next cleaning. Make it look as clean as your chair-side does.',
    intro:
      "A dental practice card lives on a fridge for six months between cleanings, doubles as an appointment reminder, and travels through referral networks to specialists. A flimsy card undercuts the clean, careful impression a practice depends on. ProCardCrafters prints dentists on bright, heavyweight stock with restrained foil and a QR that drops a patient straight into online booking or a recall reminder — so the card that survives the fridge is the one that books the next visit.",
    useCases: [
      'Appointment and recall cards that double as a six-month reminder',
      'Referral cards passed to orthodontists, oral surgeons and specialists',
      'New-patient welcome kits and front-desk handouts',
      'A printed QR that opens online booking, insurance info or a recall form',
    ],
    recommendedFinishes: ['foil-stamping', 'textured-stock', 'die-cut', 'qr-smart'],
    faqs: [
      {
        question: 'Can the card double as an appointment reminder?',
        answer:
          'Yes. We can leave a blank line or a printed field for the next appointment date and add a QR to your booking page, so one card handles both the referral and the recall.',
      },
      {
        question: 'Can you match our practice branding and add provider details?',
        answer:
          'Yes. We match your palette, place provider names, credentials and location details clearly, and proof every card before printing.',
      },
      {
        question: 'Which finish reads as clean and professional for a practice?',
        answer:
          'A bright heavyweight stock with a single restrained foil accent reads as clean and credible without looking flashy — the visual equivalent of a well-kept office.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for lawyers', href: '/business-cards/for/lawyers' },
      { label: 'Business cards for financial advisors', href: '/business-cards/for/financial-advisors' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'hair-stylists',
    profession: 'Hair Stylists',
    professionSingular: 'Hair Stylist',
    h1: 'Premium Business Cards for Hair Stylists & Salons',
    metaTitle: 'Business Cards for Hair Stylists — Foil, Die-Cut & QR Rebooking | ProCardCrafters',
    metaDescription:
      'Salon and hair stylist business cards that rebook clients. Metallic foil, custom die-cut shapes and a QR straight to your booking app. Doubles as a rebooking card. From $39.',
    heroSubhead:
      'Your card rides home in a purse and comes back as a rebooking. Make it impossible to throw away.',
    intro:
      "A stylist's business card is a rebooking tool disguised as a contact card. It goes home in a purse, gets stuck on a mirror, and decides whether a client books with you again or scrolls for someone new. A plain card from a chain printer doesn't match the look clients pay you for. ProCardCrafters prints stylists with bright foil, die-cut shapes and a QR that opens your booking app — so the next appointment is one scan away.",
    useCases: [
      'Rebooking cards handed at the chair with the next slot written in',
      'Referral cards — "bring a friend" offers clients actually keep',
      'Retail and product shelves at the front desk',
      'A printed QR straight to your booking app, Instagram or price list',
    ],
    recommendedFinishes: ['foil-stamping', 'die-cut', 'raised-gloss', 'qr-smart'],
    faqs: [
      {
        question: 'Can the card link straight to my booking app?',
        answer:
          'Yes. A printed QR opens Vagaro, Square, GlossGenius, your Instagram or any booking link in one scan — so a client can rebook before they leave the chair.',
      },
      {
        question: 'Can you die-cut the card into a custom shape?',
        answer:
          'Absolutely. Rounded, angled or logo-shaped cuts make your card stand out on a mirror or in a purse. Send your mark and we proof the cut before printing.',
      },
      {
        question: 'Which finish looks best for a salon brand?',
        answer:
          'Metallic foil with a raised-gloss accent reads as polished and on-trend, and pairs well with bold salon branding. For a softer look, foil on a textured stock works beautifully.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for makeup artists', href: '/business-cards/for/makeup-artists' },
      { label: 'Business cards for tattoo artists', href: '/business-cards/for/tattoo-artists' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'financial-advisors',
    profession: 'Financial Advisors',
    professionSingular: 'Financial Advisor',
    h1: 'Premium Business Cards for Financial Advisors',
    metaTitle: 'Business Cards for Financial Advisors — Foil, Heavy Stock & QR | ProCardCrafters',
    metaDescription:
      'Business cards for financial advisors and planners. Heavyweight stock, restrained foil and a QR to your scheduling page that signal the trust your practice runs on. From $39.',
    heroSubhead:
      'You ask clients to trust you with their money. Your card should look like it can be trusted.',
    intro:
      "A financial advisor sells trust before anything else, and the business card is the first physical proof of it. Handed across a desk or passed in a referral, a thin, generic card quietly undercuts a conversation about someone's retirement. ProCardCrafters prints advisors on heavyweight stock with restrained foil and a QR to your scheduling page — the understated, credible look of someone people trust with the big decisions.",
    useCases: [
      'Client meetings and first consultations across a desk',
      'Referrals from CPAs, attorneys and existing clients',
      'Seminars, workshops and networking events',
      'A printed QR that opens your scheduling page, vCard or firm profile',
    ],
    recommendedFinishes: ['foil-stamping', 'emboss-deboss', 'textured-stock', 'qr-smart'],
    faqs: [
      {
        question: 'Can you add my certifications and required disclosures?',
        answer:
          'Yes. We place CFP®, CFA or other credentials, firm details and any compliance disclosures where they need to go, and proof every card before printing.',
      },
      {
        question: 'Which finish looks credible without looking expensive?',
        answer:
          'Restraint reads as trust. Heavyweight stock with a single foil or embossed element — your name or firm mark — looks established and careful, never flashy.',
      },
      {
        question: 'Is a QR code appropriate for a finance professional?',
        answer:
          'Yes, used sparingly. A small QR to your scheduling page lets a prospect book a review instantly without crowding the card. Your name and firm stay the focus.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for lawyers', href: '/business-cards/for/lawyers' },
      { label: 'Business cards for consultants', href: '/business-cards/for/consultants' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'consultants',
    profession: 'Consultants',
    professionSingular: 'Consultant',
    h1: 'Premium Business Cards for Consultants',
    metaTitle: 'Business Cards for Consultants — Foil, Premium Stock & QR | ProCardCrafters',
    metaDescription:
      'Business cards for independent consultants and advisors. Heavyweight stock, clean foil and a QR to your booking or LinkedIn that make a solo practice look like a firm. From $39.',
    heroSubhead:
      'As a consultant, you are the brand. Hand over a card that bills like one.',
    intro:
      "For an independent consultant, the business card is the brand — there's no office lobby or letterhead doing the work for you. A thin, template card makes a premium day rate hard to justify. ProCardCrafters prints consultants on heavyweight stock with clean foil and a QR to your booking or LinkedIn, so a one-person practice hands over something that reads like an established firm.",
    useCases: [
      'Discovery calls and first client meetings',
      'Conferences, panels and speaking engagements',
      'Referral introductions where the card stands in for you',
      'A printed QR to your booking page, case studies or LinkedIn',
    ],
    recommendedFinishes: ['foil-stamping', 'textured-stock', 'emboss-deboss', 'qr-smart'],
    faqs: [
      {
        question: 'Can the card link to my booking page or portfolio?',
        answer:
          'Yes. A printed QR opens your Calendly, case-study page or LinkedIn in one scan — so a prospect can book a call straight from the card.',
      },
      {
        question: 'How do I make a solo practice look more established?',
        answer:
          'Weight and restraint. A heavier stock with a single foil or embossed mark signals permanence and care — the opposite of a disposable template card.',
      },
      {
        question: 'Do you proof before printing the full run?',
        answer:
          'Always. Every order is proofed for color and layout before printing, so your foil, stock and details land exactly as designed.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for financial advisors', href: '/business-cards/for/financial-advisors' },
      { label: 'Business cards for lawyers', href: '/business-cards/for/lawyers' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'interior-designers',
    profession: 'Interior Designers',
    professionSingular: 'Interior Designer',
    h1: 'Premium Business Cards for Interior Designers',
    metaTitle: 'Business Cards for Interior Designers — Textured Stock, Foil & QR | ProCardCrafters',
    metaDescription:
      'Business cards for interior designers and decorators. Textured stock, foil and embossing with a QR to your portfolio — a card that proves your taste before you open your book. From $39.',
    heroSubhead:
      'Clients hire you for your eye. Your card is the first thing they get to judge it by.',
    intro:
      "An interior designer is hired on taste, and the business card is the first object a client holds that you designed. A flat, glossy card sends the wrong signal to someone about to trust you with their home. ProCardCrafters prints designers on textured and specialty stocks with foil and embossing, and a QR to your portfolio — a card that proves your eye before you open your lookbook.",
    useCases: [
      'Client consultations and in-home visits',
      'Showrooms, trade days and design fairs',
      'Referrals from architects, realtors and contractors',
      'A printed QR straight to your portfolio or project gallery',
    ],
    recommendedFinishes: ['textured-stock', 'foil-stamping', 'emboss-deboss', 'qr-smart'],
    faqs: [
      {
        question: 'Can I match the card to my studio palette and materials?',
        answer:
          'Yes. We match your brand colors and can pair a textured stock with a foil or embossed mark to echo the materials you work in. Every card is proofed before printing.',
      },
      {
        question: 'Which stock shows the most refined taste?',
        answer:
          'A heavyweight cotton or textured stock with a single foil or embossed detail reads as considered and high-end — the tactile equivalent of a well-edited room.',
      },
      {
        question: 'Can the QR open my portfolio?',
        answer:
          'Yes. A printed QR can open your portfolio site, an Instagram grid or a specific project gallery in one scan — ideal for showing recent work on the spot.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for realtors', href: '/business-cards/for/realtors' },
      { label: 'Business cards for photographers', href: '/business-cards/for/photographers' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'personal-trainers',
    profession: 'Personal Trainers',
    professionSingular: 'Personal Trainer',
    h1: 'Premium Business Cards for Personal Trainers',
    metaTitle: 'Business Cards for Personal Trainers — Foil, Durable Stock & QR | ProCardCrafters',
    metaDescription:
      'Business cards for personal trainers and coaches. Durable foil-stamped cards with a QR to your booking or free-session offer — built to survive a gym bag and book the next client. From $39.',
    heroSubhead:
      'You sell results and energy. Hand over a card that looks like both.',
    intro:
      "A personal trainer's card gets handed out on the gym floor, tucked into a water-bottle pocket, and passed between members looking for a coach. A limp, smudged card doesn't match the energy you're selling. ProCardCrafters prints trainers on durable, bold foil stock with a QR to your booking page or a free-session offer — a card that survives the gym bag and turns a hallway conversation into a client.",
    useCases: [
      'Gym-floor introductions and free-session offers',
      'Member referrals and "bring a friend" promos',
      'Bootcamps, classes and fitness expos',
      'A printed QR to your booking page, free consult or training app',
    ],
    recommendedFinishes: ['foil-stamping', 'die-cut', 'textured-stock', 'qr-smart'],
    faqs: [
      {
        question: 'What should the QR code link to?',
        answer:
          'The highest-converting target is a free-session or consult booking page, so a prospect can claim it in one scan. Your training app or Instagram are strong second choices.',
      },
      {
        question: 'Will the cards survive a gym bag?',
        answer:
          'Yes — that’s what the heavyweight stock and optional protective coating are for. They resist bending and moisture far better than thin standard cardstock.',
      },
      {
        question: 'Can you make the card bold and high-energy?',
        answer:
          'Definitely. Bright foil on a dark stock with a die-cut shape reads as bold and athletic — the visual energy that matches what you coach.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for hair stylists', href: '/business-cards/for/hair-stylists' },
      { label: 'Business cards for makeup artists', href: '/business-cards/for/makeup-artists' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'makeup-artists',
    profession: 'Makeup Artists',
    professionSingular: 'Makeup Artist',
    h1: 'Premium Business Cards for Makeup Artists',
    metaTitle: 'Business Cards for Makeup Artists — Foil, Raised Gloss & QR | ProCardCrafters',
    metaDescription:
      'Business cards for makeup artists and MUAs. Metallic foil, raised-gloss accents and a QR straight to your portfolio and booking — a card as polished as your work. From $39.',
    heroSubhead:
      'Your work is all about finish. Your card should have one too.',
    intro:
      "A makeup artist is booked on portfolio and polish, and the business card is a tiny preview of both. A flat, generic card undersells the finish clients are paying for. ProCardCrafters prints MUAs with metallic foil, raised-gloss accents and a QR to your portfolio or booking — a card that looks as finished as the faces in your feed and turns a bridal trial or shoot into the next booking.",
    useCases: [
      'Bridal trials, weddings and events',
      'Shoots, agencies and collaboration handoffs',
      'Beauty counters, pop-ups and masterclasses',
      'A printed QR straight to your portfolio, Instagram or booking calendar',
    ],
    recommendedFinishes: ['foil-stamping', 'raised-gloss', 'die-cut', 'qr-smart'],
    faqs: [
      {
        question: 'Can the QR link to my Instagram or booking page?',
        answer:
          'Yes. A printed QR opens your Instagram, portfolio or booking calendar in one scan — perfect for sending a bride or client straight to your latest looks.',
      },
      {
        question: 'Which finish looks most polished?',
        answer:
          'Metallic foil with a raised-gloss accent reads as glossy and high-end, matching beauty branding. On a soft matte stock the contrast makes your logo pop.',
      },
      {
        question: 'Can you die-cut or shape the card?',
        answer:
          'Yes. Rounded or custom-shaped cuts make your card stand out in a kit or on a vanity. Send your logo and we proof the cut before printing.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for hair stylists', href: '/business-cards/for/hair-stylists' },
      { label: 'Business cards for photographers', href: '/business-cards/for/photographers' },
      { label: 'Explore all premium finishes', href: '/business-cards/for' },
    ],
    priceFrom: 39,
  },
  {
    slug: 'event-planners',
    profession: 'Event Planners',
    professionSingular: 'Event Planner',
    h1: 'Premium Business Cards for Event Planners',
    metaTitle: 'Business Cards for Event Planners — Foil, Textured Stock & QR | ProCardCrafters',
    metaDescription:
      'Business cards for event and wedding planners. Foil, textured stock and a QR to your portfolio — a card that proves you sweat the details before the first meeting ends. From $39.',
    heroSubhead:
      'You’re hired to make everything look flawless. Start with the card in your hand.',
    intro:
      "An event planner is hired to make every detail perfect, so a sloppy business card is a contradiction a client notices. Passed to couples, venues and vendors, the card is proof you sweat the small things. ProCardCrafters prints planners on textured stock with foil and a QR to your portfolio — a card that signals taste and precision before the first walkthrough is over.",
    useCases: [
      'Consultations with couples and corporate clients',
      'Vendor and venue referral networks',
      'Bridal shows, expos and open houses',
      'A printed QR straight to your portfolio, packages or booking page',
    ],
    recommendedFinishes: ['foil-stamping', 'textured-stock', 'raised-gloss', 'qr-smart'],
    faqs: [
      {
        question: 'Can the QR link to my portfolio or packages?',
        answer:
          'Yes. A printed QR opens your portfolio, package pricing or booking page in one scan — ideal for handing a couple everything they need at a bridal show.',
      },
      {
        question: 'Which finish signals taste and precision?',
        answer:
          'A textured stock with a foil accent reads as refined and detail-oriented — exactly the impression a planner wants to leave. A raised-gloss accent adds a subtle, modern touch.',
      },
      {
        question: 'Can you match my brand and event aesthetic?',
        answer:
          'Yes. We match your palette and pair stocks and finishes to your aesthetic, and proof every card before printing so the details are exactly right.',
      },
    ],
    internalLinks: [
      { label: 'Business cards for photographers', href: '/business-cards/for/photographers' },
      { label: 'Business cards for interior designers', href: '/business-cards/for/interior-designers' },
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
