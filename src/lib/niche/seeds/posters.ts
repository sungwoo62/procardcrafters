// 포스터(posters) 니치 랜딩 시드 콘텐츠 (OMO-3217, 부모 OMO-3214 · 블로커 C1=OMO-3215).
// en-US. recommendedOptions 는 groupOptions.ts(posters) 옵션 slug 참조 → photos 자동 생성.
// 정책: 가짜 후기 금지, 고객노출 전화번호 금지, 내부 임계값 노출 금지(OMO-2760).

import type { NicheContent } from '@/lib/niche/content'
import { buildGroupPhotos } from '@/lib/niche/groupOptions'

const GROUP = 'posters'
const PRICE_FROM = 25
const PRODUCT = 'posters'

const cta = (slug: string) => `/products/${PRODUCT}?niche=${slug}`

const SEED: NicheContent[] = [
  {
    productGroup: GROUP,
    slug: 'event-poster',
    title: 'Event Posters',
    titleSingular: 'Event Poster',
    h1: 'Event Posters That Command the Room',
    metaTitle: 'Event Posters — Large Format, Vivid Color | ProCardCrafters',
    metaDescription:
      'Custom event posters in large format with gloss or matte finishes. Concerts, shows and launches printed big, bold and readable from across the room. Proofed before printing. From $25.',
    heroSubhead:
      'A poster works from across the street or it doesn’t work at all. Print one people can read before they’re close enough to ignore it.',
    intro:
      "An event poster is a billboard on a budget — it has to land the headline, the date and the vibe from a distance. That means big format, high contrast and color that doesn’t wash out under venue lights. ProCardCrafters prints event posters in large format with gloss or matte finishes so your lineup reads clearly whether it’s on a wall, a window or an easel.",
    useCases: [
      'Concerts, festivals and live shows',
      'Theater, comedy and performance runs',
      'Product launches and brand activations',
      'Window, wall and easel displays at the venue',
    ],
    recommendedOptions: ['large-format', 'gloss-photo', 'matte-fine-art', 'foamboard'],
    photos: buildGroupPhotos(GROUP, ['large-format', 'gloss-photo', 'matte-fine-art', 'foamboard']),
    faqs: [
      {
        question: 'What size should an event poster be?',
        answer:
          'For walls and windows, A1 or A0 reads well from across a room; A2 suits tighter spaces and easels. Pick the size in the designer and we’ll flag if your artwork resolution needs to be higher for a clean large print.',
      },
      {
        question: 'Gloss or matte for an event poster?',
        answer:
          'Gloss makes photo-led posters pop and saturate; matte cuts glare under bright venue lighting and reads as more upscale. Both print vivid color at large sizes.',
      },
      {
        question: 'Can you mount the poster for an easel?',
        answer:
          'Yes. Foamboard mounting makes the poster rigid so it stands on an easel or hangs flat without curling — handy for entrances and check-in tables.',
      },
    ],
    internalLinks: [
      { label: 'Retail promo posters', href: '/posters/for/retail-promo-poster' },
      { label: 'Event promo flyers', href: '/flyers/for/event-promo' },
      { label: 'See all poster use cases', href: '/posters/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('event-poster'),
  },
  {
    productGroup: GROUP,
    slug: 'retail-promo-poster',
    title: 'Retail Promo Posters',
    titleSingular: 'Retail Promo Poster',
    h1: 'Retail Promo & Sale Posters',
    metaTitle: 'Retail Promo Posters — Sale & Window Displays | ProCardCrafters',
    metaDescription:
      'Custom retail and sale posters for windows and in-store displays. Bold gloss color, satin finishes and large formats that move stock. Proofed before printing. From $25.',
    heroSubhead:
      'A sale poster has one job: stop foot traffic and move the stock behind it. Print one that earns its spot in the window.',
    intro:
      "Retail promo posters are conversion tools — they turn passersby into walk-ins and clear seasonal stock. The number and the offer have to read instantly from the sidewalk, so color and size do the heavy lifting. ProCardCrafters prints sale and window posters with bold gloss or satin finishes in large formats sized for storefronts and aisles.",
    useCases: [
      'Window and storefront sale displays',
      'In-store aisle and endcap promos',
      'Seasonal and clearance campaigns',
      'New-arrival and featured-product callouts',
    ],
    recommendedOptions: ['gloss-photo', 'large-format', 'satin', 'foamboard'],
    photos: buildGroupPhotos(GROUP, ['gloss-photo', 'large-format', 'satin', 'foamboard']),
    faqs: [
      {
        question: 'What finish is best for a window-facing poster?',
        answer:
          'Gloss gives the strongest color punch for a window, while satin reduces glare if the poster faces direct sun or bright store lighting. Both hold saturated promo color at large sizes.',
      },
      {
        question: 'Can I reuse a poster across multiple sale periods?',
        answer:
          'For repeat use, foamboard-mounted posters are sturdier and stand on easels. For dated sales, a flat large-format print is more economical to refresh each campaign.',
      },
      {
        question: 'How big should a sale poster be to read from the street?',
        answer:
          'A1 or A0 reads clearly from the sidewalk; the price and offer should be the largest elements. We proof the layout so the key numbers dominate before printing.',
      },
    ],
    internalLinks: [
      { label: 'Event posters', href: '/posters/for/event-poster' },
      { label: 'Grand-opening flyers', href: '/flyers/for/grand-opening' },
      { label: 'See all poster use cases', href: '/posters/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('retail-promo-poster'),
  },
  {
    productGroup: GROUP,
    slug: 'a1-exhibition',
    title: 'A1 Exhibition Posters',
    titleSingular: 'Exhibition Poster',
    h1: 'A1 Exhibition & Conference Posters',
    metaTitle: 'A1 Exhibition Posters — Academic & Conference | ProCardCrafters',
    metaDescription:
      'Custom A1 exhibition and academic conference posters on matte fine-art stock. Glare-free, color-accurate large-format printing. Proofed before printing. From $25.',
    heroSubhead:
      'A research or trade poster is read up close under harsh lights. Print one that stays legible and glare-free at A1.',
    intro:
      "Exhibition and conference posters are read at arm’s length under fluorescent hall lighting — the opposite of an event poster across a room. Here, glare-free stock and accurate color matter more than shine, so charts, photos and dense text stay readable. ProCardCrafters prints A1 exhibition posters on matte fine-art stock tuned for academic and trade-show halls.",
    useCases: [
      'Academic and research conference poster sessions',
      'Trade-show and expo booth displays',
      'Corporate town halls and internal showcases',
      'Gallery, studio and portfolio walls',
    ],
    recommendedOptions: ['matte-fine-art', 'large-format', 'satin', 'foamboard'],
    photos: buildGroupPhotos(GROUP, ['matte-fine-art', 'large-format', 'satin', 'foamboard']),
    faqs: [
      {
        question: 'Is A1 the right size for a conference poster?',
        answer:
          'A1 is the most common poster-session size and reads well at arm’s length. Check your conference’s spec sheet — we also print A0 and custom sizes if they require something larger.',
      },
      {
        question: 'Why matte instead of gloss for an exhibition poster?',
        answer:
          'Matte fine-art stock kills glare under hall lighting, so dense text, charts and figures stay readable from any angle. Gloss can mirror overhead lights and wash out detail up close.',
      },
      {
        question: 'Can it be mounted or is it ready to pin?',
        answer:
          'Flat prints are ready to pin or tack to a board; foamboard mounting gives you a rigid, reusable poster that stands on an easel for booths and showcases.',
      },
    ],
    internalLinks: [
      { label: 'Event posters', href: '/posters/for/event-poster' },
      { label: 'Movie-style posters', href: '/posters/for/movie-style' },
      { label: 'See all poster use cases', href: '/posters/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('a1-exhibition'),
  },
  {
    productGroup: GROUP,
    slug: 'movie-style',
    title: 'Movie-Style Posters',
    titleSingular: 'Movie-Style Poster',
    h1: 'Movie-Style & Theatrical Posters',
    metaTitle: 'Movie-Style Posters — Cinematic Gloss Prints | ProCardCrafters',
    metaDescription:
      'Custom movie-style posters with cinematic gloss color and deep blacks. Film, theater, gaming and personal projects printed large. Proofed before printing. From $25.',
    heroSubhead:
      'A movie-style poster lives on the contrast between deep blacks and a hero image. Print one with the punch of a cinema lobby.',
    intro:
      "A movie-style poster is all mood — deep blacks, a striking hero image and a title that feels theatrical. That look needs a finish with real contrast and color depth, which a thin matte print can’t deliver. ProCardCrafters prints cinematic posters on gloss photo stock so the key art reads like a lobby one-sheet, whether it’s for a film, a play, a game or a personal project.",
    useCases: [
      'Independent film and short-film promotion',
      'Theater, musical and performance runs',
      'Game launches and streamer/creator art',
      'Personal projects, gifts and collector prints',
    ],
    recommendedOptions: ['gloss-photo', 'large-format', 'matte-fine-art', 'foamboard'],
    photos: buildGroupPhotos(GROUP, ['gloss-photo', 'large-format', 'matte-fine-art', 'foamboard']),
    faqs: [
      {
        question: 'What gives a poster that cinematic look?',
        answer:
          'Gloss photo stock delivers the deep blacks and saturated color that make key art feel theatrical. Strong contrast in your artwork plus a large format completes the lobby-poster effect.',
      },
      {
        question: 'What size are classic movie posters?',
        answer:
          'The classic one-sheet is roughly 27×40 in; we print to standard large formats and can match common one-sheet proportions. Send high-resolution art so it stays crisp at size.',
      },
      {
        question: 'Can I order a single poster as a gift or collector print?',
        answer:
          'Yes — there’s no need to order in bulk. Print one as a gift or collector piece; foamboard mounting makes it display-ready out of the tube.',
      },
    ],
    internalLinks: [
      { label: 'Event posters', href: '/posters/for/event-poster' },
      { label: 'A1 exhibition posters', href: '/posters/for/a1-exhibition' },
      { label: 'See all poster use cases', href: '/posters/for' },
    ],
    priceFrom: PRICE_FROM,
    ctaPresetHref: cta('movie-style'),
  },
]

export async function getPosterNiche(): Promise<NicheContent[]> {
  return SEED
}
