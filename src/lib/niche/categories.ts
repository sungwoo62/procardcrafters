// 제품군별 니치 랜딩 엔진 (OMO-3213).
// 직업별 명함 니치 패턴(OMO-2971, /business-cards/for/[profession])을 타 제품군
// (stickers/flyers/posters/labels …)으로 일반화한 단일 콘텐츠 소스.
//
// 한 카테고리 = 허브(/{category}/for) + 다수 스포크(/{category}/for/{entry}).
// 라우트(generateStaticParams/generateMetadata) · 템플릿 · JSON-LD · sitemap 을 본 파일이 구동한다.
//
// 콘텐츠 운영(양산): 카테고리별 `entries` 에 직접 추가(PR)하면 즉시 정적 생성.
//   (직업 니치와 동일하게, 추후 Supabase row 병합 로더를 붙일 수 있도록 구조를 맞춰 둠.)
//
// ⚠️ en-US 사이트(ProCardCrafters, US 시장). 카피·메타·FAQ 전부 영어.
// ⚠️ 정직성 게이트(OMO-2760/2972): features 블러브는 어떤 인쇄소든 보편 제공하는
//    옵션(풀컬러·다이컷 형상·라미네이션·내수성 소재 등)만 일반적 표현으로 기술한다.
//    특정 미검증 공정/소재를 단정하지 않는다.

export type FaqItem = { question: string; answer: string }
export type InternalLink = { label: string; href: string }
/** 카테고리에 맞는 인쇄 옵션/특징(명함 finishes.ts 의 일반화). */
export type NicheFeature = { name: string; blurb: string; icon: string }

export type NicheEntry = {
  /** URL slug. 예: 'brand-stickers' → /stickers/for/brand-stickers */
  slug: string
  /** 타겟/유스케이스 복수 표기. 예: 'Brand Stickers', 'Real Estate Flyers' */
  audience: string
  /** 단수 표기(문장 삽입용). */
  audienceSingular: string
  h1: string
  metaTitle: string
  metaDescription: string
  heroSubhead: string
  /** 왜 이 제품/용도에 프리미엄 인쇄가 통하는가(맥락 단락). */
  intro: string
  useCases: string[]
  /** 이 유스케이스에 추천하는 인쇄 옵션(카테고리 적합·정직). */
  features: NicheFeature[]
  faqs: FaqItem[]
  /** 비교/관련 내부링크(다른 유스케이스·카테고리로 흐름). */
  internalLinks: InternalLink[]
  /** Offer 최저가(USD). */
  priceFrom: number
}

export type NicheCategory = {
  /** 라우트 세그먼트 & URL slug. 예: 'stickers' → /stickers/for */
  slug: string
  /** 퍼널 대상 print_products 슬러그(/products/{productSlug}, /design/{productSlug}). */
  productSlug: string
  /** 제품군 표기. 예: 'Stickers' */
  label: string
  /** 단수 표기. 예: 'Sticker' */
  labelSingular: string
  /** JSON-LD Product.category. */
  schemaCategory: string
  hubMetaTitle: string
  hubMetaDescription: string
  hubH1: string
  hubSubhead: string
  /** 허브의 "추천 옵션 개요" 섹션에서 노출할 카테고리 공통 features. */
  hubFeatures: NicheFeature[]
  entries: NicheEntry[]
}

// ──────────────────────────────────────────────────────────────────────────
// 카테고리 공통 features (정직·보편 옵션) — 카테고리별로 일부 재사용.
// ──────────────────────────────────────────────────────────────────────────
const F = {
  fullColor: {
    name: 'Full-Color Printing',
    blurb: 'Sharp, vivid CMYK printing that holds fine detail and bold brand color edge to edge.',
    icon: '🎨',
  } as NicheFeature,
  dieCut: {
    name: 'Custom Die-Cut Shapes',
    blurb: 'Cut to your logo outline, a rounded rectangle or any custom shape — not just a plain square.',
    icon: '✂️',
  } as NicheFeature,
  durable: {
    name: 'Durable, Weather-Ready Material',
    blurb: 'Tear- and water-resistant stocks built to survive bottles, laptops, windows and the outdoors.',
    icon: '💧',
  } as NicheFeature,
  finishMattGloss: {
    name: 'Matte or Gloss Finish',
    blurb: 'Choose a soft matte for a premium feel or a high-gloss coat that makes color pop.',
    icon: '✨',
  } as NicheFeature,
  sizes: {
    name: 'Any Size, Any Quantity',
    blurb: 'From pocket handouts to large format — small runs for a test, big runs for a campaign.',
    icon: '📐',
  } as NicheFeature,
  heavyStock: {
    name: 'Heavyweight Stock',
    blurb: 'Thick, premium paper that feels substantial in hand and stays flat on the wall.',
    icon: '📄',
  } as NicheFeature,
  proof: {
    name: 'Proofed Before Printing',
    blurb: 'We send a proof for your approval so color and layout land exactly right on the full run.',
    icon: '✅',
  } as NicheFeature,
  doubleSided: {
    name: 'Double-Sided Printing',
    blurb: 'Put the offer on the front and the details on the back — both sides, full color.',
    icon: '🔁',
  } as NicheFeature,
  adhesive: {
    name: 'Sticks and Stays',
    blurb: 'Pressure-sensitive label stock with adhesive that holds on jars, boxes and curved surfaces.',
    icon: '🏷️',
  } as NicheFeature,
}

const SEE_ALL = (catSlug: string): InternalLink => ({
  label: 'See all options',
  href: `/${catSlug}/for`,
})

// ──────────────────────────────────────────────────────────────────────────
// 카테고리 레지스트리
// ──────────────────────────────────────────────────────────────────────────
export const NICHE_CATEGORIES: NicheCategory[] = [
  // ===================== STICKERS =====================
  {
    slug: 'stickers',
    productSlug: 'stickers',
    label: 'Stickers',
    labelSingular: 'Sticker',
    schemaCategory: 'Stickers',
    hubMetaTitle: 'Custom Stickers by Use Case — Die-Cut, Waterproof & Bulk | ProCardCrafters',
    hubMetaDescription:
      'Custom stickers built for how you actually use them — brand stickers, product and packaging labels, and event giveaways. Die-cut shapes, durable waterproof material, any quantity.',
    hubH1: 'Custom Stickers Built for the Job',
    hubSubhead: 'Die-cut shapes, durable material and vivid color — tuned to how you hand them out.',
    hubFeatures: [F.dieCut, F.durable, F.finishMattGloss, F.fullColor],
    entries: [
      {
        slug: 'brand-stickers',
        audience: 'Brand Stickers',
        audienceSingular: 'Brand Sticker',
        h1: 'Custom Brand & Logo Stickers',
        metaTitle: 'Custom Brand Stickers — Die-Cut Logo Stickers in Bulk | ProCardCrafters',
        metaDescription:
          'Turn your logo into a sticker people actually want on their laptop and water bottle. Custom die-cut brand stickers on durable, waterproof material. Any quantity, proofed before printing. From $19.',
        heroSubhead:
          'The best marketing is the kind people stick on their own laptop. Make your logo worth keeping.',
        intro:
          'A great brand sticker does what an ad never will — it travels. Slapped on a laptop, a water bottle or a notebook, your logo earns thousands of impressions for the price of a single print run. ProCardCrafters die-cuts your mark to its exact outline on durable, waterproof stock, so the sticker that ends up in someone’s hand is one they’re proud to display.',
        useCases: [
          'Laptop and water-bottle stickers people choose to keep',
          'Pack-ins and unboxing extras that turn buyers into walking ads',
          'Conference and booth giveaways that outlast the event',
          'Swag kits and welcome packs for new hires or customers',
        ],
        features: [F.dieCut, F.durable, F.finishMattGloss, F.fullColor],
        faqs: [
          {
            question: 'Can you cut the sticker to my exact logo shape?',
            answer:
              'Yes. We die-cut to your logo outline — not just a square or circle. Send vector artwork and we’ll proof the cut line before printing so the shape is exactly yours.',
          },
          {
            question: 'Will the stickers survive water bottles and dishwashers?',
            answer:
              'Our durable, water-resistant stock and laminate options hold up to bottles, laptops and the outdoors far better than paper stickers. Tell us where they’ll live and we’ll recommend the right material.',
          },
          {
            question: 'Is there a minimum order, and how fast can I get them?',
            answer:
              'We print small test runs and large campaign quantities alike. Standard orders are proofed and ship in a few business days; rush options are available at checkout.',
          },
        ],
        internalLinks: [
          { label: 'Product & packaging labels', href: '/stickers/for/product-labels' },
          { label: 'Event & giveaway stickers', href: '/stickers/for/event-stickers' },
          SEE_ALL('stickers'),
        ],
        priceFrom: 19,
      },
      {
        slug: 'product-labels',
        audience: 'Product Labels',
        audienceSingular: 'Product Label',
        h1: 'Custom Product & Packaging Labels',
        metaTitle: 'Custom Product Labels — Waterproof Packaging Stickers | ProCardCrafters',
        metaDescription:
          'Custom product and packaging labels that make a small-batch product look shelf-ready. Waterproof, oil- and smudge-resistant material, die-cut to fit your jar, bottle or pouch. From $24.',
        heroSubhead:
          'On a crowded shelf, your label is the product. Make it look like it belongs there.',
        intro:
          'For a small-batch maker, the label is where a kitchen-table product starts to look like a real brand. A crisp, durable label on a jar of jam, a candle or a bottle of cold brew signals quality before anyone reads a word. ProCardCrafters prints product labels on waterproof, smudge-resistant stock and die-cuts them to fit your container, so your packaging looks shelf-ready, not homemade.',
        useCases: [
          'Jars, bottles and tins for food, candles and cosmetics',
          'Pouches and boxes that need a clean, branded front label',
          'Batch and flavor variants printed in short, mixed runs',
          'Seal and "thank you" stickers that finish the unboxing',
        ],
        features: [F.durable, F.dieCut, F.finishMattGloss, F.proof],
        faqs: [
          {
            question: 'Will the label hold up to moisture, oils and fridge condensation?',
            answer:
              'Our waterproof, oil-resistant materials are built for jars, bottles and refrigerated products. Let us know the container and contents and we’ll match a stock that won’t smudge or peel.',
          },
          {
            question: 'Can you cut labels to fit a round jar or an odd-shaped bottle?',
            answer:
              'Yes. We die-cut to your dimensions — circles, ovals, rounded rectangles or a custom outline that wraps your container cleanly. We proof the size and cut before the full run.',
          },
          {
            question: 'Can I order several flavors or variants in one run?',
            answer:
              'Yes. We can print multiple designs in a single order so a small batch of several products stays affordable. Send your variants and we’ll lay them out together.',
          },
        ],
        internalLinks: [
          { label: 'Brand & logo stickers', href: '/stickers/for/brand-stickers' },
          { label: 'Event & giveaway stickers', href: '/stickers/for/event-stickers' },
          SEE_ALL('stickers'),
        ],
        priceFrom: 24,
      },
      {
        slug: 'event-stickers',
        audience: 'Event Stickers',
        audienceSingular: 'Event Sticker',
        h1: 'Custom Event & Giveaway Stickers',
        metaTitle: 'Event Stickers — Custom Giveaway & Promo Stickers in Bulk | ProCardCrafters',
        metaDescription:
          'Custom stickers for events, launches and giveaways. Die-cut promo stickers in bulk that attendees actually keep — durable material, vivid color, fast turnaround. From $19.',
        heroSubhead:
          'A flyer gets tossed. A great sticker goes on a laptop and travels home with your attendee.',
        intro:
          'At a booth, a launch or a market, the giveaway that survives is the one worth keeping. A pile of branded stickers costs less than printed brochures and lasts far longer — on laptops, phones and notebooks long after the event ends. ProCardCrafters prints event stickers in bulk on durable stock with bold, die-cut designs, so your handout keeps working once the booth comes down.',
        useCases: [
          'Trade-show booths and conference swag tables',
          'Product launches and pop-up events',
          'Markets, fairs and festival merch',
          'Sticker packs paired with a flyer or business card',
        ],
        features: [F.fullColor, F.dieCut, F.sizes, F.durable],
        faqs: [
          {
            question: 'Can you print large quantities affordably for an event?',
            answer:
              'Yes — bulk runs are where stickers shine. The more you print, the lower the per-piece cost, so a booth giveaway stays inexpensive even at high volume.',
          },
          {
            question: 'Can I order a sticker pack with several designs?',
            answer:
              'Absolutely. We can print a set of different designs in one order — a popular format for event packs and merch drops. Send your designs and we’ll lay them out.',
          },
          {
            question: 'How quickly can you turn an order around before an event date?',
            answer:
              'Standard orders are proofed and ship in a few business days. If you have a fixed event date, choose a rush option at checkout and we’ll prioritize the run.',
          },
        ],
        internalLinks: [
          { label: 'Brand & logo stickers', href: '/stickers/for/brand-stickers' },
          { label: 'Event flyers', href: '/flyers/for/event-flyers' },
          SEE_ALL('stickers'),
        ],
        priceFrom: 19,
      },
    ],
  },

  // ===================== FLYERS =====================
  {
    slug: 'flyers',
    productSlug: 'flyers',
    label: 'Flyers',
    labelSingular: 'Flyer',
    schemaCategory: 'Flyers',
    hubMetaTitle: 'Custom Flyers by Use Case — Events, Real Estate & Restaurants | ProCardCrafters',
    hubMetaDescription:
      'Custom flyers that get picked up and acted on — event flyers, real estate listing sheets and restaurant menus. Full-color, double-sided, heavyweight stock. Any quantity.',
    hubH1: 'Flyers That Get Picked Up',
    hubSubhead: 'Full-color, double-sided and printed on stock that doesn’t feel disposable.',
    hubFeatures: [F.fullColor, F.doubleSided, F.heavyStock, F.sizes],
    entries: [
      {
        slug: 'event-flyers',
        audience: 'Event Flyers',
        audienceSingular: 'Event Flyer',
        h1: 'Custom Event Flyers',
        metaTitle: 'Custom Event Flyers — Full-Color Promo Flyers, Any Quantity | ProCardCrafters',
        metaDescription:
          'Promote your show, sale or grand opening with full-color event flyers. Double-sided, heavyweight stock, bold color and any quantity — proofed before printing. From $29.',
        heroSubhead:
          'A flyer has one job: make someone show up. Give it color, weight and a clear call to action.',
        intro:
          'A flyer is the cheapest way to fill a room — if it actually gets read. Thin, washed-out flyers end up in the recycling before the date registers. ProCardCrafters prints event flyers in full color on heavyweight stock, double-sided so the what-and-when is impossible to miss, so the handout you paid to print is the one that drives a turnout.',
        useCases: [
          'Concerts, shows and club nights',
          'Grand openings, sales and promotions',
          'Community events, fundraisers and classes',
          'Hand-outs, mailers and counter stacks',
        ],
        features: [F.fullColor, F.doubleSided, F.sizes, F.heavyStock],
        faqs: [
          {
            question: 'Can I print both sides of the flyer?',
            answer:
              'Yes. Double-sided is standard — put the headline and date on the front and the details, map or lineup on the back, all in full color.',
          },
          {
            question: 'What sizes and quantities do you offer?',
            answer:
              'From compact handbills to full-size sheets, in quantities from a small batch to thousands for a campaign. Larger runs lower the per-flyer cost significantly.',
          },
          {
            question: 'How fast can I get flyers before my event?',
            answer:
              'Standard orders are proofed and ship in a few business days. If your date is tight, pick a rush option at checkout and we’ll move the order up.',
          },
        ],
        internalLinks: [
          { label: 'Restaurant menus & flyers', href: '/flyers/for/restaurant-flyers' },
          { label: 'Event stickers', href: '/stickers/for/event-stickers' },
          SEE_ALL('flyers'),
        ],
        priceFrom: 29,
      },
      {
        slug: 'real-estate-flyers',
        audience: 'Real Estate Flyers',
        audienceSingular: 'Real Estate Flyer',
        h1: 'Real Estate Listing Flyers',
        metaTitle: 'Real Estate Flyers — Custom Listing Sheets for Agents | ProCardCrafters',
        metaDescription:
          'Custom real estate listing flyers that make a property look its best. Full-color, heavyweight listing sheets for open houses and take-ones — proofed before printing. From $29.',
        heroSubhead:
          'At an open house, the listing sheet is what a buyer takes home. Make the home look the part.',
        intro:
          'A listing flyer is the only thing a buyer carries out of an open house, and it competes with every other home they saw that weekend. A flimsy, faded sheet undersells the property and the agent. ProCardCrafters prints real estate flyers in rich full color on heavyweight stock, so the photos pop, the details read clean, and the sheet on the kitchen counter keeps your listing — and your name — top of mind.',
        useCases: [
          'Open houses and showings — take-one listing sheets',
          'Just-listed and just-sold mailers',
          'Property feature sheets and flyer boxes out front',
          'Buyer packets and neighborhood farming drops',
        ],
        features: [F.fullColor, F.heavyStock, F.doubleSided, F.proof],
        faqs: [
          {
            question: 'Can you lay out my photos, price and agent branding?',
            answer:
              'Yes. We build the sheet around your listing photos, price, features and your brokerage branding and headshot, and proof it before printing so every detail is correct.',
          },
          {
            question: 'Which stock looks best for listing photos?',
            answer:
              'A heavyweight gloss or silk stock makes property photography look its richest, while still feeling substantial in hand. We’ll recommend the best option for your photos.',
          },
          {
            question: 'Can I order flyers per listing in small quantities?',
            answer:
              'Yes. We print per-listing runs in the quantity you need for a weekend of showings, with fast turnaround so a new listing goes live quickly.',
          },
        ],
        internalLinks: [
          { label: 'Event flyers', href: '/flyers/for/event-flyers' },
          { label: 'Business cards for realtors', href: '/business-cards/for/realtors' },
          SEE_ALL('flyers'),
        ],
        priceFrom: 29,
      },
      {
        slug: 'restaurant-flyers',
        audience: 'Restaurant Flyers & Menus',
        audienceSingular: 'Restaurant Flyer',
        h1: 'Restaurant Flyers & Takeout Menus',
        metaTitle: 'Restaurant Flyers & Menus — Custom Takeout Menu Printing | ProCardCrafters',
        metaDescription:
          'Custom restaurant flyers and takeout menus that make your food look as good as it tastes. Full-color, durable, double-sided menu printing — any quantity. From $29.',
        heroSubhead:
          'A takeout menu lives on the fridge for weeks. Make sure it’s yours people reach for.',
        intro:
          'A restaurant flyer or takeout menu is a tiny billboard that ends up on a fridge, in a delivery bag or under a door. If the food photos look dull and the menu is hard to scan, it gets tossed. ProCardCrafters prints restaurant flyers and menus in appetizing full color, double-sided on durable stock, so the menu that survives the kitchen drawer is the one that brings back the next order.',
        useCases: [
          'Takeout and delivery menus for bags and doors',
          'Grand-opening and new-menu announcements',
          'Daily specials, happy-hour and event flyers',
          'Counter stacks and local mailbox drops',
        ],
        features: [F.fullColor, F.doubleSided, F.durable, F.sizes],
        faqs: [
          {
            question: 'Can you fit my full menu on one flyer?',
            answer:
              'Yes. Double-sided printing gives you room for a full menu, prices and photos. We’ll lay it out to stay easy to scan, and proof it before printing.',
          },
          {
            question: 'Will the menu hold up in a delivery bag or on a fridge?',
            answer:
              'We print on durable stock and offer coatings that resist grease and moisture, so a menu in a takeout bag still looks good when it reaches the fridge.',
          },
          {
            question: 'Can I reprint with updated prices later?',
            answer:
              'Of course. Send your updated file and we’ll reprint the new version. Many restaurants keep a standing design and just refresh prices or specials.',
          },
        ],
        internalLinks: [
          { label: 'Event flyers', href: '/flyers/for/event-flyers' },
          { label: 'Promotional posters', href: '/posters/for/promo-posters' },
          SEE_ALL('flyers'),
        ],
        priceFrom: 29,
      },
    ],
  },

  // ===================== POSTERS =====================
  {
    slug: 'posters',
    productSlug: 'posters',
    label: 'Posters',
    labelSingular: 'Poster',
    schemaCategory: 'Posters',
    hubMetaTitle: 'Custom Posters by Use Case — Events, Promos & Art Prints | ProCardCrafters',
    hubMetaDescription:
      'Large-format custom posters that command a wall — event posters, retail promo posters and art prints. Vivid full-color printing on heavyweight stock, matte or gloss. Any size.',
    hubH1: 'Posters That Command the Wall',
    hubSubhead: 'Large-format, vivid color on heavyweight stock — matte or gloss, any size.',
    hubFeatures: [F.fullColor, F.sizes, F.heavyStock, F.finishMattGloss],
    entries: [
      {
        slug: 'event-posters',
        audience: 'Event Posters',
        audienceSingular: 'Event Poster',
        h1: 'Custom Event Posters',
        metaTitle: 'Custom Event Posters — Large-Format Show & Gig Posters | ProCardCrafters',
        metaDescription:
          'Large-format event posters that fill a room. Vivid full-color show and gig posters on heavyweight stock, matte or gloss, in the size your venue needs. From $19.',
        heroSubhead:
          'A poster is a promise of a great night. Print it big, bright and impossible to walk past.',
        intro:
          'An event poster has to stop someone mid-stride across a room or down a street. At small sizes and dull color it just blends into the wall. ProCardCrafters prints event posters large-format in vivid color on heavyweight stock, so your show, gig or screening grabs attention from across the venue and looks worth the ticket.',
        useCases: [
          'Concerts, gigs and club nights',
          'Theater, film screenings and comedy shows',
          'Window and wall posters for venues and shops',
          'Tour and series posters in matching sets',
        ],
        features: [F.fullColor, F.sizes, F.heavyStock, F.finishMattGloss],
        faqs: [
          {
            question: 'What poster sizes can you print?',
            answer:
              'From tabloid up through large-format wall sizes. Tell us where the poster is going and we’ll recommend a size that reads well at a distance.',
          },
          {
            question: 'Matte or gloss for a poster?',
            answer:
              'Gloss makes color and photography pop and suits dark, image-heavy designs; matte cuts glare under venue lighting and feels more premium. We’ll help you choose for your art.',
          },
          {
            question: 'Can you print a matched set for a tour or series?',
            answer:
              'Yes. We can print a run of date- or city-specific variants from one base design — a common format for tour and event-series posters.',
          },
        ],
        internalLinks: [
          { label: 'Retail & promo posters', href: '/posters/for/promo-posters' },
          { label: 'Event flyers', href: '/flyers/for/event-flyers' },
          SEE_ALL('posters'),
        ],
        priceFrom: 19,
      },
      {
        slug: 'promo-posters',
        audience: 'Promotional Posters',
        audienceSingular: 'Promotional Poster',
        h1: 'Retail & Promotional Posters',
        metaTitle: 'Promotional Posters — Custom Retail & Sale Posters | ProCardCrafters',
        metaDescription:
          'Custom retail and promotional posters that drive foot traffic. Bold, large-format sale and window posters on durable stock, matte or gloss — any size. From $19.',
        heroSubhead:
          'A great window poster turns a passerby into a customer. Make the offer impossible to miss.',
        intro:
          'In retail, the poster in your window is a salesperson that works around the clock. A small, muddy sign barely registers; a bold, large-format poster pulls people in off the sidewalk. ProCardCrafters prints promotional posters in punchy full color on durable stock built for windows and walls, so your sale, launch or offer does the selling before anyone walks in.',
        useCases: [
          'Window and storefront sale posters',
          'In-store promotions, launches and seasonal campaigns',
          'Price, offer and new-arrival signage',
          'Trade-show and booth backdrops',
        ],
        features: [F.fullColor, F.sizes, F.durable, F.finishMattGloss],
        faqs: [
          {
            question: 'Are these posters okay for a sunlit window?',
            answer:
              'We offer durable stocks and coatings suited to window display. For long-running outdoor or direct-sun placement, tell us and we’ll recommend the most fade- and moisture-resistant option.',
          },
          {
            question: 'Can I print a few different promo posters at once?',
            answer:
              'Yes. We can print several designs or sizes in one order — handy for a store running multiple offers or refreshing signage across locations.',
          },
          {
            question: 'How large can a promo poster be?',
            answer:
              'From counter-card sizes up to large-format window and wall posters. We’ll match the size to your space and make sure the offer reads from the sidewalk.',
          },
        ],
        internalLinks: [
          { label: 'Event posters', href: '/posters/for/event-posters' },
          { label: 'Restaurant flyers & menus', href: '/flyers/for/restaurant-flyers' },
          SEE_ALL('posters'),
        ],
        priceFrom: 19,
      },
      {
        slug: 'art-prints',
        audience: 'Art Prints & Photo Posters',
        audienceSingular: 'Art Print',
        h1: 'Art Prints & Photo Posters',
        metaTitle: 'Art Prints & Photo Posters — Gallery-Quality Poster Printing | ProCardCrafters',
        metaDescription:
          'Gallery-quality art prints and photo posters for artists and photographers. Rich full-color printing on heavyweight stock, matte or gloss, in the size you sell. From $19.',
        heroSubhead:
          'Your work deserves a print that does it justice — rich color, real weight, ready to frame.',
        intro:
          'For an artist or photographer, a print is the product, and cheap poster paper undersells the work on it. ProCardCrafters prints art and photo posters in rich, accurate color on heavyweight stock with a matte or gloss finish, so the print a buyer hangs or a fan frames looks like the gallery version — not a throwaway poster.',
        useCases: [
          'Art prints and photo posters sold online or at markets',
          'Limited editions and signed-run prints',
          'Studio, portfolio and exhibition pieces',
          'Wall art for shops, offices and cafes',
        ],
        features: [F.fullColor, F.heavyStock, F.finishMattGloss, F.sizes],
        faqs: [
          {
            question: 'How accurate is the color for my artwork?',
            answer:
              'We print on stocks chosen for color fidelity and proof before the full run, so the print matches your file. Send a color reference if you have a specific look in mind.',
          },
          {
            question: 'Which finish is best for fine-art prints?',
            answer:
              'Matte reads as fine art and reduces glare under frame glass; gloss gives photography deeper contrast and saturation. We’ll recommend based on your work.',
          },
          {
            question: 'Can I order print-on-demand small batches as I sell?',
            answer:
              'Yes. We print small batches and reprints as you sell, so you don’t have to commit to a huge run up front. Reorders use your approved file.',
          },
        ],
        internalLinks: [
          { label: 'Event posters', href: '/posters/for/event-posters' },
          { label: 'Business cards for photographers', href: '/business-cards/for/photographers' },
          SEE_ALL('posters'),
        ],
        priceFrom: 19,
      },
    ],
  },

  // ===================== LABELS =====================
  // ⚠️ US-market(en-US). KR 규제 콘텐츠(label-usecases.ts, OMO-3090)와 분리 — 이 카테고리는
  //    영문 보편 용례만 다룬다. CTA 퍼널은 활성 제품 /products/roll-stickers(롤 라벨).
  {
    slug: 'labels',
    productSlug: 'roll-stickers',
    label: 'Labels',
    labelSingular: 'Label',
    schemaCategory: 'Labels',
    hubMetaTitle: 'Custom Labels by Use Case — Product, Shipping, Waterproof & Barcode | ProCardCrafters',
    hubMetaDescription:
      'Custom labels built for the job — product and packaging labels, shipping and address labels, waterproof outdoor labels, and barcode or QR labels. Die-cut to any shape, durable material, any quantity.',
    hubH1: 'Custom Labels Built for the Job',
    hubSubhead: 'Die-cut to any shape on durable, adhesive stock — tuned to where the label has to stick.',
    hubFeatures: [F.adhesive, F.dieCut, F.durable, F.fullColor],
    entries: [
      {
        slug: 'product-packaging-labels',
        audience: 'Product & Packaging Labels',
        audienceSingular: 'Product Label',
        h1: 'Custom Product & Packaging Labels',
        metaTitle: 'Custom Product Labels — Packaging & Brand Labels in Bulk | ProCardCrafters',
        metaDescription:
          'Custom product and packaging labels that make your packaging look retail-ready. Full-color, die-cut to fit your jar, bottle or box, on durable adhesive stock. Any quantity, proofed before printing. From $24.',
        heroSubhead:
          'On the shelf, the label is the product. Make your packaging look like it belongs in a store.',
        intro:
          'A clean, well-printed label is what turns a generic container into a branded product. Whether it wraps a jar, a bottle or a box, the label carries your logo, your story and the details a buyer scans before they decide. ProCardCrafters prints product and packaging labels in full color, die-cut to fit your container, on durable adhesive stock — so what reaches the shelf looks like a real brand, not a kitchen-table experiment.',
        useCases: [
          'Jars, bottles, tins and pouches for food, drinks and cosmetics',
          'Box and carton labels for retail and ecommerce packaging',
          'Batch, flavor and variant labels in short, mixed runs',
          'Seal and "thank you" labels that finish the unboxing',
        ],
        features: [F.adhesive, F.dieCut, F.durable, F.proof],
        faqs: [
          {
            question: 'Can you cut labels to fit a round jar or an odd-shaped bottle?',
            answer:
              'Yes. We die-cut to your dimensions — circles, ovals, rounded rectangles or a custom outline that wraps your container cleanly. We proof the size and cut before the full run.',
          },
          {
            question: 'Will the label survive moisture, oils and handling?',
            answer:
              'We offer durable, water- and oil-resistant stocks suited to jars, bottles and refrigerated or handled products. Tell us the container and contents and we’ll match a material that won’t smudge or peel.',
          },
          {
            question: 'Can I print several products or variants in one order?',
            answer:
              'Yes. We can print multiple designs in a single run so a small batch of several products stays affordable. Send your variants and we’ll lay them out together.',
          },
        ],
        internalLinks: [
          { label: 'Waterproof & outdoor labels', href: '/labels/for/waterproof-labels' },
          { label: 'Barcode & QR labels', href: '/labels/for/barcode-labels' },
          { label: 'Product & packaging stickers', href: '/stickers/for/product-labels' },
          SEE_ALL('labels'),
        ],
        priceFrom: 24,
      },
      {
        slug: 'shipping-labels',
        audience: 'Shipping & Address Labels',
        audienceSingular: 'Shipping Label',
        h1: 'Custom Shipping & Address Labels',
        metaTitle: 'Shipping & Address Labels — Custom Mailing Labels in Bulk | ProCardCrafters',
        metaDescription:
          'Custom shipping and address labels for ecommerce and fulfillment. Clean, durable adhesive labels with your branding — any quantity, proofed before printing. From $19.',
        heroSubhead:
          'Every package is a touchpoint. Turn the shipping label into part of the brand, not an afterthought.',
        intro:
          'A shipping label does more than route a box — it’s often the first thing a customer sees when their order arrives. Smudged, peeling labels make a brand look careless; clean, branded ones make the package feel considered. ProCardCrafters prints shipping and address labels on durable adhesive stock that stays put and stays legible through the mail stream, so your packaging looks as professional as what’s inside.',
        useCases: [
          'Return-address and branded sender labels for ecommerce',
          'Fulfillment and warehouse labels for outbound orders',
          'Mailing and direct-mail address labels in bulk',
          'Pack-out labels that pair with your packaging and inserts',
        ],
        features: [F.adhesive, F.durable, F.sizes, F.fullColor],
        faqs: [
          {
            question: 'Can I add my logo and return address to the label?',
            answer:
              'Yes. We print your branding, return address and any fixed details in full color, and proof the layout before the run so everything reads cleanly.',
          },
          {
            question: 'Will the adhesive hold through shipping and handling?',
            answer:
              'We print on adhesive stock built to stay put on boxes, mailers and poly bags through the mail stream. Tell us your packaging surface and we’ll match the right material.',
          },
          {
            question: 'Do you print in large quantities for high-volume shipping?',
            answer:
              'Yes — bulk runs are where labels get cheapest per piece. Whether you ship dozens or thousands of orders, we can size the run to your volume.',
          },
        ],
        internalLinks: [
          { label: 'Product & packaging labels', href: '/labels/for/product-packaging-labels' },
          { label: 'Barcode & QR labels', href: '/labels/for/barcode-labels' },
          SEE_ALL('labels'),
        ],
        priceFrom: 19,
      },
      {
        slug: 'waterproof-labels',
        audience: 'Waterproof & Outdoor Labels',
        audienceSingular: 'Waterproof Label',
        h1: 'Custom Waterproof & Outdoor Labels',
        metaTitle: 'Waterproof Labels — Durable Outdoor & Weatherproof Labels | ProCardCrafters',
        metaDescription:
          'Custom waterproof and outdoor labels built to survive water, weather and handling. Durable, water-resistant adhesive stock, die-cut to any shape — any quantity. From $24.',
        heroSubhead:
          'Some labels live a hard life. Print them on stock that survives water, weather and a few hundred touches.',
        intro:
          'A paper label that bubbles in the cooler or fades in the sun makes the whole product look cheap. For anything that lives near water or outdoors — bottles, coolers, equipment, garden and bath products — the label has to be as tough as the package. ProCardCrafters prints waterproof and outdoor labels on durable, water-resistant adhesive stock, die-cut to your shape, so the label still looks sharp after the bottle’s been in the fridge or the gear’s been in the rain.',
        useCases: [
          'Bottles, tumblers and coolers that get wet or chilled',
          'Bath, garden, cleaning and outdoor-product packaging',
          'Equipment, asset and gear labels exposed to the elements',
          'Cosmetic and personal-care labels that meet water daily',
        ],
        features: [F.durable, F.adhesive, F.dieCut, F.finishMattGloss],
        faqs: [
          {
            question: 'How waterproof are these labels?',
            answer:
              'We print on water-resistant stocks with laminate options that hold up to splashes, condensation and handling far better than paper. Tell us where the label lives and we’ll recommend the most durable option.',
          },
          {
            question: 'Will they hold up outdoors and in the sun?',
            answer:
              'For outdoor and sunlit placement we offer more durable, fade- and moisture-resistant materials. Let us know the exposure and we’ll match a stock built for it.',
          },
          {
            question: 'Can you cut them to a custom shape?',
            answer:
              'Yes. We die-cut to your outline — rounded rectangles, circles or a custom shape that fits your container — and proof the cut before printing.',
          },
        ],
        internalLinks: [
          { label: 'Product & packaging labels', href: '/labels/for/product-packaging-labels' },
          { label: 'Waterproof brand stickers', href: '/stickers/for/brand-stickers' },
          SEE_ALL('labels'),
        ],
        priceFrom: 24,
      },
      {
        slug: 'barcode-labels',
        audience: 'Barcode & QR Labels',
        audienceSingular: 'Barcode Label',
        h1: 'Custom Barcode & QR Labels',
        metaTitle: 'Barcode & QR Labels — Custom Product & Inventory Labels | ProCardCrafters',
        metaDescription:
          'Custom barcode and QR code labels for retail, inventory and packaging. Crisp, scannable printing on durable adhesive stock, any size and quantity — proofed before printing. From $19.',
        heroSubhead:
          'A barcode only works if it scans every time. Print it crisp, at the right size, on stock that stays put.',
        intro:
          'Barcode and QR labels carry the data that makes retail, inventory and tracking work — and a fuzzy or undersized code that won’t scan grinds everything to a halt. ProCardCrafters prints barcode and QR labels with crisp, high-contrast detail on durable adhesive stock, sized so scanners read them first time, so your products move through checkout, warehouse and fulfillment without the re-scan.',
        useCases: [
          'Retail product and price labels with scannable barcodes',
          'Inventory, asset and warehouse bin labels',
          'QR codes linking packaging to a site, menu or registration',
          'Carton and case labels for fulfillment and tracking',
        ],
        features: [F.fullColor, F.adhesive, F.sizes, F.durable],
        faqs: [
          {
            question: 'Will the barcodes scan reliably?',
            answer:
              'We print barcodes and QR codes at high contrast and resolution, sized for dependable scanning. Send your code data or artwork and we’ll proof it at the right size before the run.',
          },
          {
            question: 'Can you print variable barcodes or sequential numbers?',
            answer:
              'Tell us what you need — if your run requires a set of distinct codes or numbers, share the data and we’ll confirm what we can lay out before you order.',
          },
          {
            question: 'What size should a barcode or QR label be?',
            answer:
              'It depends on the scanner and where it’s applied. Tell us the use and surface and we’ll recommend a size that scans reliably, then proof it before printing.',
          },
        ],
        internalLinks: [
          { label: 'Product & packaging labels', href: '/labels/for/product-packaging-labels' },
          { label: 'Shipping & address labels', href: '/labels/for/shipping-labels' },
          SEE_ALL('labels'),
        ],
        priceFrom: 19,
      },
    ],
  },
]

// ──────────────────────────────────────────────────────────────────────────
// 조회 헬퍼
// ──────────────────────────────────────────────────────────────────────────
const BY_SLUG = new Map(NICHE_CATEGORIES.map((c) => [c.slug, c]))

export function getNicheCategory(slug: string): NicheCategory | undefined {
  return BY_SLUG.get(slug)
}

export function getNicheEntry(categorySlug: string, entrySlug: string): NicheEntry | undefined {
  return getNicheCategory(categorySlug)?.entries.find((e) => e.slug === entrySlug)
}

/** 한 카테고리의 entry slug 목록(generateStaticParams 용). */
export function getCategoryEntrySlugs(categorySlug: string): string[] {
  return getNicheCategory(categorySlug)?.entries.map((e) => e.slug) ?? []
}

export function allNicheCategorySlugs(): string[] {
  return NICHE_CATEGORIES.map((c) => c.slug)
}
