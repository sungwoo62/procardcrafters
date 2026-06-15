// 전단(flyers) 니치 랜딩 시드 콘텐츠 (OMO-3217, 부모 OMO-3214 · 블로커 C1=OMO-3215).
// en-US. recommendedOptions 는 groupOptions.ts(flyers) 옵션 slug 참조 → photos 자동 생성.
// 정책: 가짜 후기 금지, 고객노출 전화번호 금지, 내부 임계값 노출 금지(OMO-2760).

import type { NicheContent } from '@/lib/niche/content'
import { buildGroupPhotos } from '@/lib/niche/groupOptions'

const GROUP = 'flyers'
const PRICE_FROM = 29
const PRODUCT = 'flyers'

const cta = (slug: string) => `/products/${PRODUCT}?niche=${slug}`

const SEED: NicheContent[] = [
  {
    productGroup: GROUP,
    slug: 'real-estate-flyer',
    title: 'Real Estate Flyers',
    titleSingular: 'Real Estate Flyer',
    h1: 'Real Estate Flyers That Sell the Listing',
    metaTitle: 'Real Estate Flyers — Premium Stock, Fast Turnaround | ProCardCrafters',
    metaDescription:
      'Custom real estate flyers on heavyweight stock with gloss or silk finishes. Just-listed, open-house and property sheets that look as premium as the home. Proofed before printing. From $29.',
    heroSubhead:
      'A buyer keeps the flyer that feels like the home. Print the listing on stock that signals value.',
    intro:
      "In real estate, the flyer is the listing’s handshake — left on the counter at an open house or mailed to a farm area. A thin, home-printed sheet undersells a property; a heavyweight flyer with a gloss finish makes the home look move-in ready. ProCardCrafters prints agent flyers on premium stock with finishes that survive a buyer’s tote bag.",
    useCases: [
      'Just-listed and open-house property sheets',
      'Farm-area mailers and door drops',
      'Price-reduced and just-sold announcements',
      'Buyer leave-behinds with QR to the full listing',
    ],
    recommendedOptions: ['premium-stock', 'gloss-uv', 'silk-matte', 'folded'],
    photos: buildGroupPhotos(GROUP, ['premium-stock', 'gloss-uv', 'silk-matte', 'folded']),
    faqs: [
      {
        question: 'Can you match my brokerage branding and disclosures?',
        answer:
          'Yes. We place your brokerage logo, license number and any required disclosures where compliance needs them, and proof every flyer before it prints.',
      },
      {
        question: 'Which stock looks most premium for a listing?',
        answer:
          'A heavyweight gloss flyer makes property photos pop, while silk matte reads more upscale and is easier to write on. For multi-photo listings, a folded format gives you more room.',
      },
      {
        question: 'How fast can I get flyers for a weekend open house?',
        answer:
          'Standard orders ship in 4–6 business days, with rush options at checkout if your listing just went live.',
      },
    ],
    internalLinks: [
      { label: 'Grand-opening flyers', href: '/flyers/for/grand-opening' },
      { label: 'Event promo flyers', href: '/flyers/for/event-promo' },
      { label: 'See all flyer use cases', href: '/flyers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('real-estate-flyer'),
  },
  {
    productGroup: GROUP,
    slug: 'restaurant-menu-flyer',
    title: 'Restaurant Menu Flyers',
    titleSingular: 'Menu Flyer',
    h1: 'Restaurant Menu Flyers & Takeout Menus',
    metaTitle: 'Restaurant Menu Flyers — Gloss, Folded, Durable | ProCardCrafters',
    metaDescription:
      'Custom menu flyers and takeout menus on durable stock with gloss or silk finishes. Folded layouts, spill-resistant coatings and appetite-ready color. Proofed before printing. From $29.',
    heroSubhead:
      'A menu people can read and want to order from — printed to survive the counter, the table and the delivery bag.',
    intro:
      "A menu flyer has one job: make the food look worth ordering and stay readable while it does. Gloss coatings make food photography pop; silk matte keeps dense menus easy on the eyes; folded formats fit a full menu in a takeout bag. ProCardCrafters prints menus on durable, coated stock so grease and spills don’t end the flyer’s shift early.",
    useCases: [
      'Takeout and delivery menus tucked into bags',
      'Dine-in table and counter menus',
      'New-menu and seasonal-special announcements',
      'Door drops for a new location’s opening radius',
    ],
    recommendedOptions: ['gloss-uv', 'folded', 'silk-matte', 'premium-stock'],
    photos: buildGroupPhotos(GROUP, ['gloss-uv', 'folded', 'silk-matte', 'premium-stock']),
    faqs: [
      {
        question: 'Will the menu hold up to grease and spills?',
        answer:
          'Yes. A gloss or silk coating resists grease and moisture far better than uncoated paper, so menus stay legible on the table and in delivery bags.',
      },
      {
        question: 'Can you do a folded menu?',
        answer:
          'Yes — bi-fold and tri-fold layouts turn a single sheet into a full menu with sections, which works well for takeout and dine-in alike.',
      },
      {
        question: 'Which finish makes food photos look best?',
        answer:
          'High-gloss UV gives food photography the most pop and saturation. If your menu is text-heavy, silk matte keeps it readable while still feeling premium.',
      },
    ],
    internalLinks: [
      { label: 'Grand-opening flyers', href: '/flyers/for/grand-opening' },
      { label: 'Retail promo posters', href: '/posters/for/retail-promo-poster' },
      { label: 'See all flyer use cases', href: '/flyers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('restaurant-menu-flyer'),
  },
  {
    productGroup: GROUP,
    slug: 'event-promo',
    title: 'Event Promo Flyers',
    titleSingular: 'Event Promo Flyer',
    h1: 'Event Promo Flyers That Fill the Room',
    metaTitle: 'Event Promo Flyers — Bold Color, Fast Turnaround | ProCardCrafters',
    metaDescription:
      'Custom event flyers for shows, launches and pop-ups. Bold gloss color, spot-UV accents and premium stock with fast turnaround. Proofed before printing. From $29.',
    heroSubhead:
      'A flyer competes with a wall of other flyers. Print one with the color and finish to win the glance.',
    intro:
      "Event promotion lives and dies on the glance. On a community board or a café counter, your flyer has a half-second to stop someone — so color, contrast and finish matter as much as the lineup. ProCardCrafters prints event flyers with gloss color and optional spot-UV accents so the headline and date land before the eye moves on.",
    useCases: [
      'Concerts, club nights and live shows',
      'Product launches and pop-up shops',
      'Markets, festivals and community events',
      'Class, workshop and class-pass promotions',
    ],
    recommendedOptions: ['gloss-uv', 'spot-uv', 'premium-stock', 'silk-matte'],
    photos: buildGroupPhotos(GROUP, ['gloss-uv', 'spot-uv', 'premium-stock', 'silk-matte']),
    faqs: [
      {
        question: 'What makes an event flyer stand out on a crowded board?',
        answer:
          'Strong contrast, a readable date and headline, and a finish that catches light. Gloss color and a spot-UV accent on the title pull the eye to the key details first.',
      },
      {
        question: 'Can I add a QR code to sell tickets?',
        answer:
          'Yes. We print a QR that opens your ticketing or RSVP page in one scan — no app required — so interested people can act before they walk away.',
      },
      {
        question: 'How quickly can these be printed?',
        answer:
          'Standard orders ship in 4–6 business days, with rush options at checkout when a date is approaching. Upload artwork early so we can proof it in time.',
      },
    ],
    internalLinks: [
      { label: 'Event giveaway stickers', href: '/stickers/for/event-giveaway' },
      { label: 'Event posters', href: '/posters/for/event-poster' },
      { label: 'See all flyer use cases', href: '/flyers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('event-promo'),
  },
  {
    productGroup: GROUP,
    slug: 'grand-opening',
    title: 'Grand Opening Flyers',
    titleSingular: 'Grand Opening Flyer',
    h1: 'Grand Opening Flyers & Announcements',
    metaTitle: 'Grand Opening Flyers — Premium Stock, Bold Finish | ProCardCrafters',
    metaDescription:
      'Custom grand-opening flyers for new stores, restaurants and services. Premium stock, gloss color and door-drop formats that pull in the neighborhood. Proofed before printing. From $29.',
    heroSubhead:
      'A new business gets one first impression on the block. Make the announcement look like the place is already a hit.',
    intro:
      "A grand opening is a one-time event, and the flyer is how the neighborhood finds out. A premium, confident flyer dropped on local doors says the business is here to stay — not a soft launch hoping for foot traffic. ProCardCrafters prints opening flyers on premium stock with bold finishes and clear offer space so the first wave of customers shows up.",
    useCases: [
      'Door drops and mailers in the opening radius',
      'Counter and window flyers at nearby businesses',
      'Opening-week offer and coupon sheets',
      'Ribbon-cutting and launch-event invites',
    ],
    recommendedOptions: ['premium-stock', 'gloss-uv', 'spot-uv', 'recycled'],
    photos: buildGroupPhotos(GROUP, ['premium-stock', 'gloss-uv', 'spot-uv', 'recycled']),
    faqs: [
      {
        question: 'Can I include an opening offer or coupon on the flyer?',
        answer:
          'Yes. We lay out the offer, dates and any fine print clearly, and proof the flyer before printing so the deal reads at a glance.',
      },
      {
        question: 'Is there an eco-friendly stock for door drops?',
        answer:
          'Yes. Recycled uncoated stock has a natural, tactile feel many local brands prefer, while still printing your color and offer clearly.',
      },
      {
        question: 'How many should I print for a neighborhood drop?',
        answer:
          'Pick your run size in the designer and the price updates as you go — many new businesses start with their core blocks and reorder once they see the response.',
      },
    ],
    internalLinks: [
      { label: 'Real estate flyers', href: '/flyers/for/real-estate-flyer' },
      { label: 'Retail promo posters', href: '/posters/for/retail-promo-poster' },
      { label: 'See all flyer use cases', href: '/flyers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('grand-opening'),
  },
]

export async function getFlyerNiche(): Promise<NicheContent[]> {
  return SEED
}
