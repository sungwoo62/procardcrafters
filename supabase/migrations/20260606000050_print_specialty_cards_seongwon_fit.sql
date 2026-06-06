-- OMO-2485: 전체 명함 제품군 성원 카테고리 피팅
-- premium-foil-cards        → CNC3000 (Luxury 메탈 포일)
-- metallic-business-cards   → CNC3000 (Luxury 메탈릭)
-- letterpress-business-cards→ CNC4000 (아트지 300g 명함)
-- transparent-business-cards→ CNC5000 (PET 투명 명함)
-- uv-business-cards         → CNC6000 (UV 코팅 명함 11종)
-- pearl-business-cards      → CNC8000 (UV 코팅 명함 9종)
-- 기존 제품 삭제 없이 옵션만 교체.

-- ─────────────────────────────────────────────────────────────
-- 기존 잘못된 옵션 전부 삭제
-- ─────────────────────────────────────────────────────────────
DELETE FROM print_product_options
WHERE product_id IN (
  'ccca0e45-fb45-4cd4-8287-f107bb483f7f',  -- premium-foil-cards
  '1d0a37f9-d444-41a3-8ee8-ee8dff500b21',  -- metallic-business-cards
  '88399bc1-db72-4b3a-b0ae-24a338e74aac',  -- letterpress-business-cards
  '7a03a1a1-4627-4139-aa62-930f8b0df6be',  -- transparent-business-cards
  '04802355-a73d-4d57-9228-723ee56519da',  -- uv-business-cards
  '6eda2c7f-4a4f-4529-9afd-78090ac0e41b'   -- pearl-business-cards
);

-- ─────────────────────────────────────────────────────────────
-- CNC3000: premium-foil-cards (Luxury 포일/메탈 명함)
-- 종이: LUX250W0U / LUX200SVU / LUX200GDU
-- 인쇄방식: |||| (견적 문의) — print_color_type 미포함
-- ─────────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, label_en, label_ko, value, extra_price_krw, sort_order)
VALUES
  -- 종이
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_code', 'Luxury White 250μm', 'Luxury 화이트 250μm', 'LUX250W0U', 0, 10),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_code', 'Luxury Silver 200μm', 'Luxury 실버 200μm', 'LUX200SVU', 0, 20),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_code', 'Luxury Gold 200μm', 'Luxury 골드 200μm', 'LUX200GDU', 0, 30),
  -- 사이즈
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_size', '90×50mm (Standard)', '90×50mm (표준)', 'N0400', 0, 10),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_size', '86×54mm (EU Standard)', '86×54mm (유럽 표준)', 'N0300', 0, 20),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_size', '91×55mm (EU)', '91×55mm (유럽)', 'N0700', 0, 30),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_size', '85×55mm (Mini)', '85×55mm (미니)', 'N0800', 0, 40),
  -- 수량
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_qty', '200 cards', '200매', '200', 0, 10),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_qty', '400 cards', '400매', '400', 0, 20),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_qty', '600 cards', '600매', '600', 0, 30),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_qty', '800 cards', '800매', '800', 0, 40),
  ('ccca0e45-fb45-4cd4-8287-f107bb483f7f', 'paper_qty', '1,000 cards', '1000매', '1000', 0, 50);

-- ─────────────────────────────────────────────────────────────
-- CNC3000: metallic-business-cards (동일 구성)
-- ─────────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, label_en, label_ko, value, extra_price_krw, sort_order)
VALUES
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_code', 'Luxury White 250μm', 'Luxury 화이트 250μm', 'LUX250W0U', 0, 10),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_code', 'Luxury Silver 200μm', 'Luxury 실버 200μm', 'LUX200SVU', 0, 20),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_code', 'Luxury Gold 200μm', 'Luxury 골드 200μm', 'LUX200GDU', 0, 30),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_size', '90×50mm (Standard)', '90×50mm (표준)', 'N0400', 0, 10),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_size', '86×54mm (EU Standard)', '86×54mm (유럽 표준)', 'N0300', 0, 20),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_size', '91×55mm (EU)', '91×55mm (유럽)', 'N0700', 0, 30),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_size', '85×55mm (Mini)', '85×55mm (미니)', 'N0800', 0, 40),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty', '200 cards', '200매', '200', 0, 10),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty', '400 cards', '400매', '400', 0, 20),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty', '600 cards', '600매', '600', 0, 30),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty', '800 cards', '800매', '800', 0, 40),
  ('1d0a37f9-d444-41a3-8ee8-ee8dff500b21', 'paper_qty', '1,000 cards', '1000매', '1000', 0, 50);

-- ─────────────────────────────────────────────────────────────
-- CNC4000: letterpress-business-cards (아트지 명함)
-- 종이: ART300W00 (아트지 백색 300g)
-- 인쇄방식: PTM10/PTM20/PTM40 (일반/UV/디지털)
-- ─────────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, label_en, label_ko, value, extra_price_krw, sort_order)
VALUES
  -- 종이
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_code', 'Art Coated White 300gsm', '아트지 백색 300g', 'ART300W00', 0, 10),
  -- 인쇄방식
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'print_color_type', 'Double-sided Color', '양면 컬러', 'CTN40', 0, 10),
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'print_color_type', 'Single-sided Color', '단면 컬러', 'CTN10', 0, 20),
  -- 사이즈
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_size', '90×50mm (Standard)', '90×50mm (표준)', 'N0100', 0, 10),
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_size', '91×55mm (EU)', '91×55mm (유럽)', 'N0500', 0, 20),
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_size', '85×55mm (Mini)', '85×55mm (미니)', 'N0600', 0, 30),
  -- 수량
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_qty', '200 cards', '200매', '200', 0, 10),
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_qty', '400 cards', '400매', '400', 0, 20),
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_qty', '600 cards', '600매', '600', 0, 30),
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_qty', '800 cards', '800매', '800', 0, 40),
  ('88399bc1-db72-4b3a-b0ae-24a338e74aac', 'paper_qty', '1,000 cards', '1000매', '1000', 0, 50);

-- ─────────────────────────────────────────────────────────────
-- CNC5000: transparent-business-cards (PET 투명 명함)
-- 종이: PET300TRU — 최소수량 100장
-- ─────────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, label_en, label_ko, value, extra_price_krw, sort_order)
VALUES
  -- 종이
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_code', 'PET Transparent 300μm', 'PET 투명 300μm', 'PET300TRU', 0, 10),
  -- 인쇄방식
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'print_color_type', 'Double-sided Color', '양면 컬러', 'CTN40', 0, 10),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'print_color_type', 'Single-sided Color', '단면 컬러', 'CTN10', 0, 20),
  -- 사이즈
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_size', '86×54mm (EU Standard)', '86×54mm (유럽 표준)', 'N0300', 0, 10),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_size', '91×55mm (EU)', '91×55mm (유럽)', 'N0700', 0, 20),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_size', '85×55mm (Mini)', '85×55mm (미니)', 'N0800', 0, 30),
  -- 수량 (최소 100장)
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty', '100 cards', '100매', '100', 0, 10),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty', '200 cards', '200매', '200', 0, 20),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty', '300 cards', '300매', '300', 0, 30),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty', '400 cards', '400매', '400', 0, 40),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty', '600 cards', '600매', '600', 0, 50),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty', '800 cards', '800매', '800', 0, 60),
  ('7a03a1a1-4627-4139-aa62-930f8b0df6be', 'paper_qty', '1,000 cards', '1000매', '1000', 0, 70);

-- ─────────────────────────────────────────────────────────────
-- CNC6000: uv-business-cards (UV 코팅 명함 11종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, label_en, label_ko, value, extra_price_krw, sort_order)
VALUES
  -- 종이 (11종)
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Armi Ultra White 230gsm', '아르미 울트라화이트 230g', 'ARM230W00', 0, 10),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Armi Ultra White 310gsm', '아르미 울트라화이트 310g', 'ARM310W00', 0, 20),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Aquasatin 256gsm', '아쿠아사틴 256g', 'AQS256W00', 0, 30),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Invercote 350gsm', '인버코트 350g', 'INV350MT0', 0, 40),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Snow White 300gsm', '스노우지 백색 300g', 'SNW300W00', 0, 50),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Extra Matte 350gsm', '엑스트라매트 백색 350g', 'ETM350W00', 0, 60),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Van Nuvo White 204gsm', '반누보 화이트 204g', 'VNV186W00', 0, 70),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Van Nuvo White 250gsm', '반누보 화이트 250g', 'VNV233W00', 0, 80),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Van Nuvo Snow White 227gsm', '반누보 스노우화이트 227g', 'VNV227SW0', 0, 90),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Van Nuvo White 320gsm', '반누보 화이트 320g', 'VNV320W00', 0, 100),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_code', 'Rendezvous Natural 310gsm', '랑데뷰 내츄럴 310g', 'RDV310N00', 0, 110),
  -- 인쇄방식
  ('04802355-a73d-4d57-9228-723ee56519da', 'print_color_type', 'Double-sided Color', '양면 컬러', 'CTN40', 0, 10),
  ('04802355-a73d-4d57-9228-723ee56519da', 'print_color_type', 'Single-sided Color', '단면 컬러', 'CTN10', 0, 20),
  -- 사이즈
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_size', '90×50mm (Standard)', '90×50mm (표준)', 'N0100', 0, 10),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_size', '91×55mm (EU)', '91×55mm (유럽)', 'N0500', 0, 20),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_size', '85×55mm (Mini)', '85×55mm (미니)', 'N0600', 0, 30),
  -- 수량
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty', '200 cards', '200매', '200', 0, 10),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty', '400 cards', '400매', '400', 0, 20),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty', '600 cards', '600매', '600', 0, 30),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty', '800 cards', '800매', '800', 0, 40),
  ('04802355-a73d-4d57-9228-723ee56519da', 'paper_qty', '1,000 cards', '1000매', '1000', 0, 50);

-- ─────────────────────────────────────────────────────────────
-- CNC8000: pearl-business-cards (UV 코팅 명함 9종)
-- CNC6000 대비 ETM350W00·VNV320W00 제외
-- ─────────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, label_en, label_ko, value, extra_price_krw, sort_order)
VALUES
  -- 종이 (9종)
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Armi Ultra White 230gsm', '아르미 울트라화이트 230g', 'ARM230W00', 0, 10),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Armi Ultra White 310gsm', '아르미 울트라화이트 310g', 'ARM310W00', 0, 20),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Aquasatin 256gsm', '아쿠아사틴 256g', 'AQS256W00', 0, 30),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Invercote 350gsm', '인버코트 350g', 'INV350MT0', 0, 40),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Snow White 300gsm', '스노우지 백색 300g', 'SNW300W00', 0, 50),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Van Nuvo White 204gsm', '반누보 화이트 204g', 'VNV186W00', 0, 60),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Van Nuvo White 250gsm', '반누보 화이트 250g', 'VNV233W00', 0, 70),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Van Nuvo Snow White 227gsm', '반누보 스노우화이트 227g', 'VNV227SW0', 0, 80),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_code', 'Rendezvous Natural 310gsm', '랑데뷰 내츄럴 310g', 'RDV310N00', 0, 90),
  -- 인쇄방식
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'print_color_type', 'Double-sided Color', '양면 컬러', 'CTN40', 0, 10),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'print_color_type', 'Single-sided Color', '단면 컬러', 'CTN10', 0, 20),
  -- 사이즈
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_size', '90×50mm (Standard)', '90×50mm (표준)', 'N0100', 0, 10),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_size', '91×55mm (EU)', '91×55mm (유럽)', 'N0500', 0, 20),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_size', '85×55mm (Mini)', '85×55mm (미니)', 'N0600', 0, 30),
  -- 수량
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty', '200 cards', '200매', '200', 0, 10),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty', '400 cards', '400매', '400', 0, 20),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty', '600 cards', '600매', '600', 0, 30),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty', '800 cards', '800매', '800', 0, 40),
  ('6eda2c7f-4a4f-4529-9afd-78090ac0e41b', 'paper_qty', '1,000 cards', '1000매', '1000', 0, 50);

-- migration tracking
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260606000050',
  'print_specialty_cards_seongwon_fit',
  ARRAY[
    'DELETE FROM print_product_options WHERE product_id IN (...6 specialty card IDs...)',
    'INSERT CNC3000 options for premium-foil-cards',
    'INSERT CNC3000 options for metallic-business-cards',
    'INSERT CNC4000 options for letterpress-business-cards',
    'INSERT CNC5000 options for transparent-business-cards',
    'INSERT CNC6000 options for uv-business-cards',
    'INSERT CNC8000 options for pearl-business-cards'
  ]
)
ON CONFLICT (version) DO NOTHING;
