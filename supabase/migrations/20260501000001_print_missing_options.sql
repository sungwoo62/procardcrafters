-- 기존 4개 상품(stickers, flyers, postcards, posters)에 누락된 옵션 추가

-- ===== STICKERS =====
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order) VALUES
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'quantity', '100매', '100 pcs', '100', 0, true, 1),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'quantity', '200매', '200 pcs', '200', 0, false, 2),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'quantity', '500매', '500 pcs', '500', 0, false, 3),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'quantity', '1000매', '1,000 pcs', '1000', 0, false, 4),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'size', '50×50mm', '50×50mm', '50x50', 0, true, 1),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'size', '70×70mm', '70×70mm', '70x70', 0, false, 2),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'size', '100×100mm', '100×100mm', '100x100', 0, false, 3),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper', '아트지', 'Art Paper', 'art', 0, true, 1),
  ('b3cc2020-8f4c-4005-b7a2-c59a70ee0de4', 'paper', '유포지', 'Vinyl', 'vinyl', 2000, false, 2)
ON CONFLICT DO NOTHING;

-- ===== FLYERS =====
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order) VALUES
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'quantity', '100매', '100 pcs', '100', 0, true, 1),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'quantity', '200매', '200 pcs', '200', 0, false, 2),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'quantity', '500매', '500 pcs', '500', 0, false, 3),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'quantity', '1000매', '1,000 pcs', '1000', 0, false, 4),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'size', 'A4', 'A4 (210×297mm)', 'A4', 0, true, 1),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'size', 'A5', 'A5 (148×210mm)', 'A5', 0, false, 2),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'size', 'DL', 'DL (99×210mm)', 'DL', 0, false, 3),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'paper', '스노우 150g', 'Snow White 150gsm', 'snow150', 0, true, 1),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'paper', '아트 150g', 'Art Paper 150gsm', 'art150', 0, false, 2),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'coating', '없음', 'None', 'none', 0, true, 1),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'coating', '유광코팅', 'Gloss', 'gloss', 3000, false, 2),
  ('aec01160-d01e-4514-8cdd-4af041138e54', 'coating', '무광코팅', 'Matte', 'matte', 3000, false, 3)
ON CONFLICT DO NOTHING;

-- ===== POSTCARDS =====
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order) VALUES
  ('b801348a-c45d-4208-845f-9a064a016e17', 'quantity', '100매', '100 pcs', '100', 0, true, 1),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'quantity', '200매', '200 pcs', '200', 0, false, 2),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'quantity', '500매', '500 pcs', '500', 0, false, 3),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'quantity', '1000매', '1,000 pcs', '1000', 0, false, 4),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'size', '표준 (100×148mm)', 'Standard (100×148mm)', 'standard', 0, true, 1),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'size', '대형 (148×210mm)', 'Large (148×210mm)', 'large', 0, false, 2),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'paper', '스노우 300g', 'Snow White 300gsm', 'snow300', 0, true, 1),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'paper', '아트 300g', 'Art Paper 300gsm', 'art300', 0, false, 2),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'coating', '유광코팅', 'Gloss', 'gloss', 0, true, 1),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'coating', '무광코팅', 'Matte', 'matte', 0, false, 2),
  ('b801348a-c45d-4208-845f-9a064a016e17', 'coating', '소프트터치', 'Soft Touch', 'soft-touch', 5000, false, 3)
ON CONFLICT DO NOTHING;

-- ===== POSTERS =====
INSERT INTO print_product_options (product_id, option_type, label_ko, label_en, value, extra_price_krw, is_default, sort_order) VALUES
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'quantity', '1매', '1 pc', '1', 0, true, 1),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'quantity', '5매', '5 pcs', '5', 0, false, 2),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'quantity', '10매', '10 pcs', '10', 0, false, 3),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'quantity', '50매', '50 pcs', '50', 0, false, 4),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'size', 'A3', 'A3 (297×420mm)', 'A3', 0, true, 1),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'size', 'A2', 'A2 (420×594mm)', 'A2', 0, false, 2),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'size', 'A1', 'A1 (594×841mm)', 'A1', 0, false, 3),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper', '사틴 170g', 'Satin 170gsm', 'satin170', 0, true, 1),
  ('7dd27fda-34cf-48ba-a87d-0aa7c2769945', 'paper', '무광 200g', 'Matte 200gsm', 'matte200', 3000, false, 2)
ON CONFLICT DO NOTHING;
