-- OMO-2314: 보드 옵션 A — 원래 9개 + 명백한 신규 라인만 유지.
-- OMO-2273 catalog overhaul 때 같은 한글명/같은 의미로 추가된 10쌍 중복 v2/standard 슬러그를 비활성화.
-- 원래 9개(Swadpia API 연동 O) 유지, 진짜 신규 라인(letterpress/pearl/uv/metallic/봉투/양식/라벨/책자/박스 등 52종) 유지.

UPDATE print_products
   SET is_active = false,
       updated_at = NOW()
 WHERE is_active = true
   AND slug IN (
     'standard-business-cards',    -- = business-cards
     'premium-business-cards-v2',  -- = premium-business-cards
     'foil-business-cards',        -- = premium-foil-cards
     'general-stickers',           -- = stickers
     'die-cut-stickers-v2',        -- = die-cut-stickers
     'flyers-v2',                  -- = flyers
     'brochures-v2',               -- = brochures
     'postcards-v2',               -- = postcards
     'posters-v2',                 -- = posters
     'banners-v2'                  -- = banners
   );
