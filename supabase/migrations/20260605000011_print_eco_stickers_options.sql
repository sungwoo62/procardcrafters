-- ============================================================
-- 친환경 스티커(eco-stickers) 옵션 시드
-- sample-pack 단일 수량 옵션 추가
--
-- 배경: 20260603000009_print_catalog_overhaul.sql 이 제품 row 는
--   추가했으나 옵션 INSERT 는 없었음 → options.length = 0 → Quote 버튼.
-- eco-stickers 는 swadpia 미연동(FSC 재활용지) → 표준 option_type 사용.
-- ============================================================

-- eco-stickers: 용지 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'paper', 'FSC 재활용 아트지 80g', 'FSC Recycled Art 80gsm', 'fsc_art_80', 0, TRUE, 1,
  'FSC 인증 재활용지 — 가장 가벼운 친환경 옵션'
FROM print_products p WHERE p.slug = 'eco-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'paper', 'FSC 재활용 아트지 105g', 'FSC Recycled Art 105gsm', 'fsc_art_105', 2000, FALSE, 2,
  '두꺼운 친환경 스티커 — 내구성 향상'
FROM print_products p WHERE p.slug = 'eco-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'paper', '식물성 접착 크라프트 80g', 'Plant-based Kraft 80gsm', 'kraft_80', 3000, FALSE, 3,
  '크라프트 질감 + 식물성 접착제 — 오가닉 브랜드에 적합'
FROM print_products p WHERE p.slug = 'eco-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- eco-stickers: 수량 옵션
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '100매', '100 pcs', '100', 0, TRUE, 1
FROM print_products p WHERE p.slug = 'eco-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '500매', '500 pcs', '500', 8000, FALSE, 2
FROM print_products p WHERE p.slug = 'eco-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '1000매', '1,000 pcs', '1000', 14000, FALSE, 3
FROM print_products p WHERE p.slug = 'eco-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order)
SELECT p.id, 'quantity', '2000매', '2,000 pcs', '2000', 24000, FALSE, 4
FROM print_products p WHERE p.slug = 'eco-stickers'
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- sample-pack: 단일 수량 옵션 (옵션창 노출을 위한 최소 1개)
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order, description_ko)
SELECT p.id, 'quantity', '1팩', '1 Sample Pack', '1', 0, TRUE, 1,
  '전 종이·코팅 견본 포함 — 고객당 1회 한정'
FROM print_products p WHERE p.slug = 'sample-pack'
ON CONFLICT (product_id, option_type, value) DO NOTHING;
