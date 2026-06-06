-- OMO-2480: 명함 대량 수량 옵션 추가 (3000, 5000, 10000장)
-- Swadpia 실시간 가격이 적용되므로 extra_price_krw는 fallback 용도

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '3000장', '3,000 sheets', '3000', 135000, FALSE, 6
FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '5000장', '5,000 sheets', '5000', 210000, FALSE, 7
FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '10000장', '10,000 sheets', '10000', 380000, FALSE, 8
FROM print_products p WHERE p.slug = 'business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- premium-business-cards 도 동일 수량 확장
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '2000장', '2,000 sheets', '2000', 95000, FALSE, 4
FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '3000장', '3,000 sheets', '3000', 135000, FALSE, 5
FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '5000장', '5,000 sheets', '5000', 210000, FALSE, 6
FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '10000장', '10,000 sheets', '10000', 380000, FALSE, 7
FROM print_products p WHERE p.slug = 'premium-business-cards'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
