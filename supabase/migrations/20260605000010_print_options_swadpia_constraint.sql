-- ============================================================
-- option_type CHECK 제약 확장 + 성원 9개 제품 옵션 재시드 (fresh migration path 전용)
--
-- 원인: 20260603000010_print_catalog_categories_fix.sql 이
--   swadpia option_type(paper_code/paper_size/paper_qty/print_color_type)을
--   제외한 CHECK 제약을 설정한 뒤, 동일 타임스탬프의
--   20260603000010_print_swadpia_options_sync.sql 의 INSERT 가 전부 실패.
--   DELETE 는 성공했으므로 9개 제품 옵션이 0개 → Quote 버튼 표시.
--
-- 주의: live DB 에 20260603* 마이그레이션이 이미 수동 적용된 경우
--   아래 INSERT ON CONFLICT DO NOTHING 은 no-op 으로 안전하게 스킵됨.
-- ============================================================

-- 1. CHECK 제약 확장 (기존 표준 타입 + 성원 코드 타입 포함)
ALTER TABLE print_product_options DROP CONSTRAINT IF EXISTS print_product_options_option_type_check;
ALTER TABLE print_product_options ADD CONSTRAINT print_product_options_option_type_check
  CHECK (option_type IN (
    'quantity', 'paper', 'coating', 'size', 'finish', 'corners', 'sides', 'pages',
    'paper_code', 'paper_size', 'paper_qty', 'print_color_type'
  ));

-- 2. 성원 9개 제품 옵션 재시드 (ON CONFLICT DO NOTHING — idempotent)

-- ── 명함 (business-cards) CNC1000 ──────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_code', 'SNW250W00', '스노우지 250g', 'Snow White 250gsm',     0, true,  1),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_code', 'SNW300W00', '스노우지 300g', 'Snow White 300gsm', 3000, false, 2),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'print_color_type', 'CTN40', '양면 컬러', 'Double-sided Color',     0, true,  1),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'print_color_type', 'CTN10', '단면 컬러', 'Single-sided Color', -3000, false, 2),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'print_color_type', 'CTN99', '흑백',       'Black & White',      -5000, false, 3),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_size', 'N0100', '90×50mm (표준)', '90×50mm (Standard)', 0, true,  1),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_size', 'N0200', '86×52mm',         '86×52mm',            0, false, 2),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_size', 'N0500', '91×55mm',         '91×55mm',            0, false, 3),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_size', 'N0600', '85×55mm',         '85×55mm',            0, false, 4),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_qty', '100',  '100매',  '100 cards',   0,     true,  1),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_qty', '200',  '200매',  '200 cards',   8000,  false, 2),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_qty', '500',  '500매',  '500 cards',  20000,  false, 3),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_qty', '1000', '1000매', '1,000 cards',50000,  false, 4),
('182c4d9b-36be-4674-85d5-de8e283de32d', 'paper_qty', '2000', '2000매', '2,000 cards',95000,  false, 5)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 프리미엄 명함 (premium-business-cards) CNC2000 ─────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'SNW250W00', '스노우지 250g', 'Snow White 250gsm',     0, true,  1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'SNW300W00', '스노우지 300g', 'Snow White 300gsm', 3000, false, 2),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'print_color_type', 'CTN40', '양면 컬러', 'Double-sided Color',     0, true,  1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'print_color_type', 'CTN10', '단면 컬러', 'Single-sided Color', -3000, false, 2),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_size', 'N0100', '90×50mm (표준)', '90×50mm (Standard)', 0, true,  1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_size', 'N0200', '86×52mm',         '86×52mm',            0, false, 2),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_size', 'N0500', '91×55mm',         '91×55mm',            0, false, 3),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '200',  '200매',  '200 cards',   0,     true,  1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '500',  '500매',  '500 cards',  20000,  false, 2),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '1000', '1000매', '1,000 cards',50000,  false, 3)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 스티커 (stickers) CST1000 ───────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_code', 'STK075AT0', '아트지 75g',          'Art Paper 75gsm',            0,    true,  1),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_code', 'STK090AF0', '아트지 90g (초강접)', 'Art Paper 90gsm Super-bond', 2000, false, 2),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_code', 'STK080YP0', '유포지 80µm',         'Vinyl Film 80µm',            3000, false, 3),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_code', 'STK075AT1', '아트지 75g (강접)',   'Art Paper 75gsm Strong-bond',1000, false, 4),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'print_color_type', 'SPD10', '단면 컬러',          'Single-sided Color',         0,    true,  1),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'print_color_type', 'SPD20', '단면 컬러 + UV코팅', 'Single-sided Color + UV',    3000, false, 2),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'print_color_type', 'SPD30', '단면 컬러 + 라미',   'Single-sided Color + Lami',  3000, false, 3),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_qty', '500',  '500매',  '500 pcs',    0,     true,  1),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_qty', '1000', '1000매', '1,000 pcs', 10000,  false, 2),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_qty', '2000', '2000매', '2,000 pcs', 18000,  false, 3),
('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper_qty', '3000', '3000매', '3,000 pcs', 25000,  false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 도무송 스티커 (die-cut-stickers) CST2000 ────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'paper_code', 'STK075AT0', '아트지 75g',          'Art Paper 75gsm',            0,    true,  1),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'paper_code', 'STK080YP0', '유포지 80µm',         'Vinyl Film 80µm',            3000, false, 2),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'paper_code', 'STK090AF0', '아트지 90g (초강접)', 'Art Paper 90gsm Super-bond', 2000, false, 3),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'print_color_type', 'SPD10', '단면 컬러',          'Single-sided Color',      0,    true,  1),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'print_color_type', 'SPD20', '단면 컬러 + UV코팅', 'Single-sided Color + UV', 3000, false, 2),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'paper_qty', '100',  '100매',  '100 pcs',    0,     true,  1),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'paper_qty', '200',  '200매',  '200 pcs',    8000,  false, 2),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'paper_qty', '500',  '500매',  '500 pcs',   18000,  false, 3),
('6e2b5810-3534-4da0-98ec-253ba4bcbace', 'paper_qty', '1000', '1000매', '1,000 pcs', 30000,  false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 전단지 (flyers) CLF1000 ─────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_code', 'ART090W00', '아트지 90g',  'Art Coated 90gsm',   0,    true,  1),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_code', 'ART120W00', '아트지 120g', 'Art Coated 120gsm',  3000, false, 2),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_code', 'ART150W00', '아트지 150g', 'Art Coated 150gsm',  5000, false, 3),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_code', 'ART180W00', '아트지 180g', 'Art Coated 180gsm',  8000, false, 4),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_size', 'A0400', 'A4 (210×297mm)', 'A4 (210×297mm)',  0,     true,  1),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_size', 'A0500', 'A5 (148×210mm)', 'A5 (148×210mm)', -3000,  false, 2),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_size', 'A0300', 'A3 (297×420mm)', 'A3 (297×420mm)',  8000,  false, 3),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_size', 'A0200', 'A2 (420×594mm)', 'A2 (420×594mm)', 20000,  false, 4),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_qty', '2000',  '2,000매',  '2,000 pcs',  0,     true,  1),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_qty', '4000',  '4,000매',  '4,000 pcs',  15000, false, 2),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_qty', '8000',  '8,000매',  '8,000 pcs',  25000, false, 3),
('aec01160-d01e-4514-8cdd-4af041138e54', 'paper_qty', '12000', '12,000매', '12,000 pcs', 40000, false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 브로셔 (brochures) CLF2000 ──────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_code', 'ART100W00', '아트지 100g', 'Art Coated 100gsm',  0,    true,  1),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_code', 'ART120W00', '아트지 120g', 'Art Coated 120gsm',  3000, false, 2),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_code', 'ART150W00', '아트지 150g', 'Art Coated 150gsm',  5000, false, 3),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_code', 'ART180W00', '아트지 180g', 'Art Coated 180gsm',  8000, false, 4),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_size', 'A0400', 'A4 (210×297mm)', 'A4 (210×297mm)',  0,     true,  1),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_size', 'A0300', 'A3 (297×420mm)', 'A3 (297×420mm)',  8000,  false, 2),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_size', 'A0200', 'A2 (420×594mm)', 'A2 (420×594mm)', 20000,  false, 3),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_size', 'A0100', 'A1 (594×841mm)', 'A1 (594×841mm)', 40000,  false, 4),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_qty', '1000', '1,000매', '1,000 pcs',  0,     true,  1),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_qty', '2000', '2,000매', '2,000 pcs', 20000,  false, 2),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_qty', '4000', '4,000매', '4,000 pcs', 35000,  false, 3),
('a3230c4e-a50f-4713-9dcc-9e0e835f58ba', 'paper_qty', '6000', '6,000매', '6,000 pcs', 50000,  false, 4)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 엽서 (postcards) CDP3000 ────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_code', 'SNW120W00', '스노우지 120g', 'Snow White 120gsm',  0,    true,  1),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_code', 'SNW150W00', '스노우지 150g', 'Snow White 150gsm',  3000, false, 2),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_code', 'SNW180W00', '스노우지 180g', 'Snow White 180gsm',  5000, false, 3),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_code', 'SNW200W00', '스노우지 200g', 'Snow White 200gsm',  8000, false, 4),
('b801348a-c45d-4208-845f-9a064a016e17', 'print_color_type', 'DPD10', '양면 컬러', 'Double-sided Color',      0,    true,  1),
('b801348a-c45d-4208-845f-9a064a016e17', 'print_color_type', 'DPD20', '단면 컬러', 'Single-sided Color',  -3000, false,  2),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_size', 'V0500', '100×148mm (엽서 표준)', '100×148mm (Postcard Standard)', 0, true, 1),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_qty', '100', '100매', '100 pcs',  0,     true,  1),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_qty', '200', '200매', '200 pcs',  8000,  false, 2),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_qty', '300', '300매', '300 pcs', 12000,  false, 3),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_qty', '400', '400매', '400 pcs', 16000,  false, 4),
('b801348a-c45d-4208-845f-9a064a016e17', 'paper_qty', '500', '500매', '500 pcs', 20000,  false, 5)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 포스터 (posters) CPR2000 ────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_code', 'ART100W00', '아트지 100g', 'Art Coated 100gsm',  0,    true,  1),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_code', 'ART120W00', '아트지 120g', 'Art Coated 120gsm',  3000, false, 2),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_code', 'ART150W00', '아트지 150g', 'Art Coated 150gsm',  5000, false, 3),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_code', 'ART180W00', '아트지 180g', 'Art Coated 180gsm',  8000, false, 4),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_code', 'ART200W00', '아트지 200g', 'Art Coated 200gsm', 12000, false, 5),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_size', 'A0300', 'A3 (297×420mm)',  'A3 (297×420mm)',  0,     true,  1),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_size', 'A0200', 'A2 (420×594mm)',  'A2 (420×594mm)',  15000, false, 2),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_size', 'A0100', 'A1 (594×841mm)',  'A1 (594×841mm)',  30000, false, 3),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_size', 'B0200', 'B2 타블로이드',    'B2 Tabloid',      20000, false, 4),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_size', 'B0300', 'B3',              'B3',              10000, false, 5),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_size', 'B0400', 'B4',              'B4',               5000, false, 6),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_qty', '250',  '250매',  '250 pcs',   0,     true,  1),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_qty', '500',  '500매',  '500 pcs',  15000,  false, 2),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_qty', '1000', '1,000매','1,000 pcs',25000,  false, 3),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_qty', '1500', '1,500매','1,500 pcs',35000,  false, 4),
('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper_qty', '2000', '2,000매','2,000 pcs',45000,  false, 5)
ON CONFLICT (product_id, option_type, value) DO NOTHING;

-- ── 배너 (banners) CPR5000 ──────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_code', 'BNR510W00', '현수막 510g (표준)', 'PVC Banner 510gsm (Standard)',  0,     true,  1),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_code', 'BNR440W00', '현수막 440g',        'PVC Banner 440gsm',            -5000,  false, 2),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_size', 'SZT20', '사이즈 직접 입력', 'Custom Size (enter dimensions)', 0, true, 1),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_qty', '1', '1장',  '1 pc',   0,     true,  1),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_qty', '2', '2장',  '2 pcs',  5000,  false, 2),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_qty', '3', '3장',  '3 pcs',  8000,  false, 3),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_qty', '5', '5장',  '5 pcs',  12000, false, 4),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_qty', '10','10장', '10 pcs', 20000, false, 5)
ON CONFLICT (product_id, option_type, value) DO NOTHING;
