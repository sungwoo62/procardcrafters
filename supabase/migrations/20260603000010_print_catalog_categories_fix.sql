-- 카탈로그 카테고리 + option_type CHECK 제약 보강
-- 기존 DB 에는 booklets/boxes/calendars 등 더 많은 카테고리가 이미 존재.
-- 모두 포함 + 신규 (premium_foil_cards/eco_stickers/sample_pack) 추가.
-- option_type 도 corners/sides/pages 확장.

ALTER TABLE print_product_options DROP CONSTRAINT IF EXISTS print_product_options_option_type_check;
ALTER TABLE print_product_options ADD CONSTRAINT print_product_options_option_type_check
  CHECK (option_type IN (
    'quantity', 'paper', 'coating', 'size', 'finish',
    'corners', 'sides', 'pages'
  ));

ALTER TABLE print_products DROP CONSTRAINT IF EXISTS print_products_category_check;
ALTER TABLE print_products ADD CONSTRAINT print_products_category_check
  CHECK (category IN (
    -- 명함류
    'business_cards', 'premium_business_cards', 'premium_foil_cards',
    -- 스티커류
    'stickers', 'die_cut_stickers', 'eco_stickers',
    -- 인쇄물
    'flyers', 'brochures', 'booklets',
    -- 우편
    'postcards', 'greeting_cards', 'envelopes',
    -- 디스플레이
    'posters', 'banners', 'pop',
    -- 사무용품
    'forms', 'notebooks', 'memo_pads', 'calendars',
    'labels',
    -- 포장
    'boxes', 'paper_bags',
    -- 샘플
    'sample_pack'
  ));
