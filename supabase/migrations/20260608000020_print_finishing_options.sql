-- ============================================================
-- OMO-2664: 후가공(finishing) 주문옵션 시드 + option_type CHECK 확장
--
-- 배경: OMO-2647 에서 성원애드피아 후가공 자동발주 + 도매 surcharge 추출이 완료됨
--   (명함 CNC1000 라이브 검증). 이 마이그레이션은 후가공을 고객 노출 주문옵션으로
--   전환하는 outward-facing 부분 — print_product_options 에 option_type='finishing'
--   행을 시드한다. 구성기(ProductConfigurator)가 이를 멀티셀렉트로 렌더하고
--   고객가 = extra_price_krw(도매) × product.margin_multiplier × 환율 로 반영한다.
--   (단, 박/형압 면적 비례 단가는 src/config/finishing-surcharge.ts 가 런타임 권위.)
--
-- surcharge 값(도매 KRW, OMO-2647 검증, CNC1000 1,000매 기준):
--   박(foil_stamp)=22,300 @50×30mm · 형압(deboss_emboss)≈22,300 @50×30mm
--   도무송(die_cut)=21,500 · 타공(drilled_hole)=3,800
--   넘버링(numbering)=용지 의존(스노우지 250/300g 불가) → 시드 제외.
--
-- 범위: surcharge 가 명함(CNC1000) 폼에서만 검증되어 명함 계열에만 시드한다.
--   (business_cards / premium_business_cards / premium_foil_cards)
--   다른 카테고리는 카테고리별 surcharge 재검증 후 별도 시드.
--
-- 멱등성: ON CONFLICT (product_id, option_type, value) DO NOTHING.
-- ============================================================

-- 1. option_type CHECK 제약에 'finishing' 추가 (기존 값 보존)
ALTER TABLE print_product_options DROP CONSTRAINT IF EXISTS print_product_options_option_type_check;
ALTER TABLE print_product_options ADD CONSTRAINT print_product_options_option_type_check
  CHECK (option_type IN (
    'quantity', 'paper', 'coating', 'size', 'finish', 'finishing', 'corners', 'sides', 'pages',
    'paper_code', 'paper_size', 'paper_qty', 'print_color_type'
  ));

-- 2. 명함 계열 제품에 후가공 옵션 시드 (extra_price_krw = 도매 surcharge KRW)
INSERT INTO print_product_options
  (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order)
SELECT p.id, 'finishing', f.value, f.label_ko, f.label_en, f.krw, false, f.sort_order
FROM print_products p
CROSS JOIN (VALUES
  ('foil_stamp',    '박',    'Foil Stamping (Gold)', 22300, 1),
  ('deboss_emboss', '형압',  'Deboss / Emboss',      22300, 2),
  ('die_cut',       '도무송', 'Die Cut',              21500, 3),
  ('drilled_hole',  '타공',  'Drilled Hole',          3800, 4)
) AS f(value, label_ko, label_en, krw, sort_order)
WHERE p.category IN ('business_cards', 'premium_business_cards', 'premium_foil_cards')
ON CONFLICT (product_id, option_type, value) DO NOTHING;
