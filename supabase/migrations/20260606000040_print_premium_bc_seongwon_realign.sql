-- ============================================================
-- OMO-2485: 프리미엄 명함(CNC2000) 성원 카탈로그 맞춤 재정렬
--
-- 문제: premium-business-cards에 CNC1000(일반명함) 종이가
--       잘못 시드되어 있었음. CNC2000은 실제 23종 종이를 제공.
-- 해결: 잘못된 옵션 삭제 후 CNC2000 실제 종이 전체 재시드.
-- ============================================================

-- 1. 프리미엄 명함 기존 옵션 전체 삭제 (재시드 전 초기화)
DELETE FROM print_product_options
WHERE product_id = '089080ac-3088-4b43-af0d-844fefc42ffa'; -- premium-business-cards

-- 2. CNC2000 실제 종이 23종 시드 (성원 API 직접 조회 기준, 2026-06-06)
--    extra_price_krw: Swadpia 라이브 API 가격 사용 시 무시됨 (참조값만)
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES

-- ── 용지 (paper_code) — CNC2000 실제 제공 종이 ──────────────
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'TDR300W00', '띤또레또 백색 300g',        'Tintoretto White 300gsm',         0,     true,   1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'ARM230W00', '아르미 울트라화이트 230g',   'Armi Ultra White 230gsm',         0,     false,  2),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'BAS233W00', '베이직 백색 233g',           'Basic White 233gsm',              0,     false,  3),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'MSM209W00', '매쉬맬로우 화이트 209g',     'Marshmallow White 209gsm',        0,     false,  4),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'VNV227SW0', '반누보 스노우화이트 227g',   'Rannuovo Snow White 227gsm',      0,     false,  5),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'VNV186W00', '반누보 화이트 204g',         'Rannuovo White 204gsm',           0,     false,  6),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'CFT30000N', '뉴크라프트보드 300g',        'New Kraft Board 300gsm',          3000,  false,  7),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'DNT250GP0', '다이니티 골드펄 250g',       'Dignity Gold Pearl 250gsm',       5000,  false,  8),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'DUO400W01', '듀오 화이트 400g',           'Duo White 400gsm',                5000,  false,  9),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'RDV310N00', '랑데뷰 내츄럴 310g',        'Rendezvous Natural 310gsm',       5000,  false,  10),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'RNC216SW0', '린넨커버 솔라화이트 216g',   'Linen Cover Solar White 216gsm',  5000,  false,  11),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'VNV320W00', '반누보 화이트 320g',         'Rannuovo White 320gsm',           5000,  false,  12),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'VVT359W00', '벨벳 화이트 359g',           'Velvet White 359gsm',             8000,  false,  13),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'STD240QZ0', '스타드림 쿼츠 240g',        'Stardream Quartz 240gsm',         8000,  false,  14),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'STA250BP0', '블루펄스타 250g',            'Blue Pearl Star 250gsm',          8000,  false,  15),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'ARM310W00', '아르미 울트라화이트 310g',   'Armi Ultra White 310gsm',         8000,  false,  16),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'BKN380BL0', '매트블랙 380g',              'Matte Black 380gsm',              10000, false,  17),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'ETM350W00', '엑스트라매트 백색 350g',     'Extra Matte White 350gsm',        10000, false,  18),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'ETP370W00', '엑스트라폴라 백색 370g',     'Extra Polar White 370gsm',        10000, false,  19),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'EGS400WH1', '에그쉘 엑스트라화이트 400g','Eggshell Extra White 400gsm',     12000, false,  20),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'UPP250FB0', '유포지 FEB 250µm',           'Vinyl FEB 250µm',                 8000,  false,  21),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'CST235PW0', '크리스탈 펄화이트 235g',     'Crystal Pearl White 235gsm',      10000, false,  22),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_code', 'KYC250GD0', '키칼라 아이스골드 250g',     'Kizara Ice Gold 250gsm',          12000, false,  23),

-- ── 인쇄 방식 (print_color_type) ─────────────────────────────
('089080ac-3088-4b43-af0d-844fefc42ffa', 'print_color_type', 'CTN40', '양면 컬러',    'Double-sided Color',      0,     true,  1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'print_color_type', 'CTN10', '단면 컬러',    'Single-sided Color',     -5000,  false, 2),

-- ── 사이즈 (paper_size) — CNC2000 제공 3종 ──────────────────
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_size', 'N0100', '90×50mm (표준)', '90×50mm (Standard)', 0,    true,  1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_size', 'N0500', '91×55mm',        '91×55mm',            0,    false, 2),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_size', 'N0600', '85×55mm',        '85×55mm',            0,    false, 3),

-- ── 수량 (paper_qty) — CNC2000 기준 200~1000매 ───────────────
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '200',  '200매',  '200 cards',  0,     true,  1),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '400',  '400매',  '400 cards',  15000, false, 2),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '600',  '600매',  '600 cards',  25000, false, 3),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '800',  '800매',  '800 cards',  35000, false, 4),
('089080ac-3088-4b43-af0d-844fefc42ffa', 'paper_qty', '1000', '1000매', '1,000 cards',45000, false, 5)

ON CONFLICT (product_id, option_type, value) DO UPDATE
  SET label_ko = EXCLUDED.label_ko,
      label_en = EXCLUDED.label_en,
      extra_price_krw = EXCLUDED.extra_price_krw,
      is_default = EXCLUDED.is_default,
      sort_order = EXCLUDED.sort_order;

-- 3. 성원에 없는 특수 명함 슬러그 비활성화
--    (CNC2000 용지 옵션으로 대체 — pearl, UV, transparent, metallic, foil, letterpress)
UPDATE print_products SET is_active = false
WHERE slug IN (
  'premium-foil-cards',
  'letterpress-business-cards',
  'pearl-business-cards',
  'uv-business-cards',
  'transparent-business-cards',
  'metallic-business-cards'
);
