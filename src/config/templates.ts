// Shared template catalog — used by the editor, template browser, and product pages.

export type TemplateCategory =
  | 'business' | 'minimal' | 'creative' | 'food' | 'health' | 'tech'
  | 'realestate' | 'sticker' | 'postcard' | 'banner' | 'luxury'
  | 'flyer' | 'brochure' | 'poster'

export interface TemplateDef {
  name: string
  category: TemplateCategory
  bg: string
  description: string
  products?: string[]
}

const BC = ['business_cards', 'premium_business_cards']
const ST = ['stickers']
const DC = ['die_cut_stickers']
const PC = ['postcards']
const BN = ['banners']
const PB = ['premium_business_cards']
const FY = ['flyers']
const BR = ['brochures']
const PO = ['posters']

export const TEMPLATE_CATALOG: TemplateDef[] = [
  // ── Business / Professional
  { name: 'Classic',            category: 'business',    bg: '#ffffff', description: 'Traditional layout',       products: BC },
  { name: 'Corporate',          category: 'business',    bg: '#0f172a', description: 'Dark professional',        products: BC },
  { name: 'Executive',          category: 'business',    bg: '#ffffff', description: 'Elegant & formal',         products: BC },
  { name: 'Law Firm',           category: 'business',    bg: '#1c2a40', description: 'Dark navy, gold serif',    products: BC },
  { name: 'Consultant',         category: 'business',    bg: '#ffffff', description: 'Clean blue accent',        products: BC },
  { name: 'Finance',            category: 'business',    bg: '#0d1b2a', description: 'Midnight, gold stripe',    products: BC },
  // ── Minimal
  { name: 'Blank',              category: 'minimal',     bg: '#ffffff', description: 'Start from scratch',       products: BC },
  { name: 'Minimal',            category: 'minimal',     bg: '#ffffff', description: 'Clean & simple',           products: BC },
  { name: 'Dark',               category: 'minimal',     bg: '#1a1a1a', description: 'Dark with accent',         products: BC },
  { name: 'Mono',               category: 'minimal',     bg: '#f5f5f5', description: 'Pure monochrome',          products: BC },
  // ── Creative
  { name: 'Bold',               category: 'creative',    bg: '#4f46e5', description: 'Vibrant accent',           products: BC },
  { name: 'Creative',           category: 'creative',    bg: '#fef3c7', description: 'Warm tone',                products: BC },
  { name: 'Photographer',       category: 'creative',    bg: '#111111', description: 'Dark portfolio',           products: BC },
  { name: 'Artist',             category: 'creative',    bg: '#ffffff', description: 'Gallery white',            products: BC },
  // ── Food & Hospitality
  { name: 'Restaurant',         category: 'food',        bg: '#7b1d1d', description: 'Warm deep red',            products: BC },
  { name: 'Cafe',               category: 'food',        bg: '#3b1f0a', description: 'Coffee & cream',           products: BC },
  { name: 'Bakery',             category: 'food',        bg: '#fdf6e3', description: 'Soft warm beige',          products: BC },
  // ── Health & Wellness
  { name: 'Medical',            category: 'health',      bg: '#f0f9ff', description: 'Clean clinical blue',      products: BC },
  { name: 'Fitness',            category: 'health',      bg: '#0f172a', description: 'Bold energy orange',       products: BC },
  { name: 'Beauty Spa',         category: 'health',      bg: '#fff1f2', description: 'Soft rose & gold',         products: BC },
  // ── Technology
  { name: 'Tech Startup',       category: 'tech',        bg: '#0f0f23', description: 'Dark gradient purple',     products: BC },
  { name: 'Developer',          category: 'tech',        bg: '#0d1117', description: 'Terminal dark',            products: BC },
  // ── Real Estate & Architecture
  { name: 'Realtor',            category: 'realestate',  bg: '#ffffff', description: 'Gold prestige',            products: BC },
  { name: 'Architect',          category: 'realestate',  bg: '#f8f8f8', description: 'Minimal grid lines',       products: BC },
  // ── Business +
  { name: 'Event Planner',      category: 'business',    bg: '#2d1b69', description: 'Deep purple & gold',       products: BC },
  { name: 'Travel Agent',       category: 'business',    bg: '#0c4a6e', description: 'Sky blue horizon',         products: BC },
  { name: 'Investment Advisor', category: 'business',    bg: '#0a1628', description: 'Navy & gold premium',      products: BC },
  { name: 'Marketing Agency',   category: 'business',    bg: '#ffffff', description: 'Bold red accent',          products: BC },
  { name: 'Language School',    category: 'business',    bg: '#fefce8', description: 'Bright & academic',        products: BC },
  { name: 'Editorial',          category: 'minimal',     bg: '#fafafa', description: 'Magazine-style serif',     products: BC },
  { name: 'Photographer Studio',category: 'creative',    bg: '#0a0a0a', description: 'Full-dark studio',         products: BC },
  { name: 'Freelance Writer',   category: 'creative',    bg: '#fffbf5', description: 'Warm editorial',           products: BC },
  { name: 'Music Teacher',      category: 'creative',    bg: '#1a0535', description: 'Deep violet music',        products: BC },
  { name: 'Interior Designer',  category: 'creative',    bg: '#f5ede0', description: 'Warm minimal terracotta',  products: BC },
  { name: 'Wellness Card',      category: 'health',      bg: '#f0fdf4', description: 'Soft green natural',       products: BC },
  { name: 'Yoga Instructor',    category: 'health',      bg: '#fdf4ff', description: 'Calm lavender',            products: BC },
  { name: 'Nutritionist',       category: 'health',      bg: '#f0fdf4', description: 'Fresh green health',       products: BC },
  { name: 'Dental Clinic',      category: 'health',      bg: '#f0f9ff', description: 'Clinical mint & white',    products: BC },
  { name: 'Pet Veterinarian',   category: 'health',      bg: '#fefce8', description: 'Friendly warm yellow',     products: BC },
  { name: 'Product Designer',   category: 'tech',        bg: '#0f172a', description: 'Dark design tool',         products: BC },
  { name: 'Startup Founder',    category: 'tech',        bg: '#020617', description: 'Pitch-dark gradient',      products: BC },
  { name: 'Software Engineer',  category: 'tech',        bg: '#111827', description: 'Code slate dark',          products: BC },
  { name: 'Real Estate v2',     category: 'realestate',  bg: '#1e293b', description: 'Dark slate prestige',      products: BC },
  { name: 'Tutor',              category: 'minimal',     bg: '#ffffff', description: 'Clean academic white',      products: BC },
  // ── Stickers (70×70mm)
  { name: 'Logo Round',         category: 'sticker',     bg: '#ffffff', description: 'Round logo sticker',       products: ST },
  { name: 'Quote Square',       category: 'sticker',     bg: '#fef9c3', description: 'Quote sticker',            products: ST },
  { name: 'Brand Badge',        category: 'sticker',     bg: '#1e293b', description: 'Brand badge sticker',      products: ST },
  { name: 'Event Promo',        category: 'sticker',     bg: '#dc2626', description: 'Event promo sticker',      products: ST },
  { name: 'Caution Label',      category: 'sticker',     bg: '#fbbf24', description: 'Caution label sticker',    products: ST },
  { name: 'Thank You',          category: 'sticker',     bg: '#fdf2f8', description: 'Thank you sticker',        products: ST },
  { name: 'Handmade',           category: 'sticker',     bg: '#fefce8', description: 'Handmade sticker',         products: ST },
  { name: 'Open Sign',          category: 'sticker',     bg: '#16a34a', description: 'Open sign sticker',        products: ST },
  { name: 'Sale Badge',         category: 'sticker',     bg: '#7c3aed', description: 'Sale badge sticker',       products: ST },
  { name: 'Minimal Label',      category: 'sticker',     bg: '#f8fafc', description: 'Minimal label sticker',    products: ST },
  // ── Die-cut stickers
  { name: 'Circle Logo',        category: 'sticker',     bg: '#ffffff', description: 'Circle die-cut logo',      products: DC },
  { name: 'Heart Love',         category: 'sticker',     bg: '#fdf2f8', description: 'Heart die-cut sticker',    products: DC },
  { name: 'Star Badge',         category: 'sticker',     bg: '#fef9c3', description: 'Star badge die-cut',       products: DC },
  { name: 'Speech Bubble',      category: 'sticker',     bg: '#eff6ff', description: 'Speech bubble sticker',    products: DC },
  { name: 'Icon Text Round',    category: 'sticker',     bg: '#f0fdf4', description: 'Icon text round sticker',  products: DC },
  { name: 'Vintage Stamp',      category: 'sticker',     bg: '#fdf6e3', description: 'Vintage stamp sticker',    products: DC },
  { name: 'Character Card',     category: 'sticker',     bg: '#faf5ff', description: 'Character card sticker',   products: DC },
  { name: 'Hexagon Label',      category: 'sticker',     bg: '#f0f9ff', description: 'Hexagon label sticker',    products: DC },
  // ── Postcards (152×102mm)
  { name: 'Greeting Card',      category: 'postcard',    bg: '#fff7ed', description: 'Warm greeting postcard',   products: PC },
  { name: 'Invitation',         category: 'postcard',    bg: '#1e1b4b', description: 'Dark invitation card',     products: PC },
  { name: 'Thank You Note',     category: 'postcard',    bg: '#fdf2f8', description: 'Thank you note card',      products: PC },
  { name: 'Business Postcard',  category: 'postcard',    bg: '#0f172a', description: 'Dark business postcard',   products: PC },
  { name: 'Event Invite',       category: 'postcard',    bg: '#7c3aed', description: 'Event invitation card',    products: PC },
  { name: 'Holiday Card',       category: 'postcard',    bg: '#14532d', description: 'Holiday greeting card',    products: PC },
  { name: 'Product Launch',     category: 'postcard',    bg: '#0c4a6e', description: 'Product launch card',      products: PC },
  { name: 'Welcome Card',       category: 'postcard',    bg: '#f0fdf4', description: 'Welcome postcard',         products: PC },
  { name: 'Farewell Card',      category: 'postcard',    bg: '#fafafa', description: 'Farewell card',            products: PC },
  { name: 'Congrats Card',      category: 'postcard',    bg: '#fefce8', description: 'Congratulations card',     products: PC },
  // ── Banners (200×300mm)
  { name: 'Banner Grand Open',  category: 'banner',      bg: '#1e40af', description: 'Blue grand opening banner',products: BN },
  { name: 'Banner Big Sale',    category: 'banner',      bg: '#dc2626', description: 'Red bold sale banner',     products: BN },
  { name: 'Banner Green Event', category: 'banner',      bg: '#065f46', description: 'Forest green event banner',products: BN },
  { name: 'Banner Purple Event',category: 'banner',      bg: '#7c3aed', description: 'Purple event banner',      products: BN },
  { name: 'Banner Welcome',     category: 'banner',      bg: '#ffffff', description: 'Clean white welcome banner',products: BN },
  { name: 'Banner Premium',     category: 'banner',      bg: '#0f172a', description: 'Dark gold premium banner', products: BN },
  { name: 'Banner Seasonal',    category: 'banner',      bg: '#fef3c7', description: 'Warm seasonal banner',     products: BN },
  { name: 'Banner Season Sale', category: 'banner',      bg: '#831843', description: 'Deep pink season sale',    products: BN },
  // ── Premium Business Cards (luxury)
  { name: 'Luxe Black',         category: 'luxury',      bg: '#0a0a0a', description: 'Luxe black finish',        products: PB },
  { name: 'Gold Stamp',         category: 'luxury',      bg: '#1a1203', description: 'Gold stamp luxury card',   products: PB },
  { name: 'Marble Edge',        category: 'luxury',      bg: '#f8f8f8', description: 'Marble edge luxury card',  products: PB },
  { name: 'Embossed Logo',      category: 'luxury',      bg: '#1c1c2e', description: 'Embossed logo luxury',     products: PB },
  { name: 'Letterpress Style',  category: 'luxury',      bg: '#fdf8f0', description: 'Letterpress style luxury', products: PB },
  { name: 'Platinum Card',      category: 'luxury',      bg: '#e8e8e8', description: 'Platinum card luxury',     products: PB },
  { name: 'Rose Gold Foil',     category: 'luxury',      bg: '#2d1515', description: 'Rose gold foil luxury',    products: PB },
  { name: 'Minimal Noir',       category: 'luxury',      bg: '#f5f5f0', description: 'Minimal noir luxury',      products: PB },
  // ── Flyers (148×210mm A5)
  { name: 'Flyer Open Event',   category: 'flyer',       bg: '#ff6b00', description: 'Grand opening flyer',      products: FY },
  { name: 'Flyer Season Sale',  category: 'flyer',       bg: '#1d4ed8', description: 'Season sale flyer',        products: FY },
  { name: 'Flyer Restaurant',   category: 'flyer',       bg: '#7b1d1d', description: 'Restaurant flyer',         products: FY },
  { name: 'Flyer Academy',      category: 'flyer',       bg: '#1e3a5f', description: 'Academy flyer',            products: FY },
  { name: 'Flyer Seminar',      category: 'flyer',       bg: '#ffffff', description: 'Seminar flyer',            products: FY },
  { name: 'Flyer Cafe',         category: 'flyer',       bg: '#3b1f0a', description: 'Cafe flyer',               products: FY },
  { name: 'Flyer Health',       category: 'flyer',       bg: '#0f172a', description: 'Health & wellness flyer',  products: FY },
  { name: 'Flyer Beauty',       category: 'flyer',       bg: '#fdf2f8', description: 'Beauty flyer',             products: FY },
  { name: 'Flyer Real Estate',  category: 'flyer',       bg: '#0a1628', description: 'Real estate flyer',        products: FY },
  { name: 'Flyer Concert',      category: 'flyer',       bg: '#0d0d0d', description: 'Concert flyer',            products: FY },
  { name: 'Flyer Promo',        category: 'flyer',       bg: '#dc2626', description: 'Promo flyer',              products: FY },
  { name: 'Flyer Festival',     category: 'flyer',       bg: '#7c3aed', description: 'Festival flyer',           products: FY },
  // ── Brochures (148×210mm A5)
  { name: 'Brochure Company',   category: 'brochure',    bg: '#0f172a', description: 'Company profile brochure', products: BR },
  { name: 'Brochure Service',   category: 'brochure',    bg: '#f0fdfa', description: 'Service brochure',         products: BR },
  { name: 'Brochure Catalog',   category: 'brochure',    bg: '#1e293b', description: 'Product catalog brochure', products: BR },
  { name: 'Brochure Medical',   category: 'brochure',    bg: '#f0f9ff', description: 'Medical brochure',         products: BR },
  { name: 'Brochure Education', category: 'brochure',    bg: '#4c1d95', description: 'Education brochure',       products: BR },
  { name: 'Brochure Travel',    category: 'brochure',    bg: '#0c4a6e', description: 'Travel brochure',          products: BR },
  { name: 'Brochure Realty',    category: 'brochure',    bg: '#fdf6e3', description: 'Real estate brochure',     products: BR },
  { name: 'Brochure Dining',    category: 'brochure',    bg: '#3b0a0a', description: 'Dining & restaurant brochure', products: BR },
  { name: 'Brochure IT',        category: 'brochure',    bg: '#0f0f23', description: 'IT company brochure',      products: BR },
  { name: 'Brochure Legal',     category: 'brochure',    bg: '#1c2a40', description: 'Legal firm brochure',      products: BR },
  // ── Posters (210×297mm A4)
  { name: 'Poster Concert',     category: 'poster',      bg: '#0d0d0d', description: 'Concert event poster',     products: PO },
  { name: 'Poster Exhibition',  category: 'poster',      bg: '#fafafa', description: 'Art exhibition poster',    products: PO },
  { name: 'Poster Movie',       category: 'poster',      bg: '#1a0a2e', description: 'Movie promotion poster',   products: PO },
  { name: 'Poster Conference',  category: 'poster',      bg: '#1d4ed8', description: 'Conference poster',        products: PO },
  { name: 'Poster Awards',      category: 'poster',      bg: '#0a0a0a', description: 'Awards ceremony poster',   products: PO },
  { name: 'Poster Academy',     category: 'poster',      bg: '#2d1b69', description: 'Academy poster',           products: PO },
  { name: 'Poster Marathon',    category: 'poster',      bg: '#fff7ed', description: 'Marathon event poster',    products: PO },
  { name: 'Poster Musical',     category: 'poster',      bg: '#3b0764', description: 'Musical performance poster', products: PO },
  { name: 'Poster Art Fair',    category: 'poster',      bg: '#ffffff', description: 'Art fair poster',          products: PO },
  { name: 'Poster Graduation',  category: 'poster',      bg: '#f8f0fb', description: 'Graduation ceremony poster', products: PO },
  { name: 'Poster Contest',     category: 'poster',      bg: '#fefce8', description: 'Contest announcement poster', products: PO },
  { name: 'Poster Recruitment', category: 'poster',      bg: '#0f172a', description: 'Job recruitment poster',   products: PO },
]

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory | 'all', string> = {
  all:        'All',
  business:   'Business',
  minimal:    'Minimal',
  creative:   'Creative',
  food:       'Food',
  health:     'Health',
  tech:       'Tech',
  realestate: 'Real Estate',
  sticker:    'Sticker',
  postcard:   'Postcard',
  banner:     'Banner',
  luxury:     'Luxury',
  flyer:      'Flyer',
  brochure:   'Brochure',
  poster:     'Poster',
}

// Map product category → template product tags used in TEMPLATE_CATALOG
export const CATEGORY_TO_PRODUCT_TAG: Record<string, string[]> = {
  business_cards:           ['business_cards'],
  premium_business_cards:   ['business_cards', 'premium_business_cards'],
  stickers:                 ['stickers'],
  die_cut_stickers:         ['die_cut_stickers'],
  flyers:                   ['flyers'],
  brochures:                ['brochures'],
  postcards:                ['postcards'],
  posters:                  ['posters'],
  banners:                  ['banners'],
}

export function getTemplatesForProduct(productCategory: string): TemplateDef[] {
  const tags = CATEGORY_TO_PRODUCT_TAG[productCategory] ?? ['business_cards']
  return TEMPLATE_CATALOG.filter(t => !t.products || t.products.some(p => tags.includes(p)))
}
