// 스티커 니치 랜딩 시드 콘텐츠 (OMO-3217, 부모 OMO-3214 · 블로커 C1=OMO-3215).
// en-US. recommendedOptions 는 groupOptions.ts(stickers) 의 옵션 slug 를 참조 → photos 자동 생성.
// 정책: 가짜 후기 금지, 고객노출 전화번호 금지, 내부 임계값 노출 금지(OMO-2760).

import type { NicheContent } from '@/lib/niche/content'
import { buildGroupPhotos } from '@/lib/niche/groupOptions'

const GROUP = 'stickers'
const PRICE_FROM = 19

/** 제품 상세로 향하는 프리셋 딥링크(컨피규레이터가 ?niche 태깅 파싱). */
const cta = (slug: string, productSlug: string) =>
  `/products/${productSlug}?niche=${slug}`

const SEED: NicheContent[] = [
  {
    productGroup: GROUP,
    slug: 'die-cut-brand',
    title: 'Die-Cut Brand Stickers',
    titleSingular: 'Die-Cut Brand Sticker',
    h1: 'Custom Die-Cut Stickers for Your Brand',
    metaTitle: 'Die-Cut Brand Stickers — Custom Shapes, Durable Vinyl | ProCardCrafters',
    metaDescription:
      'Custom die-cut stickers cut to your exact logo shape on waterproof matte vinyl. Perfect for branding laptops, packaging and merch. Proofed before printing. From $19.',
    heroSubhead:
      'A sticker cut to your logo — no white box around it — turns every laptop and water bottle into free advertising.',
    intro:
      "A die-cut sticker is the cheapest piece of brand real estate you can buy: people stick it on the things they carry every day. Cut to the exact outline of your logo on durable vinyl, it reads as a brand mark, not a label. ProCardCrafters die-cuts your shape cleanly and laminates it so it survives laptops, bottles and the weather.",
    useCases: [
      'Laptop and water-bottle branding your customers actually want to display',
      'Packaging seals and unboxing extras that get shared online',
      'Merch tables, conferences and pop-up giveaways',
      'Reseller and partner kits that put your mark in someone else’s store',
    ],
    recommendedOptions: ['die-cut', 'vinyl-matte', 'gloss-lam', 'holographic'],
    photos: buildGroupPhotos(GROUP, ['die-cut', 'vinyl-matte', 'gloss-lam', 'holographic']),
    faqs: [
      {
        question: 'Can you cut the sticker to my exact logo shape?',
        answer:
          'Yes. Die-cutting follows the outline of your artwork so there’s no white border — just your shape. Send vector art (SVG, AI, PDF) for the cleanest cut, and we proof the cut line before printing.',
      },
      {
        question: 'Will die-cut stickers survive outdoors and in the wash?',
        answer:
          'On our matte or gloss vinyl with laminate, yes — they’re waterproof and UV-resistant, so they hold up on bottles, laptops, coolers and outdoor gear.',
      },
      {
        question: 'What’s the smallest order I can place?',
        answer:
          'We print small runs for new brands and scale up for events and merch drops. Pick your size in the designer and the price updates as you go — no need to commit to a huge batch to start.',
      },
    ],
    internalLinks: [
      { label: 'Product label stickers', href: '/stickers/for/product-label-sticker' },
      { label: 'Event giveaway stickers', href: '/stickers/for/event-giveaway' },
      { label: 'See all sticker use cases', href: '/stickers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('die-cut-brand', 'die-cut-stickers'),
  },
  {
    productGroup: GROUP,
    slug: 'product-label-sticker',
    title: 'Product Label Stickers',
    titleSingular: 'Product Label Sticker',
    h1: 'Custom Product Label Stickers',
    metaTitle: 'Product Label Stickers — Waterproof, Custom Shapes | ProCardCrafters',
    metaDescription:
      'Custom product label stickers for jars, bottles and packaging. Waterproof vinyl, clear or kiss-cut sheets, cut to any shape. Proofed before printing. From $19.',
    heroSubhead:
      'The label is the first thing a shopper touches. Make it look like the product inside is worth the price.',
    intro:
      "For a small product brand, the label does the selling. A crisp, waterproof sticker label on a jar or bottle signals quality before anyone reads the ingredients. ProCardCrafters prints labels on vinyl and clear stocks, cut to any shape and grouped on kiss-cut sheets so they’re fast to apply on a packing line.",
    useCases: [
      'Jars, bottles and tins for food, candles and cosmetics',
      'Clear labels that float your art directly on glass and packaging',
      'Kiss-cut sheets for fast, batch application',
      'Batch, scent or flavor labels that change per run',
    ],
    recommendedOptions: ['vinyl-matte', 'clear', 'kiss-cut-sheet', 'die-cut'],
    photos: buildGroupPhotos(GROUP, ['vinyl-matte', 'clear', 'kiss-cut-sheet', 'die-cut']),
    faqs: [
      {
        question: 'Are these labels waterproof for bottles and jars?',
        answer:
          'Yes. On vinyl with laminate, the labels resist water, oils and refrigeration condensation — they stay put and legible on bottles, jars and tins.',
      },
      {
        question: 'Can I get clear labels with no visible background?',
        answer:
          'Yes. Our clear/transparent stock shows only your printed art, so the label looks like it’s printed straight onto the glass or packaging. White ink is available behind solid colors so they stay opaque.',
      },
      {
        question: 'Can different labels be printed on one sheet?',
        answer:
          'Yes — kiss-cut sheets can mix sizes and designs (e.g. batch or flavor variants) so you peel and apply quickly on a packing line.',
      },
    ],
    internalLinks: [
      { label: 'Die-cut brand stickers', href: '/stickers/for/die-cut-brand' },
      { label: 'Laptop & deco stickers', href: '/stickers/for/laptop-deco' },
      { label: 'See all sticker use cases', href: '/stickers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('product-label-sticker', 'stickers'),
  },
  {
    productGroup: GROUP,
    slug: 'event-giveaway',
    title: 'Event Giveaway Stickers',
    titleSingular: 'Event Giveaway Sticker',
    h1: 'Event & Giveaway Stickers',
    metaTitle: 'Event Giveaway Stickers — Holographic & Die-Cut | ProCardCrafters',
    metaDescription:
      'Custom stickers for events, conferences and giveaways. Holographic, die-cut and glossy finishes people actually keep. Fast turnaround. Proofed before printing. From $19.',
    heroSubhead:
      'A giveaway sticker only works if people keep it. Make one shiny enough to land on a laptop, not in the bin.',
    intro:
      "Swag is only marketing if it survives the walk to the parking lot. A holographic or die-cut sticker is cheap to hand out and people genuinely want to keep it — which means your brand rides home on their laptop. ProCardCrafters prints eye-catching event stickers with fast turnaround so you’re ready before the doors open.",
    useCases: [
      'Conference and trade-show swag bags',
      'Product launches and pop-up giveaways',
      'Community events, fairs and meetups',
      'Loyalty and thank-you extras tucked into orders',
    ],
    recommendedOptions: ['holographic', 'die-cut', 'gloss-lam', 'kiss-cut-sheet'],
    photos: buildGroupPhotos(GROUP, ['holographic', 'die-cut', 'gloss-lam', 'kiss-cut-sheet']),
    faqs: [
      {
        question: 'How fast can I get stickers before my event?',
        answer:
          'Standard orders ship in 4–6 business days, and rush options are available at checkout when your event date is tight. Upload artwork early and we’ll proof it the same workflow.',
      },
      {
        question: 'What finish stands out most as a giveaway?',
        answer:
          'Holographic film gets picked up first — it shifts color in the light. Die-cut shapes and a glossy laminate also read as premium, so the sticker feels like a gift rather than a flyer.',
      },
      {
        question: 'Can I order a few different designs for one event?',
        answer:
          'Yes. Order multiple designs, or put a variety pack on kiss-cut sheets so attendees can choose a favorite — variety tends to drive more pickups.',
      },
    ],
    internalLinks: [
      { label: 'Die-cut brand stickers', href: '/stickers/for/die-cut-brand' },
      { label: 'Event promo flyers', href: '/flyers/for/event-promo' },
      { label: 'See all sticker use cases', href: '/stickers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('event-giveaway', 'holographic-stickers'),
  },
  {
    productGroup: GROUP,
    slug: 'laptop-deco',
    title: 'Laptop & Deco Stickers',
    titleSingular: 'Laptop Sticker',
    h1: 'Laptop & Decorative Stickers',
    metaTitle: 'Laptop & Deco Stickers — Durable, Die-Cut Vinyl | ProCardCrafters',
    metaDescription:
      'Custom laptop and decorative stickers on durable die-cut vinyl. Clear, holographic and matte finishes that survive daily use. Proofed before printing. From $19.',
    heroSubhead:
      'The stickers people choose to live with on their laptop and water bottle are the ones built to last.',
    intro:
      "Decorative stickers are personal — they end up on laptops, phones, journals and bottles that get handled all day. That means they have to look good and stay good. ProCardCrafters prints deco stickers on durable die-cut vinyl with clear, matte and holographic options, laminated so the edges don’t lift after a week in a backpack.",
    useCases: [
      'Laptop, tablet and phone-case decoration',
      'Water bottles, tumblers and journals',
      'Artist and illustrator sticker packs to sell',
      'Fandom, hobby and personal-brand designs',
    ],
    recommendedOptions: ['die-cut', 'holographic', 'clear', 'vinyl-matte'],
    photos: buildGroupPhotos(GROUP, ['die-cut', 'holographic', 'clear', 'vinyl-matte']),
    faqs: [
      {
        question: 'Will the stickers peel or fade on a laptop?',
        answer:
          'No — our laminated vinyl resists scratching, water and UV, so colors stay bright and the edges stay down through daily handling and cleaning.',
      },
      {
        question: 'Can I sell my own sticker pack?',
        answer:
          'Yes. Order die-cut singles or kiss-cut sheets to sell as packs. Many artists start with a small run to test designs, then reorder the ones that move.',
      },
      {
        question: 'Do you remove the white border automatically?',
        answer:
          'Die-cut and clear options remove the visible border so only your art shows. We proof the cut line and any white-ink layer before printing the full run.',
      },
    ],
    internalLinks: [
      { label: 'Event giveaway stickers', href: '/stickers/for/event-giveaway' },
      { label: 'Product label stickers', href: '/stickers/for/product-label-sticker' },
      { label: 'See all sticker use cases', href: '/stickers/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('laptop-deco', 'stickers'),
  },
]

export async function getStickerNiche(): Promise<NicheContent[]> {
  return SEED
}
