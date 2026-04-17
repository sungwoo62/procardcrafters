-- =============================================================
-- 초기 상품 데이터 (5종)
-- 단가: 성원애드피아 기준 KRW, 마진 3.3배 적용
-- =============================================================

INSERT INTO print_products (slug, name_ko, name_en, category, base_price_krw, margin_multiplier, sort_order, description_ko) VALUES
('business-cards', '명함', 'Business Cards', 'business_cards', 15000, 3.3, 1, '고품질 명함 인쇄. 다양한 용지와 코팅 옵션 선택 가능.'),
('stickers', '스티커', 'Stickers', 'stickers', 12000, 3.3, 2, '맞춤 스티커 인쇄. 다이커팅 및 롤 스티커 지원.'),
('flyers', '전단지', 'Flyers', 'flyers', 20000, 3.3, 3, '고화질 전단지 인쇄. A4/A5/A6 사이즈.'),
('postcards', '엽서', 'Postcards', 'postcards', 18000, 3.3, 4, '감성 엽서 인쇄. 표준 4x6인치 사이즈.'),
('posters', '포스터', 'Posters', 'posters', 35000, 3.3, 5, '대형 포스터 인쇄. A3/A2/A1 사이즈.')
ON CONFLICT (slug) DO NOTHING;

-- 명함 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '100장', '100 sheets', '100', 0, true, 1 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '200장', '200 sheets', '200', 8000, false, 2 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '500장', '500 sheets', '500', 20000, false, 3 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'paper', '스노우지 350g', 'Snow 350gsm', 'snow_350', 0, true, 1 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'paper', '아트지 300g', 'Art 300gsm', 'art_300', 0, false, 2 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'paper', '리넨지 350g', 'Linen 350gsm', 'linen_350', 5000, false, 3 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'coating', '무광 코팅', 'Matte Coating', 'matte', 3000, true, 1 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'coating', '유광 코팅', 'Glossy Coating', 'glossy', 3000, false, 2 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'coating', '코팅 없음', 'No Coating', 'none', 0, false, 3 FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
