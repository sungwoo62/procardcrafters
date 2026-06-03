-- 제품 카탈로그 전면 보강
-- ─────────────────────
-- 목적: 가격 정책 정비 + 옵션 다양화 + 종이/마감 사양 명시 + 신규 라인업 추가
-- 핵심 인사이트 (가격 비교 분석 기반):
--   - 브로슈어 가격 인상 (Vistaprint 대비 30% 저렴 → 23% 저렴, 마진 +¶
--   - Premium Foil 명함 신설 (Moo Luxe 절반 가격대 공략)
--   - 종이/마감/크기/매수 옵션 확장
--   - 영문 설명 추가 (글로벌 고객 대응)

-- ============================================================
-- 1. 스키마 확장
-- ============================================================
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS description_en       TEXT;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS recommended_use_ko   TEXT;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS recommended_use_en   TEXT;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS production_days_min  INT NOT NULL DEFAULT 2;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS production_days_max  INT NOT NULL DEFAULT 4;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS min_order_quantity   INT NOT NULL DEFAULT 1;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS is_premium           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS badge_text_ko        TEXT;
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS badge_text_en        TEXT;

ALTER TABLE print_product_options ADD COLUMN IF NOT EXISTS weight_modifier_g NUMERIC(8, 2) NOT NULL DEFAULT 0;
ALTER TABLE print_product_options ADD COLUMN IF NOT EXISTS description_ko    TEXT;
ALTER TABLE print_product_options ADD COLUMN IF NOT EXISTS description_en    TEXT;

COMMENT ON COLUMN print_product_options.weight_modifier_g IS
  '옵션 선택 시 1매당 무게 변경량(g). 양수=무거워짐. paper 350gsm vs 250gsm 등에서 사용.';

-- product category 확장
ALTER TABLE print_products DROP CONSTRAINT IF EXISTS print_products_category_check;
ALTER TABLE print_products ADD CONSTRAINT print_products_category_check
  CHECK (category IN (
    'business_cards', 'premium_business_cards', 'premium_foil_cards',
    'stickers', 'die_cut_stickers', 'eco_stickers',
    'flyers', 'brochures',
    'postcards',
    'posters', 'banners',
    'sample_pack'
  ));

-- ============================================================
-- 2. 가격 + 설명 보강 (기존 제품)
-- ============================================================

-- 명함 (business-cards): 가격 유지, 설명/사양 보강
UPDATE print_products SET
  description_ko = '300~400gsm 프리미엄 용지를 선택할 수 있는 표준 명함. 무광/유광/소프트터치 코팅, 컬러 양면 인쇄 기본 제공. 글로벌 FedEx 배송으로 일본/대만/홍콩/EU/미국 모두 3~5일 배송.',
  description_en = 'Standard business cards on premium 300-400gsm stock. Choose from matte, gloss, or soft-touch coating with full-color double-sided printing. Worldwide FedEx delivery in 3-5 business days.',
  recommended_use_ko = '신규 창업자, 프리랜서, B2B 영업, 컨퍼런스/네트워킹용',
  recommended_use_en = 'Startups, freelancers, B2B sales, conferences and networking',
  production_days_min = 2, production_days_max = 4,
  min_order_quantity = 100,
  unit_weight_g = 1.0
WHERE slug = 'business-cards';

-- 고급명함: 가격 인상 (25K → 30K), 설명 보강
UPDATE print_products SET
  base_price_krw = 30000,
  description_ko = '코튼, 펄, 리넨, 하이브리드 등 특수지 명함. 일반 명함보다 두께·질감이 차별화되어 첫 인상에 효과적. 350~400gsm 두꺼운 종이 사용.',
  description_en = 'Premium business cards on specialty stocks: cotton, pearl, linen, and hybrid. Heavyweight 350-400gsm stock for tactile luxury feel and lasting first impressions.',
  recommended_use_ko = 'CEO/임원, 디자인 스튜디오, 변호사·회계사, 럭셔리 브랜드',
  recommended_use_en = 'Executives, design studios, lawyers, luxury brand reps',
  production_days_min = 3, production_days_max = 5,
  is_premium = TRUE,
  badge_text_ko = '고급',
  badge_text_en = 'Premium',
  unit_weight_g = 1.5
WHERE slug = 'premium-business-cards';

-- 브로슈어: 가격 인상 (30K → 40K), 설명 + 페이지 사양 보강
UPDATE print_products SET
  base_price_krw = 40000,
  description_ko = 'A4/A5 사이즈 3단접지·중철 브로슈어. 150~250gsm 아트지/스노우지 선택. 4p/8p/12p 페이지 옵션. 풀컬러 양면 인쇄. 회사 소개서, 카탈로그, 행사 안내 등 마케팅 자료에 적합.',
  description_en = 'Tri-fold or saddle-stitched brochures in A4/A5. Choose 150-250gsm matt or coated stock with 4/8/12-page options. Full-color double-sided printing. Ideal for company profiles, catalogs, and event guides.',
  recommended_use_ko = '회사 소개서, 제품 카탈로그, 행사·전시 안내문, 호텔·관광지 가이드',
  recommended_use_en = 'Company brochures, product catalogs, event guides, hotel/tourism handouts',
  production_days_min = 3, production_days_max = 5,
  min_order_quantity = 100,
  unit_weight_g = 15.0
WHERE slug = 'brochures';

-- 전단지 (flyers): 설명 + 종이 옵션 보강
UPDATE print_products SET
  description_ko = 'A4/A5/A6 풀컬러 전단지. 80~150gsm 종이 선택. 양면 인쇄, 무광/유광 코팅 옵션. 매장 홍보, 이벤트, DM 발송에 적합.',
  description_en = 'Full-color flyers in A4/A5/A6 on 80-150gsm stock. Double-sided printing with matte/gloss options. Perfect for retail promotions, events, and direct mail.',
  recommended_use_ko = '매장 홍보, 행사 전단, DM, 메뉴/가격표',
  recommended_use_en = 'Retail promotions, event flyers, direct mail, menus/price lists',
  production_days_min = 2, production_days_max = 4,
  min_order_quantity = 100,
  unit_weight_g = 6.0
WHERE slug = 'flyers';

-- 스티커: 설명 보강
UPDATE print_products SET
  description_ko = '아트지/투명/홀로그램 스티커. 사이즈/모양 다양. 컷팅 옵션: 사각, 라운드, 도무송(자유 형태). 방수 라미네이팅 가능.',
  description_en = 'Sticker sheets on art paper, transparent, or holographic stock. Various sizes and shapes. Cut options: square, rounded, die-cut. Optional waterproof lamination.',
  recommended_use_ko = '브랜드 라벨, 패키지 봉인, 굿즈, 기념품',
  recommended_use_en = 'Brand labels, package seals, merch, souvenirs',
  production_days_min = 3, production_days_max = 5,
  unit_weight_g = 1.0
WHERE slug = 'stickers';

UPDATE print_products SET
  description_ko = '원하는 모양으로 자유 컷팅하는 도무송 스티커. 60µm 비닐 / 80µm 페이퍼 / 홀로그램 선택. 방수 라미네이팅 옵션.',
  description_en = 'Custom-shape die-cut stickers. Choose 60µm vinyl, 80µm paper, or holographic stock. Waterproof lamination optional.',
  recommended_use_ko = '로고 스티커, 굿즈, 이벤트 기념품, 차량용',
  recommended_use_en = 'Logo stickers, merch, event giveaways, vehicle decals',
  is_premium = TRUE,
  badge_text_ko = '커스텀',
  badge_text_en = 'Custom',
  unit_weight_g = 1.5
WHERE slug = 'die-cut-stickers';

UPDATE print_products SET
  description_ko = '4x6인치 표준 엽서. 250gsm 두꺼운 종이로 우편 발송에도 안정. 컬러 양면 인쇄. 결혼식 청첩장, 연하장, 마케팅 DM 등.',
  description_en = '4x6 inch standard postcards on heavyweight 250gsm stock — durable for mail. Full-color double-sided. Perfect for invitations, season''s greetings, and direct mail.',
  recommended_use_ko = '청첩장, 연하장, 부동산 광고, 마케팅 DM',
  recommended_use_en = 'Wedding invites, seasonal cards, real-estate ads, direct mail',
  production_days_min = 2, production_days_max = 4,
  unit_weight_g = 5.0
WHERE slug = 'postcards';

UPDATE print_products SET
  description_ko = 'A3/A2/A1/A0 대형 포스터. 200~250gsm 새틴/포토용지 선택. 풀컬러 고해상 출력. 전시, 콘서트, 매장 디스플레이용.',
  description_en = 'Large-format posters in A3/A2/A1/A0 on 200-250gsm satin or photo stock. Full-color high-resolution. Ideal for exhibitions, concerts, and retail displays.',
  recommended_use_ko = '전시, 콘서트, 매장 디스플레이, 영화 포스터',
  recommended_use_en = 'Exhibitions, concerts, retail displays, movie posters',
  production_days_min = 3, production_days_max = 5,
  unit_weight_g = 100
WHERE slug = 'posters';

UPDATE print_products SET
  description_ko = '미니 배너 및 현수막. 강력한 PE/PVC 소재. 그로멧(고리) 마감 포함. 야외 전시, 매장 외관, 행사장 등.',
  description_en = 'Mini banners and signage on durable PE/PVC. Grommet finish included. For outdoor displays, storefronts, and events.',
  recommended_use_ko = '매장 외관, 야외 행사, 부스 배너, 차량 광고',
  recommended_use_en = 'Storefronts, outdoor events, booth banners, vehicle signage',
  production_days_min = 3, production_days_max = 6,
  unit_weight_g = 500
WHERE slug = 'banners';

-- ============================================================
-- 3. 신규 제품 라인업
-- ============================================================

-- 3-1. Premium Foil Cards — Moo Luxe 절반 가격대 공략
INSERT INTO print_products (
  slug, name_ko, name_en, category,
  base_price_krw, margin_multiplier, sort_order,
  is_active, is_premium, badge_text_ko, badge_text_en,
  description_ko, description_en,
  recommended_use_ko, recommended_use_en,
  production_days_min, production_days_max, min_order_quantity,
  unit_weight_g
) VALUES (
  'premium-foil-cards',
  '포일 명함',
  'Foil Business Cards',
  'premium_foil_cards',
  40000, 3.3, 3,
  TRUE, TRUE, '럭셔리', 'Luxury',
  '금박/은박/로즈골드 포일 핫스탬핑 명함. 400gsm 코튼 또는 모호크 슈퍼파인 종이에 1~2색 포일 압인. Moo Luxe 동등 사양, 절반 가격.',
  'Hot-stamped foil business cards on 400gsm cotton or Mohawk Superfine stock. Gold, silver, or rose-gold foil in 1-2 colors. Same spec as Moo Luxe at half the price.',
  '럭셔리 브랜드, 부티크 호텔, 변호사·금융 전문가, VIP 카드',
  'Luxury brands, boutique hotels, lawyers and finance pros, VIP cards',
  5, 8, 100, 2.5
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'quantity', '100장',  '100 cards',  '100',   0, TRUE,  1, NULL FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '200장',  '200 cards',  '200', 25000, FALSE, 2 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '500장',  '500 cards',  '500', 70000, FALSE, 3 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1000장', '1000 cards', '1000', 130000, FALSE, 4 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'paper', '코튼 400gsm',           'Cotton 400gsm',           'cotton_400',   0, TRUE,  1, '부드러운 무코팅 면 소재. 필기 가능.' FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'paper', '모호크 슈퍼파인 350gsm', 'Mohawk Superfine 350gsm', 'mohawk_350', 15000, FALSE, 2 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'paper', '펄지 380gsm',            'Pearl 380gsm',            'pearl_380',    8000, FALSE, 3 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'finish', '금박',     'Gold foil',     'gold',       0, TRUE,  1 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'finish', '은박',     'Silver foil',   'silver',     0, FALSE, 2 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'finish', '로즈골드', 'Rose gold foil', 'rose_gold', 5000, FALSE, 3 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'finish', '홀로그램', 'Holographic foil', 'holo',  10000, FALSE, 4 FROM print_products p WHERE p.slug = 'premium-foil-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 3-2. 샘플팩 — Moo 처럼 무료/저가 샘플 발송으로 신규 고객 확보
INSERT INTO print_products (
  slug, name_ko, name_en, category,
  base_price_krw, margin_multiplier, sort_order,
  is_active, is_premium, badge_text_ko, badge_text_en,
  description_ko, description_en,
  recommended_use_ko, recommended_use_en,
  production_days_min, production_days_max, min_order_quantity,
  unit_weight_g
) VALUES (
  'sample-pack',
  '샘플팩',
  'Sample Pack',
  'sample_pack',
  5000, 1.5, 99,
  TRUE, FALSE, '무료배송', 'Free Shipping',
  '주문 전에 종이 질감/두께를 직접 확인할 수 있는 샘플 모음. 모든 종이(스노우, 아트, 코튼, 모호크, 펄, 홀로그램 등) 각 1장 + 코팅 견본. 고객당 1회 한정.',
  'Touch and feel our papers before ordering. Includes one swatch of each stock (snow, art, cotton, Mohawk, pearl, holographic) + coating samples. One pack per customer.',
  '구매 전 종이 비교, 디자이너의 작업 참고',
  'Pre-purchase paper comparison, designer reference',
  1, 2, 1, 50
) ON CONFLICT (slug) DO NOTHING;

-- 3-3. 친환경 스티커 — recycled paper
INSERT INTO print_products (
  slug, name_ko, name_en, category,
  base_price_krw, margin_multiplier, sort_order,
  is_active, is_premium, badge_text_ko, badge_text_en,
  description_ko, description_en,
  recommended_use_ko, recommended_use_en,
  production_days_min, production_days_max, min_order_quantity,
  unit_weight_g
) VALUES (
  'eco-stickers',
  '친환경 스티커',
  'Eco Stickers',
  'eco_stickers',
  15000, 3.3, 8,
  TRUE, FALSE, 'ECO', 'ECO',
  '재활용 종이 + 식물성 접착제로 만든 친환경 스티커. FSC 인증 종이. 일반 스티커 대비 ~15% 비싸지만 지속 가능성 강조 브랜드에 적합.',
  'Eco-friendly stickers on FSC-certified recycled paper with plant-based adhesive. ~15% premium over standard, ideal for sustainability-focused brands.',
  '비건/오가닉 브랜드, 친환경 패키징, 자선 캠페인',
  'Vegan/organic brands, sustainable packaging, charity campaigns',
  3, 5, 100, 1.0
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. 명함 옵션 확장 (기존 + 새로운 paper/finish/corner/side)
-- ============================================================

-- BC: 1000장 옵션 추가
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1000장', '1000 sheets', '1000', 50000, FALSE, 4 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- BC: 2000장 (벌크 할인) 추가
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '2000장', '2000 sheets', '2000', 95000, FALSE, 5 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- BC: 250gsm 옵션 추가 (얇고 가벼움, 가격 -)
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '아트지 250g (얇음)', 'Art 250gsm (Light)', 'art_250', -3000, FALSE, 0,
  '얇고 가벼운 표준 명함', -0.4
FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- BC: 400gsm 코튼 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '코튼 400g', 'Cotton 400gsm', 'cotton_400', 12000, FALSE, 4,
  '부드러운 면 소재. 펜으로 필기 가능', 0.5
FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- BC: 소프트터치 코팅 (Moo Original 비슷한 느낌)
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'coating', '소프트터치 코팅', 'Soft-touch Coating', 'soft_touch', 8000, FALSE, 4,
  '벨벳 같은 부드러운 표면. 럭셔리 느낌'
FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- BC: 스팟 UV (포인트 광택)
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'coating', '스팟 UV', 'Spot UV', 'spot_uv', 12000, FALSE, 5,
  '로고/텍스트만 광택 처리하는 포인트 코팅'
FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- BC: 모서리 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'corners', '사각 모서리', 'Square Corners', 'square', 0, TRUE, 1 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'corners', '둥근 모서리', 'Rounded Corners', 'rounded', 3000, FALSE, 2 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- BC: 인쇄면 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'sides', '양면 인쇄', 'Double-sided', 'double', 0, TRUE, 1 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'sides', '단면 인쇄', 'Single-sided', 'single', -3000, FALSE, 2 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ============================================================
-- 5. 브로슈어 옵션 보강 (페이지 수 + 종이 + 마감)
-- ============================================================

-- 브로슈어: 2000부, 5000부 (벌크)
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '2000부', '2000 copies', '2000', 50000, FALSE, 3 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '5000부', '5000 copies', '5000', 120000, FALSE, 4 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 브로슈어 페이지 수
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'pages', '4페이지 (A4 단접)', '4 pages (single fold)', '4p', 0, TRUE, 1, 'A4 1장 반접 — 6 면 활용', 0 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'pages', '8페이지 (중철)', '8 pages (saddle stitch)', '8p', 10000, FALSE, 2, 'A4 2장 중철 — 8 면 활용', 9.4 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'pages', '12페이지 (중철)', '12 pages (saddle stitch)', '12p', 25000, FALSE, 3, 'A4 3장 중철 — 12 면 활용', 18.8 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 브로슈어 종이
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '아트지 150gsm', 'Art 150gsm', 'art_150', 0, TRUE, 1, '표준 브로슈어 용지', 0 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '스노우지 200gsm', 'Snow 200gsm', 'snow_200', 8000, FALSE, 2, '두껍고 고급스러운 느낌', 3.1 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '몽블랑지 250gsm', 'Mont Blanc 250gsm', 'montblanc_250', 18000, FALSE, 3, '럭셔리 브로슈어용 프리미엄 종이', 6.2 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 브로슈어 코팅
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'coating', '무광 코팅', 'Matte Coating', 'matte', 0, TRUE, 1 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'coating', '유광 코팅', 'Glossy Coating', 'glossy', 0, FALSE, 2 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'coating', '코팅 없음', 'Uncoated', 'none', 0, FALSE, 3 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ============================================================
-- 6. 전단지 옵션 보강 (종이 무게 + 사이즈)
-- ============================================================

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '500매', '500 sheets', '500', 0, TRUE, 1 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1000매', '1000 sheets', '1000', 15000, FALSE, 2 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '2000매', '2000 sheets', '2000', 35000, FALSE, 3 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '5000매', '5000 sheets', '5000', 80000, FALSE, 4 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '미색모조지 80gsm', 'Bond 80gsm',     'bond_80',   -3000, FALSE, 0, '가장 가벼운 옵션 — 대량 배포용', -1.2 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '아트지 100gsm', 'Art 100gsm', 'art_100', 0, TRUE, 1, '표준 전단지 종이', 0 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko, weight_modifier_g)
SELECT p.id, 'paper', '아트지 150gsm', 'Art 150gsm', 'art_150', 5000, FALSE, 2, '두꺼운 고급 전단지', 3.1 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'size', 'A4', 'A4 (210×297mm)', 'a4', 0, TRUE, 1 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'size', 'A5', 'A5 (148×210mm)', 'a5', -5000, FALSE, 2 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'size', 'A6', 'A6 (105×148mm)', 'a6', -8000, FALSE, 3 FROM print_products p WHERE p.slug = 'flyers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ============================================================
-- 7. unit_weight_g 정합성 보강 (이전 시드에서 누락된 신제품)
-- ============================================================
UPDATE print_products SET unit_weight_g = 2.5 WHERE slug = 'premium-foil-cards' AND (unit_weight_g IS NULL OR unit_weight_g = 0);
UPDATE print_products SET unit_weight_g = 50  WHERE slug = 'sample-pack' AND (unit_weight_g IS NULL OR unit_weight_g = 0);
UPDATE print_products SET unit_weight_g = 1.0 WHERE slug = 'eco-stickers' AND (unit_weight_g IS NULL OR unit_weight_g = 0);

COMMENT ON COLUMN print_products.production_days_min IS '인쇄 시작 후 발송까지 최소 영업일';
COMMENT ON COLUMN print_products.production_days_max IS '인쇄 시작 후 발송까지 최대 영업일';
