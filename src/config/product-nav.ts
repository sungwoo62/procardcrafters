// OMO-2314: Megamenu / catalog grouping config — Moo·Vistaprint 스타일 6개 상위 그룹.
// 각 그룹은 hover 시 하위 슬러그 리스트를 펼침. /products 페이지도 동일 그룹화 활용.

export interface ProductGroupItem {
  slug: string
  label: string
}

export interface ProductGroup {
  key: string
  title: string
  description: string
  items: ProductGroupItem[]
}

export const PRODUCT_GROUPS: ProductGroup[] = [
  {
    key: 'cards',
    title: 'Cards',
    description: 'Business cards & invitations',
    items: [
      { slug: 'business-cards', label: 'Business Cards' },
      { slug: 'premium-business-cards', label: 'Premium Business Cards' },
      { slug: 'premium-foil-cards', label: 'Foil Cards' },
      { slug: 'letterpress-business-cards', label: 'Letterpress Cards' },
      { slug: 'pearl-business-cards', label: 'Pearl Cards' },
      { slug: 'uv-business-cards', label: 'UV Cards' },
      { slug: 'transparent-business-cards', label: 'Transparent Cards' },
      { slug: 'metallic-business-cards', label: 'Metallic Cards' },
      { slug: 'invitation-cards', label: 'Invitations' },
      { slug: 'wedding-cards', label: 'Wedding Cards' },
      { slug: 'greeting-cards-general', label: 'Greeting Cards' },
      { slug: 'hangtag-cards', label: 'Hang Tags' },
    ],
  },
  {
    key: 'stickers',
    title: 'Stickers & Labels',
    description: 'Custom shapes & finishes',
    items: [
      { slug: 'stickers', label: 'Stickers' },
      { slug: 'die-cut-stickers', label: 'Die-Cut Stickers' },
      { slug: 'transparent-stickers', label: 'Transparent Stickers' },
      { slug: 'holographic-stickers', label: 'Holographic Stickers' },
      { slug: 'kraft-stickers', label: 'Kraft Stickers' },
      { slug: 'roll-stickers', label: 'Roll Stickers' },
      { slug: 'eco-stickers', label: 'Eco Stickers' },
      { slug: 'price-labels', label: 'Price Labels' },
      { slug: 'barcode-labels', label: 'Barcode Labels' },
      { slug: 'food-labels', label: 'Food Labels' },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing',
    description: 'Flyers, brochures, posters',
    items: [
      { slug: 'flyers', label: 'Flyers' },
      { slug: 'leaflets', label: 'Leaflets' },
      { slug: 'brochures', label: 'Brochures' },
      { slug: 'postcards', label: 'Postcards' },
      { slug: 'saddle-stitch-booklet', label: 'Saddle-Stitch Booklets' },
      { slug: 'perfect-bound-booklet', label: 'Perfect-Bound Booklets' },
      { slug: 'catalogs', label: 'Catalogs' },
      { slug: 'menus', label: 'Menus' },
    ],
  },
  {
    key: 'office',
    title: 'Office & Stationery',
    description: 'Envelopes, forms, notebooks',
    items: [
      { slug: 'standard-envelopes', label: 'Standard Envelopes' },
      { slug: 'admin-envelopes', label: 'Administrative Envelopes' },
      { slug: 'gusset-envelopes', label: 'Gusset Envelopes' },
      { slug: 'receipts', label: 'Receipts' },
      { slug: 'quotation-forms', label: 'Quotation Forms' },
      { slug: 'invoice-forms', label: 'Invoice Forms' },
      { slug: 'ncr-forms', label: 'NCR Forms' },
      { slug: 'general-notebooks', label: 'Notebooks' },
      { slug: 'diaries', label: 'Diaries' },
      { slug: 'spring-notebooks', label: 'Spring Notebooks' },
      { slug: 'memo-pads-general', label: 'Memo Pads' },
      { slug: 'sticky-notes', label: 'Sticky Notes' },
      { slug: 'wall-calendars', label: 'Wall Calendars' },
      { slug: 'desk-calendars', label: 'Desk Calendars' },
      { slug: 'mini-calendars', label: 'Mini Calendars' },
    ],
  },
  {
    key: 'signs',
    title: 'Signs & Displays',
    description: 'Banners & POP',
    items: [
      { slug: 'posters', label: 'Posters' },
      { slug: 'banners', label: 'Banners' },
      { slug: 'x-banners', label: 'X-Banners' },
      { slug: 'rollup-banners', label: 'Roll-Up Banners' },
      { slug: 'mini-banners', label: 'Mini Banners' },
      { slug: 'paper-pop', label: 'Paper POP' },
      { slug: 'foam-pop', label: 'Foam POP' },
    ],
  },
  {
    key: 'packaging',
    title: 'Packaging',
    description: 'Boxes & bags',
    items: [
      { slug: 'general-boxes', label: 'Standard Boxes' },
      { slug: 'corrugated-boxes', label: 'Corrugated Boxes' },
      { slug: 'gift-boxes', label: 'Gift Boxes' },
      { slug: 'cake-boxes', label: 'Cake Boxes' },
      { slug: 'tube-boxes', label: 'Tube Boxes' },
      { slug: 'paper-shopping-bags', label: 'Shopping Bags' },
      { slug: 'kraft-bags', label: 'Kraft Bags' },
      { slug: 'gift-bags', label: 'Gift Bags' },
    ],
  },
]

export const ALL_SLUGS: string[] = PRODUCT_GROUPS.flatMap(g => g.items.map(i => i.slug))

// Slug → 그룹 key 역인덱스 (단일 제품 상세 페이지에서 breadcrumb/관련 제품용)
export const SLUG_TO_GROUP: Record<string, string> = Object.fromEntries(
  PRODUCT_GROUPS.flatMap(g => g.items.map(i => [i.slug, g.key]))
)
