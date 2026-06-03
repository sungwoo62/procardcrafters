-- 제품별 1매당 무게 (gram). 0 이면 default_weight_kg fallback
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS unit_weight_g NUMERIC(8, 2) NOT NULL DEFAULT 0;

-- 종이 밀도 기준 1매 무게 시드:
--   A4 = 0.0624 m². gsm × 0.0624 = g/매
--   3단 리플렛 = A4 단장 (1 sheet) ≈ 9.4g (150gsm 기준)
--   브로슈어 = A4 2장 접지/중철 (4-8 page) ≈ 15~25g
UPDATE print_products SET unit_weight_g = 1.0   WHERE slug = 'business-cards';
UPDATE print_products SET unit_weight_g = 1.5   WHERE slug = 'premium-business-cards';
UPDATE print_products SET unit_weight_g = 1.0   WHERE slug = 'stickers';
UPDATE print_products SET unit_weight_g = 1.0   WHERE slug = 'die-cut-stickers';
UPDATE print_products SET unit_weight_g = 6.0   WHERE slug = 'flyers';
UPDATE print_products SET unit_weight_g = 15.0  WHERE slug = 'brochures';
UPDATE print_products SET unit_weight_g = 5.0   WHERE slug = 'postcards';
UPDATE print_products SET unit_weight_g = 100.0 WHERE slug = 'posters';
UPDATE print_products SET unit_weight_g = 500.0 WHERE slug = 'banners';

COMMENT ON COLUMN print_products.unit_weight_g IS
  '1매(또는 1장)당 무게(g). selected_options.quantity 와 곱해서 주문 총 무게 계산. 0 이면 default_weight_kg 사용.';
