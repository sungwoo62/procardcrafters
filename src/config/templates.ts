// Shared template catalog — used by the editor, template browser, and product pages.

export type TemplateCategory =
  | 'business' | 'minimal' | 'creative' | 'food' | 'health' | 'tech'
  | 'realestate' | 'sticker' | 'postcard' | 'banner' | 'luxury'
  | 'flyer' | 'brochure' | 'poster'

export interface TemplateSample {
  name: string
  title: string
  contact: string
}

export interface TemplateDef {
  name: string
  category: TemplateCategory
  bg: string
  description: string
  products?: string[]
  // 자동 생성 템플릿용 스펙 — 미리보기·에디터가 동일하게 렌더하기 위한 정보.
  layout?: number    // 레이아웃 아키타입 인덱스 (0–7)
  accent?: string    // 강조 색
  ink?: string       // 주요 텍스트 색
  sample?: TemplateSample  // 에디터 초기 샘플 텍스트
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

const MANUAL_TEMPLATES: TemplateDef[] = [
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

// ─── 명함 템플릿 자동 생성 (직군 × 레이아웃 × 팔레트) ──────────────────────────
// moo.com 처럼 풍부한 배리에이션을 위해 직군별 샘플 + 레이아웃 8종 + 팔레트를
// 조합해 200+ 명함 템플릿을 생성. 각 템플릿은 layout/accent/ink/sample 스펙을
// 가지므로 미리보기(TemplatePreview)와 에디터(buildSpecTemplate)가 동일하게 렌더.

interface Profession {
  label: string
  category: TemplateCategory
  sample: TemplateSample
}

const PROFESSIONS: Profession[] = [
  { label: 'Lawyer',            category: 'business',   sample: { name: 'James Carter',    title: 'Attorney at Law',        contact: 'james@lawfirm.com · (212) 555-0100' } },
  { label: 'Accountant',        category: 'business',   sample: { name: 'Emily Nguyen',    title: 'Certified Accountant',   contact: 'emily@cpa.com · (212) 555-0142' } },
  { label: 'Consultant',        category: 'business',   sample: { name: 'David Park',      title: 'Management Consultant',  contact: 'david@consult.co · (415) 555-0190' } },
  { label: 'Financial Advisor', category: 'business',   sample: { name: 'Sarah Bennett',   title: 'Financial Advisor',      contact: 'sarah@wealth.com · (646) 555-0177' } },
  { label: 'Marketing Manager', category: 'business',   sample: { name: 'Olivia Reed',     title: 'Marketing Manager',      contact: 'olivia@brand.io · (312) 555-0166' } },
  { label: 'Sales Director',    category: 'business',   sample: { name: 'Michael Brooks',  title: 'Sales Director',         contact: 'michael@sales.com · (305) 555-0123' } },
  { label: 'Event Planner',     category: 'business',   sample: { name: 'Grace Kim',       title: 'Event Planner',          contact: 'grace@events.co · (702) 555-0188' } },
  { label: 'Travel Agent',      category: 'business',   sample: { name: 'Lucas Moore',     title: 'Travel Specialist',      contact: 'lucas@travel.com · (808) 555-0144' } },
  { label: 'Real Estate Agent', category: 'realestate', sample: { name: 'Sophia Turner',   title: 'Realtor®',               contact: 'sophia@realty.com · (480) 555-0133' } },
  { label: 'Architect',         category: 'realestate', sample: { name: 'Daniel Cho',      title: 'Principal Architect',    contact: 'daniel@studio.com · (206) 555-0119' } },
  { label: 'Interior Designer', category: 'creative',   sample: { name: 'Isabella Rossi',  title: 'Interior Designer',      contact: 'bella@interiors.com · (310) 555-0155' } },
  { label: 'Photographer',      category: 'creative',   sample: { name: 'Ethan Walker',    title: 'Photographer',           contact: 'ethan@photos.com · (323) 555-0171' } },
  { label: 'Graphic Designer',  category: 'creative',   sample: { name: 'Maya Patel',      title: 'Graphic Designer',       contact: 'maya@design.studio · (718) 555-0162' } },
  { label: 'Writer',            category: 'creative',   sample: { name: 'Noah Fischer',    title: 'Author & Copywriter',    contact: 'noah@writes.com · (503) 555-0148' } },
  { label: 'Musician',          category: 'creative',   sample: { name: 'Ava Sinclair',    title: 'Composer & Performer',   contact: 'ava@music.com · (615) 555-0137' } },
  { label: 'Software Engineer', category: 'tech',       sample: { name: 'Ryan Mitchell',   title: 'Software Engineer',      contact: 'ryan@dev.io · github.com/ryanm' } },
  { label: 'Product Manager',   category: 'tech',       sample: { name: 'Chloe Adams',     title: 'Product Manager',        contact: 'chloe@product.co · (415) 555-0124' } },
  { label: 'Data Scientist',    category: 'tech',       sample: { name: 'Leo Zhang',       title: 'Data Scientist',         contact: 'leo@data.ai · (650) 555-0192' } },
  { label: 'Startup Founder',   category: 'tech',       sample: { name: 'Nora Hughes',     title: 'Founder & CEO',          contact: 'nora@startup.com · (628) 555-0101' } },
  { label: 'Doctor',            category: 'health',     sample: { name: 'Dr. Alan Foster', title: 'Family Physician',       contact: 'alan@clinic.com · (212) 555-0156' } },
  { label: 'Dentist',           category: 'health',     sample: { name: 'Dr. Lisa Hwang',  title: 'Dental Surgeon',         contact: 'lisa@dental.com · (212) 555-0173' } },
  { label: 'Therapist',         category: 'health',     sample: { name: 'Rachel Green',    title: 'Licensed Therapist',     contact: 'rachel@therapy.com · (646) 555-0184' } },
  { label: 'Personal Trainer',  category: 'health',     sample: { name: 'Marcus Lee',      title: 'Certified Trainer',      contact: 'marcus@fitness.com · (310) 555-0129' } },
  { label: 'Yoga Instructor',   category: 'health',     sample: { name: 'Hana Suzuki',     title: 'Yoga Instructor',        contact: 'hana@yoga.studio · (808) 555-0118' } },
  { label: 'Nutritionist',      category: 'health',     sample: { name: 'Ella Martin',     title: 'Registered Dietitian',   contact: 'ella@nutri.com · (619) 555-0146' } },
  { label: 'Chef',              category: 'food',       sample: { name: 'Antonio Russo',   title: 'Executive Chef',         contact: 'antonio@kitchen.com · (212) 555-0153' } },
  { label: 'Cafe Owner',        category: 'food',       sample: { name: 'Julia Stone',     title: 'Cafe Owner',             contact: 'julia@cafe.com · (503) 555-0167' } },
  { label: 'Baker',             category: 'food',       sample: { name: 'Oscar Bell',      title: 'Master Baker',           contact: 'oscar@bakery.com · (415) 555-0139' } },
  { label: 'Teacher',           category: 'minimal',    sample: { name: 'Hannah Cole',     title: 'Educator',               contact: 'hannah@school.edu · (312) 555-0175' } },
  { label: 'Hair Stylist',      category: 'health',     sample: { name: 'Zoe Carter',      title: 'Hair Stylist',           contact: 'zoe@salon.com · (786) 555-0191' } },
  // 2차 확대 — 직군 18종 추가 (30 → 48).
  { label: 'Lawyer',            category: 'business',   sample: { name: 'Victoria Shaw',   title: 'Attorney at Law',        contact: 'victoria@law.com · (212) 555-0204' } },
  { label: 'Financial Advisor', category: 'business',   sample: { name: 'James Park',      title: 'Financial Advisor',      contact: 'james@wealth.com · (646) 555-0217' } },
  { label: 'Insurance Agent',   category: 'business',   sample: { name: 'Olivia Reed',     title: 'Insurance Specialist',   contact: 'olivia@insure.com · (312) 555-0229' } },
  { label: 'HR Manager',        category: 'business',   sample: { name: 'Benjamin Cruz',   title: 'HR Manager',             contact: 'ben@company.com · (415) 555-0231' } },
  { label: 'Recruiter',         category: 'business',   sample: { name: 'Sofia Alvarez',   title: 'Talent Recruiter',       contact: 'sofia@talent.io · (628) 555-0246' } },
  { label: 'Marketing Manager', category: 'business',   sample: { name: 'Daniel Wright',   title: 'Marketing Manager',      contact: 'daniel@brand.com · (305) 555-0253' } },
  { label: 'UX Designer',       category: 'creative',   sample: { name: 'Mia Larson',      title: 'UX Designer',            contact: 'mia@ux.studio · (206) 555-0264' } },
  { label: 'Illustrator',       category: 'creative',   sample: { name: 'Felix Romano',    title: 'Illustrator',            contact: 'felix@draw.com · (718) 555-0278' } },
  { label: 'Videographer',      category: 'creative',   sample: { name: 'Aria Bennett',    title: 'Videographer',           contact: 'aria@films.com · (323) 555-0282' } },
  { label: 'Art Director',      category: 'creative',   sample: { name: 'Theo Nakamura',   title: 'Art Director',           contact: 'theo@studio.com · (310) 555-0297' } },
  { label: 'Florist',           category: 'creative',   sample: { name: 'Lily Brooks',     title: 'Floral Designer',        contact: 'lily@blooms.com · (503) 555-0301' } },
  { label: 'Makeup Artist',     category: 'creative',   sample: { name: 'Camila Ortiz',    title: 'Makeup Artist',          contact: 'camila@mua.com · (786) 555-0316' } },
  { label: 'Barber',            category: 'health',     sample: { name: 'Marcus Webb',     title: 'Master Barber',          contact: 'marcus@barber.co · (615) 555-0324' } },
  { label: 'Veterinarian',      category: 'health',     sample: { name: 'Dr. Emma Lyle',   title: 'Veterinarian',           contact: 'emma@vetcare.com · (480) 555-0339' } },
  { label: 'Pharmacist',        category: 'health',     sample: { name: 'Dr. Owen Park',   title: 'Pharmacist',             contact: 'owen@pharma.com · (619) 555-0341' } },
  { label: 'Optometrist',       category: 'health',     sample: { name: 'Dr. Sara Klein',  title: 'Optometrist',            contact: 'sara@vision.com · (702) 555-0358' } },
  { label: 'DevOps Engineer',   category: 'tech',       sample: { name: 'Kai Anderson',    title: 'DevOps Engineer',        contact: 'kai@cloud.io · github.com/kaia' } },
  { label: 'QA Engineer',       category: 'tech',       sample: { name: 'Priya Nair',      title: 'QA Engineer',            contact: 'priya@qa.dev · (650) 555-0367' } },
]

interface Palette {
  bg: string
  ink: string
  accent: string
}

// 라이트/다크 혼합 팔레트 — 직군+레이아웃 인덱스로 회전 선택.
const CARD_PALETTES: Palette[] = [
  { bg: '#ffffff', ink: '#1a1a1a', accent: '#2563eb' },
  { bg: '#0f172a', ink: '#ffffff', accent: '#60a5fa' },
  { bg: '#f8fafc', ink: '#0f172a', accent: '#6366f1' },
  { bg: '#1a1a1a', ink: '#ffffff', accent: '#f59e0b' },
  { bg: '#fef2f2', ink: '#7f1d1d', accent: '#dc2626' },
  { bg: '#f0fdf4', ink: '#14532d', accent: '#16a34a' },
  { bg: '#0d1117', ink: '#f0f6fc', accent: '#3fb950' },
  { bg: '#fdf6e3', ink: '#3b2f1a', accent: '#b8860b' },
  { bg: '#faf5ff', ink: '#4c1d95', accent: '#7c3aed' },
  { bg: '#f0fdfa', ink: '#134e4a', accent: '#0d9488' },
  { bg: '#fff1f2', ink: '#9d174d', accent: '#ec4899' },
  { bg: '#0c1222', ink: '#e2e8f0', accent: '#38bdf8' },
  { bg: '#fafafa', ink: '#171717', accent: '#f97316' },
  { bg: '#1e1b4b', ink: '#e0e7ff', accent: '#a78bfa' },
  { bg: '#ecfeff', ink: '#155e75', accent: '#06b6d4' },
]

const LAYOUT_NAMES = [
  'Bar', 'Monogram', 'Header', 'Split', 'Footer', 'Diagonal', 'Minimal', 'Frame',
  'Sidebar', 'Banner', 'Emblem', 'Watermark',
  // 2차 확대 — 타사(Canva/VistaPrint/Moo) 레이아웃 참고한 6종 추가.
  'Geometric', 'Wave', 'Stripe', 'Vertical', 'Ribbon', 'Badge',
]
const LAYOUT_COUNT = LAYOUT_NAMES.length

function generateCardTemplates(): TemplateDef[] {
  const out: TemplateDef[] = []
  PROFESSIONS.forEach((prof, pi) => {
    for (let layout = 0; layout < LAYOUT_COUNT; layout++) {
      const pal = CARD_PALETTES[(pi * 5 + layout * 3) % CARD_PALETTES.length]
      out.push({
        name: `${prof.label} ${LAYOUT_NAMES[layout]}`,
        category: prof.category,
        bg: pal.bg,
        description: `${prof.sample.title} — ${LAYOUT_NAMES[layout].toLowerCase()} layout`,
        products: BC,
        layout,
        accent: pal.accent,
        ink: pal.ink,
        sample: prof.sample,
      })
    }
  })
  return out
}

export const GENERATED_CARD_TEMPLATES: TemplateDef[] = generateCardTemplates()

// 이름 → 생성 스펙 빠른 조회 (에디터에서 사용).
export const GENERATED_TEMPLATE_MAP: Record<string, TemplateDef> =
  Object.fromEntries(GENERATED_CARD_TEMPLATES.map(t => [t.name, t]))

// 수동 + 자동 생성 통합 카탈로그.
export const TEMPLATE_CATALOG: TemplateDef[] = [...MANUAL_TEMPLATES, ...GENERATED_CARD_TEMPLATES]

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
