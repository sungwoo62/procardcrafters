-- 무료배송 무게 상한 (예: 3kg 이하 주문만 무료)
-- 0 = 무제한 (단, free_shipping_threshold_usd 만 적용)
ALTER TABLE print_shipping_config
  ADD COLUMN IF NOT EXISTS free_shipping_max_weight_kg NUMERIC(8, 3) NOT NULL DEFAULT 0;
