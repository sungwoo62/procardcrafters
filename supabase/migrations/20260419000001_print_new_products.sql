-- =============================================================
-- 추가 성원 제품군 (4종 추가)
-- premium-business-cards, die-cut-stickers, brochures, banners
-- =============================================================

-- 카테고리 CHECK 제약 업데이트
ALTER TABLE print_products DROP CONSTRAINT IF EXISTS print_products_category_check;
ALTER TABLE print_products ADD CONSTRAINT print_products_category_check
  CHECK (category IN (
    'business_cards', 'premium_business_cards',
    'stickers', 'die_cut_stickers',
    'flyers', 'brochures',
    'postcards',
    'posters', 'banners'
  ));

-- 추가 상품 시드 데이터
INSERT INTO print_products (slug, name_ko, name_en, category, base_price_krw, margin_multiplier, sort_order, description_ko) VALUES
('premium-business-cards', '고급명함', 'Premium Business Cards', 'premium_business_cards', 25000, 3.3, 2, '고급 특수지 명함 인쇄. 리넨, 펄, 하이브리드 용지 선택 가능.'),
('die-cut-stickers', '도무송 스티커', 'Die-Cut Stickers', 'die_cut_stickers', 15000, 3.3, 4, '맞춤형 도무송 스티커. 원하는 모양으로 자유롭게 커팅.'),
('brochures', '브로슈어', 'Brochures', 'brochures', 30000, 3.3, 6, '고급 브로슈어/리플렛 인쇄. 접지형 및 중철 제본.'),
('banners', '배너', 'Banners', 'banners', 20000, 3.3, 9, '미니 배너 및 현수막 인쇄. 다양한 사이즈.')
ON CONFLICT (slug) DO NOTHING;

-- 고급명함 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '200장', '200 sheets', '200', 0, true, 1 FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '500장', '500 sheets', '500', 15000, false, 2 FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1000장', '1000 sheets', '1000', 30000, false, 3 FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'paper', '리넨지 350g', 'Linen 350gsm', 'linen_350', 0, true, 1 FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'paper', '펄지 300g', 'Pearl 300gsm', 'pearl_300', 3000, false, 2 FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 도무송 스티커 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '100장', '100 sheets', '100', 0, true, 1 FROM print_products p WHERE p.slug = 'die-cut-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '500장', '500 sheets', '500', 10000, false, 2 FROM print_products p WHERE p.slug = 'die-cut-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1000장', '1000 sheets', '1000', 18000, false, 3 FROM print_products p WHERE p.slug = 'die-cut-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 브로슈어 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '500부', '500 copies', '500', 0, true, 1 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1000부', '1000 copies', '1000', 20000, false, 2 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'size', 'A4 접지', 'A4 Folded', 'a4_fold', 0, true, 1 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'size', 'A5', 'A5', 'a5', 0, false, 2 FROM print_products p WHERE p.slug = 'brochures'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 배너 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1장', '1 piece', '1', 0, true, 1 FROM print_products p WHERE p.slug = 'banners'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '5장', '5 pieces', '5', 8000, false, 2 FROM print_products p WHERE p.slug = 'banners'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'size', '미니배너 (60×160cm)', 'Mini Banner (60×160cm)', '60x160', 0, true, 1 FROM print_products p WHERE p.slug = 'banners'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'size', '미니배너 (80×200cm)', 'Mini Banner (80×200cm)', '80x200', 5000, false, 2 FROM print_products p WHERE p.slug = 'banners'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
