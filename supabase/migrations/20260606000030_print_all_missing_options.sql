-- ============================================================
-- OMO-2477: 옵션 없는 48개 제품 전체 옵션 추가
--
-- 배경: 48개 활성 제품에 print_product_options = 0 → "Get a Quote" 표시.
--       성원(Swadpia) 사이트 기준 종이/수량/사이즈 옵션 + 마진 3.3x 가격 정책 적용.
--
-- 가격 공식: (base_price_krw + sum(extra_price_krw)) × margin_multiplier → USD
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. 그리팅 카드류 base_price_krw 수정
--    (기존값은 장당 단가 — 100장 최소 주문 기준 총 도매가로 변환)
-- ─────────────────────────────────────────────────────────────
UPDATE print_products SET base_price_krw = 25000 WHERE slug = 'invitation-cards';
UPDATE print_products SET base_price_krw = 35000 WHERE slug = 'wedding-cards';
UPDATE print_products SET base_price_krw = 20000 WHERE slug = 'greeting-cards-general';
UPDATE print_products SET base_price_krw = 18000 WHERE slug = 'hangtag-cards';

-- ─────────────────────────────────────────────────────────────
-- 2. 특수 명함 (Swadpia 미연동, DB 기반 가격, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 펄 명함 (pearl-business-cards)  base=7500
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'PRL250W00', '펄지 250g',   'Pearl 250gsm',  0,    true,  1),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'PRL300W00', '펄지 300g',   'Pearl 300gsm',  3000, false, 2),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'LNN350W00', '리넨지 350g', 'Linen 350gsm',  5000, false, 3),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'print_color_type', 'CTN40', '양면 컬러', 'Double-sided Color',  0,    true,  1),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'print_color_type', 'CTN10', '단면 컬러', 'Single-sided Color', -3000, false, 2),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_size', 'N0100', '90×50mm (표준)', '90×50mm (Standard)', 0, true,  1),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_size', 'N0200', '86×52mm',         '86×52mm',            0, false, 2),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty',  '100',  '100매',  '100 cards',   0,    true,  1),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty',  '200',  '200매',  '200 cards',   7500, false, 2),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty',  '500',  '500매',  '500 cards',  22000, false, 3),
('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty',  '1000', '1000매', '1,000 cards',45000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- UV 명함 (uv-business-cards)  base=9500
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'SNW250W00', '스노우지 250g', 'Snow White 250gsm',  0,    true,  1),
('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'SNW300W00', '스노우지 300g', 'Snow White 300gsm',  3000, false, 2),
('04802355-a73d-4d57-9228-723ee56519da', 'print_color_type', 'CTN40', '양면+UV코팅', 'Double-sided + UV Coating',  0,    true,  1),
('04802355-a73d-4d57-9228-723ee56519da', 'print_color_type', 'CTN10', '단면+UV코팅', 'Single-sided + UV Coating', -3000, false, 2),
('04802355-a73d-4d57-9228-723ee56519da', 'paper_size', 'N0100', '90×50mm (표준)', '90×50mm (Standard)', 0, true,  1),
('04802355-a73d-4d57-9228-723ee56519da', 'paper_size', 'N0200', '86×52mm',         '86×52mm',            0, false, 2),
('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty',  '100',  '100매',  '100 cards',  0,    true,  1),
('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty',  '200',  '200매',  '200 cards',  9500, false, 2),
('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty',  '500',  '500매',  '500 cards', 28000, false, 3),
('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty',  '1000', '1000매', '1,000 cards',55000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 투명 명함 (transparent-business-cards)  base=18000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_code', 'PVC250W00', 'PVC 투명 250µm', 'Clear PVC 250µm',  0,    true,  1),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_code', 'PVC350W00', 'PVC 투명 350µm', 'Clear PVC 350µm',  5000, false, 2),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'print_color_type', 'CTN40', '양면 컬러', 'Double-sided Color',  0,    true,  1),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'print_color_type', 'CTN10', '단면 컬러', 'Single-sided Color', -5000, false, 2),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_size', 'N0100', '90×50mm (표준)', '90×50mm (Standard)', 0, true, 1),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty',  '100',  '100매',  '100 cards',   0,    true,  1),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty',  '200',  '200매',  '200 cards',  18000, false, 2),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty',  '500',  '500매',  '500 cards',  50000, false, 3),
('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty',  '1000', '1000매', '1,000 cards',90000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 메탈릭 명함 (metallic-business-cards)  base=22000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_code', 'MTC250W00', '메탈릭지 250g', 'Metallic 250gsm',  0,    true,  1),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_code', 'MTC350W00', '메탈릭지 350g', 'Metallic 350gsm',  8000, false, 2),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'print_color_type', 'CTN40', '양면 컬러', 'Double-sided Color',  0,    true,  1),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'print_color_type', 'CTN10', '단면 컬러', 'Single-sided Color', -5000, false, 2),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_size', 'N0100', '90×50mm (표준)', '90×50mm (Standard)', 0, true, 1),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty',  '100',  '100매',  '100 cards',   0,     true,  1),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty',  '200',  '200매',  '200 cards',   22000, false, 2),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty',  '500',  '500매',  '500 cards',   60000, false, 3),
('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty',  '1000', '1000매', '1,000 cards', 110000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. 그리팅 카드류 (DB 기반, 3.2x 마진)
-- ─────────────────────────────────────────────────────────────

-- 초대장 (invitation-cards)  base=25000(업데이트됨)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'paper', 'SNW200W', '스노우지 200g', 'Snow White 200gsm',  0,    true,  1),
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'paper', 'ART250W', '아트지 250g',   'Art Coated 250gsm',  3000, false, 2),
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'size',  'S1',      '110×190mm (표준)', '110×190mm (Standard)', 0,    true,  1),
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'size',  'S2',      '148×210mm (A5)', 'A5 (148×210mm)',       5000, false, 2),
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'quantity', '100',  '100장',  '100 pcs',  0,    true,  1),
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'quantity', '200',  '200장',  '200 pcs',  20000, false, 2),
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'quantity', '300',  '300장',  '300 pcs',  40000, false, 3),
('70557b09-a0b8-4c19-83a1-8e5032947cec', 'quantity', '500',  '500장',  '500 pcs',  75000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 청첩장 (wedding-cards)  base=35000(업데이트됨)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('f074d897-2c48-4581-bdc6-be392b931df0', 'paper', 'SNW250W', '스노우지 250g', 'Snow White 250gsm',  0,    true,  1),
('f074d897-2c48-4581-bdc6-be392b931df0', 'paper', 'CTN350W', '코튼지 350g',   'Cotton 350gsm',     10000, false, 2),
('f074d897-2c48-4581-bdc6-be392b931df0', 'size',  'S1',      '110×190mm (표준)', '110×190mm (Standard)',  0,    true,  1),
('f074d897-2c48-4581-bdc6-be392b931df0', 'size',  'S2',      '148×210mm (A5)', 'A5 (148×210mm)',        5000, false, 2),
('f074d897-2c48-4581-bdc6-be392b931df0', 'quantity', '50',   '50장',   '50 pcs',   0,    true,  1),
('f074d897-2c48-4581-bdc6-be392b931df0', 'quantity', '100',  '100장',  '100 pcs',  30000, false, 2),
('f074d897-2c48-4581-bdc6-be392b931df0', 'quantity', '200',  '200장',  '200 pcs',  65000, false, 3),
('f074d897-2c48-4581-bdc6-be392b931df0', 'quantity', '300',  '300장',  '300 pcs',  95000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 연하장/연말카드 (greeting-cards-general)  base=20000(업데이트됨)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'paper', 'ART200W', '아트지 200g',  'Art Coated 200gsm',  0,    true,  1),
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'paper', 'SNW250W', '스노우지 250g','Snow White 250gsm',  3000, false, 2),
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'size',  'S1',      '100×148mm (엽서형)', '100×148mm (Postcard)', 0,    true,  1),
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'size',  'S2',      '148×210mm (A5)', 'A5 (148×210mm)',       3000, false, 2),
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'quantity', '100',  '100장',  '100 pcs',  0,    true,  1),
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'quantity', '200',  '200장',  '200 pcs',  15000, false, 2),
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'quantity', '500',  '500장',  '500 pcs',  40000, false, 3),
('2d53cbfb-fb62-4576-ba54-d1efd893efb3', 'quantity', '1000', '1000장', '1,000 pcs',75000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 행택 (hangtag-cards)  base=18000(업데이트됨)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'paper', 'ART250W', '아트지 250g',  'Art Coated 250gsm',  0,    true,  1),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'paper', 'KFT250W', '크라프트 250g','Kraft 250gsm',       3000, false, 2),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'size',  'S1',      '50×90mm (소)', '50×90mm (Small)',  0,    true,  1),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'size',  'S2',      '60×100mm (중)', '60×100mm (Medium)',2000, false, 2),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'size',  'S3',      '70×120mm (대)', '70×120mm (Large)', 4000, false, 3),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'quantity', '100',  '100장',  '100 pcs',  0,    true,  1),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'quantity', '200',  '200장',  '200 pcs',  13000, false, 2),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'quantity', '500',  '500장',  '500 pcs',  36000, false, 3),
('c468ebe2-c393-4020-bfce-e15175e6da2b', 'quantity', '1000', '1000장', '1,000 pcs',65000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. 특수 스티커 (Swadpia CST5000/CST7000 연동 가능, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 투명 스티커 (transparent-stickers)  base=18000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'paper_code', 'STK080YP1', '투명 유포지 80µm', 'Clear Vinyl Film 80µm',  0,    true,  1),
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'paper_code', 'STK060YP0', '투명 필름 60µm',   'Transparent Film 60µm',  3000, false, 2),
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'print_color_type', 'SPD10', '단면 컬러',          'Single-sided Color',         0,    true,  1),
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'print_color_type', 'SPD20', '단면 컬러 + UV코팅', 'Single-sided Color + UV',    3000, false, 2),
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'paper_qty', '100',  '100매',  '100 pcs',   0,     true,  1),
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'paper_qty', '200',  '200매',  '200 pcs',   15000, false, 2),
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'paper_qty', '500',  '500매',  '500 pcs',   30000, false, 3),
('6fd8269c-6857-4099-bcc7-a7896fc44189', 'paper_qty', '1000', '1000매', '1,000 pcs', 50000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 홀로그램 스티커 (holographic-stickers)  base=22000  → Swadpia CST5000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'paper_code', 'STK_HLG1', '홀로그램지 (레인보우)',   'Holographic Film (Rainbow)',  0,    true,  1),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'paper_code', 'STK_HLG2', '홀로그램지 (실버별)',     'Holographic Film (Star)',     3000, false, 2),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'paper_code', 'STK_HLG3', '홀로그램지 (금색)',       'Holographic Film (Gold)',     3000, false, 3),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'print_color_type', 'SPD10', '단면 컬러', 'Single-sided Color', 0, true, 1),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'paper_qty', '100',  '100매',  '100 pcs',   0,     true,  1),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'paper_qty', '200',  '200매',  '200 pcs',   18000, false, 2),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'paper_qty', '500',  '500매',  '500 pcs',   38000, false, 3),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290', 'paper_qty', '1000', '1000매', '1,000 pcs', 65000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 크라프트 스티커 (kraft-stickers)  base=14000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('ef6889ac-c371-462d-b493-d87ed2e7d7cd', 'paper_code', 'STK080KF0', '크라프트지 80g',           'Kraft Paper 80gsm',         0,    true,  1),
('ef6889ac-c371-462d-b493-d87ed2e7d7cd', 'paper_code', 'STK100KF0', '크라프트지 100g (두꺼운)', 'Kraft Paper 100gsm (thick)',  2000, false, 2),
('ef6889ac-c371-462d-b493-d87ed2e7d7cd', 'print_color_type', 'SPD10', '단면 컬러', 'Single-sided Color', 0, true, 1),
('ef6889ac-c371-462d-b493-d87ed2e7d7cd', 'paper_qty', '100',  '100매',  '100 pcs',   0,     true,  1),
('ef6889ac-c371-462d-b493-d87ed2e7d7cd', 'paper_qty', '500',  '500매',  '500 pcs',   12000, false, 2),
('ef6889ac-c371-462d-b493-d87ed2e7d7cd', 'paper_qty', '1000', '1000매', '1,000 pcs', 20000, false, 3),
('ef6889ac-c371-462d-b493-d87ed2e7d7cd', 'paper_qty', '2000', '2000매', '2,000 pcs', 32000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 롤 스티커 (roll-stickers)  base=35000  → Swadpia CST7000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'paper_code', 'STK075AT0', '아트지 75g (롤)',   'Art Paper 75gsm (Roll)',       0,    true,  1),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'paper_code', 'STK080YP0', '유포지 80µm (롤)', 'Vinyl Film 80µm (Roll)',        3000, false, 2),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'print_color_type', 'SPD10', '단면 컬러',          'Single-sided Color',      0,    true,  1),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'print_color_type', 'SPD20', '단면 컬러 + UV코팅', 'Single-sided + UV Coat',  3000, false, 2),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'paper_qty', '500',  '500매',  '500 pcs',   0,     true,  1),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'paper_qty', '1000', '1000매', '1,000 pcs', 28000, false, 2),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'paper_qty', '2000', '2000매', '2,000 pcs', 50000, false, 3),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362', 'paper_qty', '3000', '3000매', '3,000 pcs', 68000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5. 라벨 스티커 (Swadpia CLP1000, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 가격 라벨 (price-labels)  base=8000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_code', 'LBL075AT0', '반광 아트지 75g',   'Semi-gloss Art 75gsm',  0,    true,  1),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_code', 'LBL080WP0', '방수 유포지 80µm', 'Waterproof Vinyl 80µm', 2000, false, 2),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_size', 'SZ25X30', '25×30mm',  '25×30mm',   0,    true,  1),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_size', 'SZ30X40', '30×40mm',  '30×40mm',   1000, false, 2),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_size', 'SZ40X50', '40×50mm',  '40×50mm',   2000, false, 3),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_qty', '1000',  '1,000매',  '1,000 pcs',  0,     true,  1),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_qty', '2000',  '2,000매',  '2,000 pcs',  5000,  false, 2),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_qty', '5000',  '5,000매',  '5,000 pcs',  15000, false, 3),
('cdd21533-9483-4baa-938f-83e11d465b79', 'paper_qty', '10000', '10,000매', '10,000 pcs', 25000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 바코드 라벨 (barcode-labels)  base=10000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_code', 'LBL080AT0', '아트지 80g',     'Art Paper 80gsm',        0,    true,  1),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_code', 'LBL060TH0', '감열지 60g',     'Thermal Paper 60gsm',    -2000, false, 2),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_size', 'SZ40X25', '40×25mm',  '40×25mm',  0,    true,  1),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_size', 'SZ50X30', '50×30mm',  '50×30mm',  1000, false, 2),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_size', 'SZ70X40', '70×40mm',  '70×40mm',  2000, false, 3),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_qty', '1000',  '1,000매',  '1,000 pcs',  0,     true,  1),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_qty', '2000',  '2,000매',  '2,000 pcs',  7000,  false, 2),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_qty', '5000',  '5,000매',  '5,000 pcs',  18000, false, 3),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79', 'paper_qty', '10000', '10,000매', '10,000 pcs', 30000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 식품 라벨 (food-labels)  base=12000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_code', 'LBL080WA0', '방수 무광 80µm', 'Waterproof Matte 80µm',  0,    true,  1),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_code', 'LBL080WG0', '방수 유광 80µm', 'Waterproof Gloss 80µm',  2000, false, 2),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_size', 'SZ40X60', '40×60mm',  '40×60mm',   0,    true,  1),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_size', 'SZ60X80', '60×80mm',  '60×80mm',   2000, false, 2),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_size', 'SZ80X100','80×100mm', '80×100mm',  4000, false, 3),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_qty', '500',  '500매',   '500 pcs',    0,     true,  1),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_qty', '1000', '1,000매', '1,000 pcs',  8000,  false, 2),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_qty', '3000', '3,000매', '3,000 pcs',  22000, false, 3),
('39cc1116-0216-419f-ada6-0ca46d8ffb11', 'paper_qty', '5000', '5,000매', '5,000 pcs',  35000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 6. 리플렛 & 책자 (Swadpia CPR3000/CPR4000, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 리플렛 (leaflets)  base=45000  → Swadpia CPR3000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_code', 'ART090W00', '아트지 90g',  'Art Coated 90gsm',   0,    true,  1),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_code', 'ART120W00', '아트지 120g', 'Art Coated 120gsm',  5000, false, 2),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_code', 'ART150W00', '아트지 150g', 'Art Coated 150gsm',  8000, false, 3),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_size', 'A0400', 'A4 3단접지 (210×297mm)', 'A4 Trifold (210×297mm)',  0,     true,  1),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_size', 'A0500', 'A5 (148×210mm)',          'A5 (148×210mm)',          -5000, false, 2),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_qty', '1000',  '1,000매',  '1,000 pcs',  0,     true,  1),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_qty', '2000',  '2,000매',  '2,000 pcs',  20000, false, 2),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_qty', '5000',  '5,000매',  '5,000 pcs',  50000, false, 3),
('17198d31-4264-4cbb-8a06-44b550bf08f0', 'paper_qty', '10000', '10,000매', '10,000 pcs', 90000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 중철 책자 (saddle-stitch-booklet)  base=64000  → Swadpia CPR4000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_code', 'ART090W00', '아트지 90g (내지)', 'Art Coated 90gsm (inner)',   0,    true,  1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_code', 'ART120W00', '아트지 120g (내지)','Art Coated 120gsm (inner)',  5000, false, 2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'pages',      '16p',  '16페이지', '16 pages',  0,     true,  1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'pages',      '24p',  '24페이지', '24 pages',  15000, false, 2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'pages',      '32p',  '32페이지', '32 pages',  30000, false, 3),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_size', 'A0400', 'A4 (210×297mm)', 'A4 (210×297mm)',  0,     true,  1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_size', 'A0500', 'A5 (148×210mm)', 'A5 (148×210mm)', -5000, false, 2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_qty', '100',  '100권',  '100 pcs',  0,     true,  1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_qty', '300',  '300권',  '300 pcs',  40000, false, 2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_qty', '500',  '500권',  '500 pcs',  70000, false, 3),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', 'paper_qty', '1000', '1000권', '1,000 pcs',120000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 무선제본 책자 (perfect-bound-booklet)  base=95000  → Swadpia CPR4000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'paper_code', 'ART090W00', '아트지 90g (내지)', 'Art Coated 90gsm (inner)',   0,    true,  1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'paper_code', 'ART150W00', '아트지 150g (내지)','Art Coated 150gsm (inner)',  8000, false, 2),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'pages',      '48p',  '48페이지', '48 pages',   0,     true,  1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'pages',      '64p',  '64페이지', '64 pages',   20000, false, 2),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'pages',      '96p',  '96페이지', '96 pages',   45000, false, 3),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'paper_size', 'A0400', 'A4 (210×297mm)', 'A4 (210×297mm)', 0, true, 1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'paper_qty', '100',  '100권',  '100 pcs',  0,     true,  1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'paper_qty', '200',  '200권',  '200 pcs',  70000, false, 2),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'paper_qty', '300',  '300권',  '300 pcs',  120000,false, 3),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce', 'paper_qty', '500',  '500권',  '500 pcs',  185000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 카탈로그 (catalogs)  base=120000  → Swadpia CPR4000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'paper_code', 'ART100W00', '아트지 100g (내지)', 'Art Coated 100gsm (inner)',  0,    true,  1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'paper_code', 'ART150W00', '아트지 150g (내지)', 'Art Coated 150gsm (inner)', 10000, false, 2),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'pages',      '32p',  '32페이지', '32 pages',   0,     true,  1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'pages',      '48p',  '48페이지', '48 pages',   25000, false, 2),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'pages',      '64p',  '64페이지', '64 pages',   50000, false, 3),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'paper_size', 'A0400', 'A4 (210×297mm)', 'A4 (210×297mm)', 0, true, 1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'paper_qty', '100',  '100권',  '100 pcs',   0,     true,  1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'paper_qty', '200',  '200권',  '200 pcs',   90000, false, 2),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'paper_qty', '500',  '500권',  '500 pcs',   200000,false, 3),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6', 'paper_qty', '1000', '1000권', '1,000 pcs', 360000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 메뉴판 (menus)  base=55000  → Swadpia CLF2000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_code', 'ART150W00', '아트지 150g', 'Art Coated 150gsm',  0,    true,  1),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_code', 'ART180W00', '아트지 180g', 'Art Coated 180gsm',  5000, false, 2),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_size', 'A0400', 'A4 (210×297mm)', 'A4 (210×297mm)',  0,     true,  1),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_size', 'A0300', 'A3 (297×420mm)', 'A3 (297×420mm)',  10000, false, 2),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_qty', '100',  '100부',  '100 pcs',  0,     true,  1),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_qty', '200',  '200부',  '200 pcs',  35000, false, 2),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_qty', '500',  '500부',  '500 pcs',  80000, false, 3),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb', 'paper_qty', '1000', '1000부', '1,000 pcs',140000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 7. 봉투 (Swadpia CEV1000, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 일반 봉투 (standard-envelopes)  base=28000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_code', 'ENV120W00', '아트지 120g', 'Art Coated 120gsm',   0,    true,  1),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_code', 'ENV120K00', '크라프트 120g','Kraft 120gsm',       3000, false, 2),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_size', 'EVS1', 'DL (110×220mm)', 'DL (110×220mm)',  0,    true,  1),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_size', 'EVS2', 'C5 (162×229mm)', 'C5 (162×229mm)',  5000, false, 2),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_size', 'EVS3', 'B5 (182×257mm)', 'B5 (182×257mm)',  8000, false, 3),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_qty', '500',  '500매',  '500 pcs',  0,     true,  1),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_qty', '1000', '1000매', '1,000 pcs',18000, false, 2),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_qty', '2000', '2000매', '2,000 pcs',30000, false, 3),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f', 'paper_qty', '5000', '5000매', '5,000 pcs',60000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 사무 봉투 (admin-envelopes)  base=32000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_code', 'ENV120W00', '아트지 120g',  'Art Coated 120gsm',  0,    true,  1),
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_code', 'ENV150W00', '아트지 150g',  'Art Coated 150gsm',  5000, false, 2),
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_size', 'EVS4', '사무봉투 소 (B6, 120×235mm)', 'Admin Small (B6)',  0,    true,  1),
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_size', 'EVS5', '사무봉투 대 (B4, 250×353mm)', 'Admin Large (B4)',  8000, false, 2),
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_qty', '500',  '500매',  '500 pcs',  0,     true,  1),
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_qty', '1000', '1000매', '1,000 pcs',20000, false, 2),
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_qty', '2000', '2000매', '2,000 pcs',35000, false, 3),
('85c1850a-fa64-496c-abcc-895038c3277d', 'paper_qty', '5000', '5000매', '5,000 pcs',70000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 각대봉투 (gusset-envelopes)  base=48000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('ba1a1416-8454-450b-887e-cd2516848eba', 'paper_code', 'ENV120K00', '크라프트 120g',   'Kraft 120gsm',   0,    true,  1),
('ba1a1416-8454-450b-887e-cd2516848eba', 'paper_code', 'ENV120W00', '아트지 120g',     'Art Coated 120gsm', 3000, false, 2),
('ba1a1416-8454-450b-887e-cd2516848eba', 'paper_size', 'EVG1', 'A4 각대봉투 (22×31cm)', 'A4 Gusset (22×31cm)', 0, true, 1),
('ba1a1416-8454-450b-887e-cd2516848eba', 'paper_qty', '200',  '200매',  '200 pcs',  0,     true,  1),
('ba1a1416-8454-450b-887e-cd2516848eba', 'paper_qty', '500',  '500매',  '500 pcs',  28000, false, 2),
('ba1a1416-8454-450b-887e-cd2516848eba', 'paper_qty', '1000', '1000매', '1,000 pcs',55000, false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 8. 서식/양식 (Swadpia CNR2000, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 영수증 (receipts)  base=25000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', 'paper_code', 'NR080W00', '백상지 80g', 'Bond Paper 80gsm',  0, true, 1),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', 'paper_size', 'NRS1', 'A6 (105×148mm)',   'A6 (105×148mm)',  0,     true,  1),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', 'paper_size', 'NRS2', 'A5 (148×210mm)',   'A5 (148×210mm)',  5000,  false, 2),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', 'paper_qty', '500',  '500매',  '500 pcs',  0,     true,  1),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', 'paper_qty', '1000', '1000매', '1,000 pcs',15000, false, 2),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', 'paper_qty', '2000', '2000매', '2,000 pcs',28000, false, 3),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', 'paper_qty', '5000', '5000매', '5,000 pcs',55000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 견적서 (quotation-forms)  base=30000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('d18906bc-b840-48b4-afe6-97e744433057', 'paper_code', 'NR080W00', '백상지 80g', 'Bond Paper 80gsm',  0, true, 1),
('d18906bc-b840-48b4-afe6-97e744433057', 'paper_size', 'NRS2', 'A4 (210×297mm)', 'A4 (210×297mm)',  0, true, 1),
('d18906bc-b840-48b4-afe6-97e744433057', 'paper_qty', '500',  '500매',  '500 pcs',  0,     true,  1),
('d18906bc-b840-48b4-afe6-97e744433057', 'paper_qty', '1000', '1000매', '1,000 pcs',18000, false, 2),
('d18906bc-b840-48b4-afe6-97e744433057', 'paper_qty', '2000', '2000매', '2,000 pcs',32000, false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 거래명세서 (invoice-forms)  base=30000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('4480d72b-6047-4960-9984-13b5d922e27c', 'paper_code', 'NR080W00', '백상지 80g', 'Bond Paper 80gsm',  0, true, 1),
('4480d72b-6047-4960-9984-13b5d922e27c', 'paper_size', 'NRS2', 'A4 (210×297mm)', 'A4 (210×297mm)',  0, true, 1),
('4480d72b-6047-4960-9984-13b5d922e27c', 'paper_qty', '500',  '500매',  '500 pcs',  0,     true,  1),
('4480d72b-6047-4960-9984-13b5d922e27c', 'paper_qty', '1000', '1000매', '1,000 pcs',18000, false, 2),
('4480d72b-6047-4960-9984-13b5d922e27c', 'paper_qty', '2000', '2000매', '2,000 pcs',32000, false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 복사식 양식 (ncr-forms)  base=55000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('0e4935b6-bf26-4484-a25b-1d50658d0de5', 'paper_code', 'NCR2P', '2부식 (원본+사본)',   'NCR 2-Part (Original + Copy)',   0,    true,  1),
('0e4935b6-bf26-4484-a25b-1d50658d0de5', 'paper_code', 'NCR3P', '3부식 (원본+사본2장)','NCR 3-Part (Original + 2 Copies)',8000, false, 2),
('0e4935b6-bf26-4484-a25b-1d50658d0de5', 'paper_size', 'NRS2', 'A4 (210×297mm)', 'A4 (210×297mm)', 0, true, 1),
('0e4935b6-bf26-4484-a25b-1d50658d0de5', 'paper_qty', '100',  '100세트', '100 sets',  0,     true,  1),
('0e4935b6-bf26-4484-a25b-1d50658d0de5', 'paper_qty', '200',  '200세트', '200 sets',  40000, false, 2),
('0e4935b6-bf26-4484-a25b-1d50658d0de5', 'paper_qty', '500',  '500세트', '500 sets',  90000, false, 3),
('0e4935b6-bf26-4484-a25b-1d50658d0de5', 'paper_qty', '1000', '1000세트','1,000 sets',160000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 9. 박스 (DB 기반, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 일반 박스 (general-boxes)  base=85000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'paper', 'B1', '아트지 350g (단면)', 'Art 350gsm (Single-sided)', 0,    true,  1),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'paper', 'B2', '아트지 350g (양면)', 'Art 350gsm (Double-sided)', 8000, false, 2),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'size',  'S1', '소 (100×80×50mm)',   'Small (100×80×50mm)',        0,    true,  1),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'size',  'S2', '중 (200×150×80mm)',  'Medium (200×150×80mm)',      10000,false, 2),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'size',  'S3', '대 (300×200×150mm)', 'Large (300×200×150mm)',      25000,false, 3),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'quantity', '100',  '100개',  '100 pcs',   0,     true,  1),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'quantity', '200',  '200개',  '200 pcs',   65000, false, 2),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'quantity', '500',  '500개',  '500 pcs',   160000,false, 3),
('fd74abb5-bb0d-42b1-9773-6c137ff135b9', 'quantity', '1000', '1000개', '1,000 pcs', 280000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 골판지 박스 (corrugated-boxes)  base=120000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'paper', 'CB1', '2겹 골판지 (경량)', 'Single-wall Corrugated (Light)',  0,    true,  1),
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'paper', 'CB2', '3겹 골판지 (강화)', 'Double-wall Corrugated (Strong)', 15000,false, 2),
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'size',  'S1', '소 (200×150×100mm)', 'Small (200×150×100mm)',  0,    true,  1),
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'size',  'S2', '중 (300×200×150mm)', 'Medium (300×200×150mm)', 20000,false, 2),
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'size',  'S3', '대 (400×300×200mm)', 'Large (400×300×200mm)',  40000,false, 3),
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'quantity', '100',  '100개',  '100 pcs',   0,     true,  1),
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'quantity', '200',  '200개',  '200 pcs',   90000, false, 2),
('d70a85f8-b53c-49c8-90f1-5e21f2e724a0', 'quantity', '500',  '500개',  '500 pcs',   220000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 선물 박스 (gift-boxes)  base=180000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'paper', 'GB1', '아트지 350g + 무광라미', 'Art 350gsm + Matte Lami',  0,    true,  1),
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'paper', 'GB2', '아트지 350g + 소프트터치', 'Art 350gsm + Soft Touch', 12000,false, 2),
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'size',  'S1', '소 (150×100×50mm)',  'Small (150×100×50mm)',   0,    true,  1),
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'size',  'S2', '중 (220×150×80mm)',  'Medium (220×150×80mm)',  20000,false, 2),
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'size',  'S3', '대 (300×220×120mm)', 'Large (300×220×120mm)',  45000,false, 3),
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'quantity', '100',  '100개',  '100 pcs',   0,     true,  1),
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'quantity', '200',  '200개',  '200 pcs',   140000,false, 2),
('8eb54a85-bb3d-4f45-8ea8-0bfa4bf519f6', 'quantity', '500',  '500개',  '500 pcs',   350000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 케이크 박스 (cake-boxes)  base=95000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('fa593833-9277-4c04-8c71-e1ae17dc9c10', 'paper', 'CKB1', '식품용 화이트 아트지', 'Food-safe White Art Paper',  0, true, 1),
('fa593833-9277-4c04-8c71-e1ae17dc9c10', 'size',  'S1', '미니 (150×150×100mm)', 'Mini Cake (150×150×100mm)',     0,    true,  1),
('fa593833-9277-4c04-8c71-e1ae17dc9c10', 'size',  'S2', '1호 (180×180×120mm)',  '1-tier (180×180×120mm)',        10000,false, 2),
('fa593833-9277-4c04-8c71-e1ae17dc9c10', 'size',  'S3', '2호 (200×200×150mm)',  '2-tier (200×200×150mm)',        20000,false, 3),
('fa593833-9277-4c04-8c71-e1ae17dc9c10', 'quantity', '100',  '100개',  '100 pcs',  0,     true,  1),
('fa593833-9277-4c04-8c71-e1ae17dc9c10', 'quantity', '200',  '200개',  '200 pcs',  75000, false, 2),
('fa593833-9277-4c04-8c71-e1ae17dc9c10', 'quantity', '500',  '500개',  '500 pcs',  185000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 원통 박스 (tube-boxes)  base=150000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('0ca3945f-9795-4784-b391-3386530afda7', 'paper', 'TB1', '두꺼운 판지 + 무광라미', 'Heavy Cardboard + Matte Lami', 0, true, 1),
('0ca3945f-9795-4784-b391-3386530afda7', 'size',  'S1', '소 (Ø60×120mm)',  'Small (Ø60×120mm)',   0,     true,  1),
('0ca3945f-9795-4784-b391-3386530afda7', 'size',  'S2', '중 (Ø80×180mm)',  'Medium (Ø80×180mm)',  20000, false, 2),
('0ca3945f-9795-4784-b391-3386530afda7', 'size',  'S3', '대 (Ø100×250mm)', 'Large (Ø100×250mm)',  40000, false, 3),
('0ca3945f-9795-4784-b391-3386530afda7', 'quantity', '100',  '100개',  '100 pcs',   0,     true,  1),
('0ca3945f-9795-4784-b391-3386530afda7', 'quantity', '200',  '200개',  '200 pcs',   115000,false, 2),
('0ca3945f-9795-4784-b391-3386530afda7', 'quantity', '500',  '500개',  '500 pcs',   285000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 10. 쇼핑백 (DB 기반, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 종이 쇼핑백 (paper-shopping-bags)  base=110000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'paper', 'PB1', '아트지 150g + 무광라미', 'Art 150gsm + Matte Lami',  0,    true,  1),
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'paper', 'PB2', '아트지 150g + 유광라미', 'Art 150gsm + Gloss Lami',  3000, false, 2),
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'size',  'S1', '소 (180×80×220mm)',  'Small (W180×D80×H220mm)',  0,    true,  1),
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'size',  'S2', '중 (240×100×280mm)', 'Medium (W240×D100×H280mm)',15000,false, 2),
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'size',  'S3', '대 (320×120×350mm)', 'Large (W320×D120×H350mm)', 30000,false, 3),
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'quantity', '100',  '100개',  '100 pcs',   0,     true,  1),
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'quantity', '200',  '200개',  '200 pcs',   85000, false, 2),
('71961062-76ed-47f8-91b7-6e86ffaa78d7', 'quantity', '500',  '500개',  '500 pcs',   210000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 크라프트 쇼핑백 (kraft-bags)  base=95000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'paper', 'KB1', '천연 크라프트지 100g', 'Natural Kraft 100gsm',  0,    true,  1),
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'paper', 'KB2', '컬러 크라프트지 100g', 'Color Kraft 100gsm',    5000, false, 2),
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'size',  'S1', '소 (180×80×220mm)',  'Small',  0,     true,  1),
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'size',  'S2', '중 (240×100×280mm)', 'Medium', 10000, false, 2),
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'size',  'S3', '대 (320×120×350mm)', 'Large',  20000, false, 3),
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'quantity', '100',  '100개',  '100 pcs',   0,     true,  1),
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'quantity', '200',  '200개',  '200 pcs',   72000, false, 2),
('f720a9f1-32a1-49ff-a5ad-9f6a8c2850a8', 'quantity', '500',  '500개',  '500 pcs',   175000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 선물 쇼핑백 (gift-bags)  base=145000 (100개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'paper', 'GB1', '아트지 180g + 소프트터치라미', 'Art 180gsm + Soft Touch',  0,    true,  1),
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'paper', 'GB2', '아트지 180g + UV코팅',         'Art 180gsm + UV Coating', 10000, false, 2),
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'size',  'S1', '소 (180×80×220mm)',  'Small',  0,     true,  1),
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'size',  'S2', '중 (240×100×280mm)', 'Medium', 20000, false, 2),
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'size',  'S3', '대 (320×120×350mm)', 'Large',  40000, false, 3),
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'quantity', '100',  '100개',  '100 pcs',   0,     true,  1),
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'quantity', '200',  '200개',  '200 pcs',   110000,false, 2),
('a3a16047-9556-40f0-8539-6ea9c5ba2599', 'quantity', '500',  '500개',  '500 pcs',   275000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 11. 노트/다이어리 (DB 기반, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 일반 노트 (general-notebooks)  base=65000 (50권 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('5faf9a39-6dc5-427b-9797-79150149b87f', 'paper', 'NB1', '아트지 100g 내지 + 무광 표지',  'Art 100gsm inner + Matte cover',  0,    true,  1),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'paper', 'NB2', '아트지 100g 내지 + 소프트터치', 'Art 100gsm inner + Soft Touch',   8000, false, 2),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'size',  'S1', 'A5 (148×210mm)', 'A5 (148×210mm)',  0,    true,  1),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'size',  'S2', 'A4 (210×297mm)', 'A4 (210×297mm)',  10000,false, 2),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'pages', '64p',  '64페이지 내지', '64 inner pages',  0,    true,  1),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'pages', '96p',  '96페이지 내지', '96 inner pages',  10000,false, 2),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'pages', '128p', '128페이지 내지','128 inner pages', 20000,false, 3),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'quantity', '50',  '50권',  '50 pcs',  0,     true,  1),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'quantity', '100', '100권', '100 pcs', 50000, false, 2),
('5faf9a39-6dc5-427b-9797-79150149b87f', 'quantity', '200', '200권', '200 pcs', 115000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 다이어리 (diaries)  base=95000 (50권 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'paper', 'DR1', '유포지 표지 + 아트지 내지', 'PVC cover + Art inner',       0,    true,  1),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'paper', 'DR2', '가죽질감 표지 + 크림지 내지', 'Leatherette cover + Cream',  15000,false, 2),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'size',  'S1', 'A5 (148×210mm)', 'A5 (148×210mm)',  0,    true,  1),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'size',  'S2', 'A4 (210×297mm)', 'A4 (210×297mm)',  15000,false, 2),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'pages', '192p', '192페이지 (6개월)', '192 pages (6 months)',  0,    true,  1),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'pages', '368p', '368페이지 (12개월)','368 pages (12 months)', 25000,false, 2),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'quantity', '50',  '50권',  '50 pcs',  0,     true,  1),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'quantity', '100', '100권', '100 pcs', 75000, false, 2),
('d3a4ddc1-2ada-4703-ab23-bce5bd47201a', 'quantity', '200', '200권', '200 pcs', 170000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 스프링 노트 (spring-notebooks)  base=75000 (50권 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'paper', 'SN1', '아트지 100g 내지 + 아트지 표지', 'Art 100gsm inner + Art cover',    0,    true,  1),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'paper', 'SN2', '아트지 100g 내지 + 소프트터치',   'Art 100gsm inner + Soft Touch',  8000, false, 2),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'size',  'S1', 'A5 (148×210mm)', 'A5 (148×210mm)',  0,    true,  1),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'size',  'S2', 'A4 (210×297mm)', 'A4 (210×297mm)',  12000,false, 2),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'pages', '80p',  '80페이지',  '80 pages',   0,    true,  1),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'pages', '120p', '120페이지', '120 pages',  12000,false, 2),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'quantity', '50',  '50권',  '50 pcs',  0,     true,  1),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'quantity', '100', '100권', '100 pcs', 58000, false, 2),
('ab118cff-df9c-469c-ad5f-7157edbda82f', 'quantity', '200', '200권', '200 pcs', 130000,false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 12. 메모패드 & 스티커메모 (DB 기반, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 메모패드 (memo-pads-general)  base=25000 (50권 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('a3cb8e4a-60e9-4506-90a9-8477211140f7', 'paper', 'MP1', '미색모조지 80g (50매 패드)', 'Bond 80gsm (50 sheets/pad)',  0,    true,  1),
('a3cb8e4a-60e9-4506-90a9-8477211140f7', 'paper', 'MP2', '아트지 90g (50매 패드)',     'Art 90gsm (50 sheets/pad)',   3000, false, 2),
('a3cb8e4a-60e9-4506-90a9-8477211140f7', 'size',  'S1', 'A6 (105×148mm)', 'A6 (105×148mm)',  0,    true,  1),
('a3cb8e4a-60e9-4506-90a9-8477211140f7', 'size',  'S2', 'A5 (148×210mm)', 'A5 (148×210mm)',  5000, false, 2),
('a3cb8e4a-60e9-4506-90a9-8477211140f7', 'quantity', '50',  '50권',  '50 pads',  0,     true,  1),
('a3cb8e4a-60e9-4506-90a9-8477211140f7', 'quantity', '100', '100권', '100 pads', 20000, false, 2),
('a3cb8e4a-60e9-4506-90a9-8477211140f7', 'quantity', '200', '200권', '200 pads', 40000, false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 스티커 메모 (sticky-notes)  base=35000 (50권 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('a5f62e10-a853-4df6-8b49-e7e1e1c78b02', 'paper', 'SN1', '점착 메모지 75g (50매)', 'Sticky Note 75gsm (50 sheets)', 0, true, 1),
('a5f62e10-a853-4df6-8b49-e7e1e1c78b02', 'size',  'S1', '75×75mm', '75×75mm (Square)',  0,    true,  1),
('a5f62e10-a853-4df6-8b49-e7e1e1c78b02', 'size',  'S2', '75×100mm','75×100mm',          3000, false, 2),
('a5f62e10-a853-4df6-8b49-e7e1e1c78b02', 'size',  'S3', '100×150mm','100×150mm (Large)',6000, false, 3),
('a5f62e10-a853-4df6-8b49-e7e1e1c78b02', 'quantity', '50',  '50권',  '50 pads',  0,     true,  1),
('a5f62e10-a853-4df6-8b49-e7e1e1c78b02', 'quantity', '100', '100권', '100 pads', 28000, false, 2),
('a5f62e10-a853-4df6-8b49-e7e1e1c78b02', 'quantity', '200', '200권', '200 pads', 60000, false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 13. 캘린더 (Swadpia CCD1000/CCD2000, 3.3x)
--     base는 장당 가격이므로 수량 옵션으로 조절
-- ─────────────────────────────────────────────────────────────

-- 벽걸이 달력 (wall-calendars)  base=8000 (1부 도매가)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_code', 'CCD150G00', '스노우지 150g (그림)', 'Snow 150gsm (Calendar)',  0,    true,  1),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_code', 'CCD200G00', '아트지 200g (고급)',   'Art 200gsm (Premium)',    5000, false, 2),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_size', 'CDS1', 'A3 (297×420mm)', 'A3 (297×420mm)', 0,    true,  1),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_size', 'CDS2', 'A2 (420×594mm)', 'A2 (420×594mm)', 5000, false, 2),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_qty', '50',  '50부',  '50 pcs',  0,     true,  1),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_qty', '100', '100부', '100 pcs', 6000,  false, 2),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_qty', '200', '200부', '200 pcs', 18000, false, 3),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f', 'paper_qty', '500', '500부', '500 pcs', 50000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 탁상 달력 (desk-calendars)  base=6500 (1부 도매가)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_code', 'CCD120G00', '아트지 120g', 'Art 120gsm',  0,    true,  1),
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_code', 'CCD150G00', '아트지 150g', 'Art 150gsm',  3000, false, 2),
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_size', 'CDS3', 'A5 스탠딩 (148×210mm)', 'A5 Standing (148×210mm)', 0,    true,  1),
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_size', 'CDS4', 'A4 스탠딩 (210×297mm)', 'A4 Standing (210×297mm)', 3000, false, 2),
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_qty', '50',  '50부',  '50 pcs',  0,     true,  1),
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_qty', '100', '100부', '100 pcs', 5000,  false, 2),
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_qty', '200', '200부', '200 pcs', 14000, false, 3),
('e1a545b2-4db9-4a72-921e-8125901f8c97', 'paper_qty', '500', '500부', '500 pcs', 38000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 미니 달력 (mini-calendars)  base=4500 (1부 도매가)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('6095f57c-c4c6-435c-bedb-9b82b852b9da', 'paper_code', 'CCD120G00', '아트지 120g', 'Art 120gsm', 0, true, 1),
('6095f57c-c4c6-435c-bedb-9b82b852b9da', 'paper_size', 'CDS5', 'A6 미니 (105×148mm)', 'A6 Mini (105×148mm)', 0, true, 1),
('6095f57c-c4c6-435c-bedb-9b82b852b9da', 'paper_qty', '100',  '100부',  '100 pcs',   0,     true,  1),
('6095f57c-c4c6-435c-bedb-9b82b852b9da', 'paper_qty', '200',  '200부',  '200 pcs',   3500,  false, 2),
('6095f57c-c4c6-435c-bedb-9b82b852b9da', 'paper_qty', '500',  '500부',  '500 pcs',   10000, false, 3),
('6095f57c-c4c6-435c-bedb-9b82b852b9da', 'paper_qty', '1000', '1000부', '1,000 pcs', 22000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 14. X배너 / 롤업배너 / 미니배너 (Swadpia CPR5000)
-- ─────────────────────────────────────────────────────────────

-- X배너 (x-banners)  base=32000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_code', 'BNR510W00', '배너 출력지 510g', 'Banner Print 510gsm',  0, true, 1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_size', 'XBS1', '60×160cm (표준)', '60×160cm (Standard)',  0,     true,  1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_size', 'XBS2', '80×180cm',        '80×180cm',             5000,  false, 2),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_qty', '1',  '1장',  '1 pc',   0,     true,  1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_qty', '2',  '2장',  '2 pcs',  28000, false, 2),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_qty', '3',  '3장',  '3 pcs',  55000, false, 3),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_qty', '5',  '5장',  '5 pcs',  88000, false, 4),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_qty', '10', '10장', '10 pcs', 165000,false, 5)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 롤업배너 (rollup-banners)  base=48000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_code', 'BNR510W00', '배너 출력지 510g', 'Banner Print 510gsm',  0, true, 1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_size', 'RBS1', '80×200cm (표준)', '80×200cm (Standard)',  0,     true,  1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_size', 'RBS2', '100×200cm',       '100×200cm',            8000,  false, 2),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_qty', '1',  '1장',  '1 pc',   0,     true,  1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_qty', '2',  '2장',  '2 pcs',  42000, false, 2),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_qty', '3',  '3장',  '3 pcs',  82000, false, 3),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_qty', '5',  '5장',  '5 pcs',  128000,false, 4),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_qty', '10', '10장', '10 pcs', 240000,false, 5)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 미니배너 (mini-banners)  base=18000
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_code', 'BNR510W00', '배너 출력지 510g', 'Banner Print 510gsm',  0, true, 1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_size', 'MBS1', '40×120cm (소)',  '40×120cm (Small)',  0,    true,  1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_size', 'MBS2', '60×160cm (중)',  '60×160cm (Medium)', 8000, false, 2),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_qty', '1',  '1장',  '1 pc',   0,     true,  1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_qty', '2',  '2장',  '2 pcs',  15000, false, 2),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_qty', '3',  '3장',  '3 pcs',  28000, false, 3),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_qty', '5',  '5장',  '5 pcs',  45000, false, 4),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_qty', '10', '10장', '10 pcs', 85000, false, 5)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 15. POP 디스플레이 (DB 기반, 3.3x)
-- ─────────────────────────────────────────────────────────────

-- 종이 POP (paper-pop)  base=28000 (10개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'paper', 'PP1', '아트지 250g + 유광라미', 'Art 250gsm + Gloss Lami',   0,    true,  1),
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'paper', 'PP2', '아트지 250g + 무광라미', 'Art 250gsm + Matte Lami',   3000, false, 2),
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'size',  'S1', 'A4 (210×297mm)', 'A4 (210×297mm)',  0,    true,  1),
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'size',  'S2', 'A3 (297×420mm)', 'A3 (297×420mm)',  8000, false, 2),
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'quantity', '10',  '10개',  '10 pcs',  0,     true,  1),
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'quantity', '30',  '30개',  '30 pcs',  50000, false, 2),
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'quantity', '50',  '50개',  '50 pcs',  90000, false, 3),
('81fb45c5-2fe7-4b56-92ff-551fc5889cca', 'quantity', '100', '100개', '100 pcs', 165000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- 폼보드 POP (foam-pop)  base=42000 (10개 기준)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'paper', 'FP1', '5mm 폼보드 (인쇄 전사)', 'Foam Board 5mm (printed)',  0,    true,  1),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'paper', 'FP2', '10mm 폼보드 (강화)',      'Foam Board 10mm (heavy)',   8000, false, 2),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'size',  'S1', 'A4 (210×297mm)', 'A4 (210×297mm)',  0,    true,  1),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'size',  'S2', 'A3 (297×420mm)', 'A3 (297×420mm)',  10000,false, 2),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'size',  'S3', 'A2 (420×594mm)', 'A2 (420×594mm)',  22000,false, 3),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'quantity', '5',   '5개',   '5 pcs',   0,     true,  1),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'quantity', '10',  '10개',  '10 pcs',  35000, false, 2),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'quantity', '20',  '20개',  '20 pcs',  78000, false, 3),
('1758101e-334d-42d7-9fb9-7ccee551e1fc', 'quantity', '50',  '50개',  '50 pcs',  168000,false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 검증: 이 마이그레이션 후 옵션 없는 활성 제품 수 = 0 이어야 함
-- ─────────────────────────────────────────────────────────────
-- SELECT p.slug, COUNT(o.id) as cnt
-- FROM print_products p
-- LEFT JOIN print_product_options o ON o.product_id = p.id
-- WHERE p.is_active = true
-- GROUP BY p.slug
-- HAVING COUNT(o.id) = 0;
