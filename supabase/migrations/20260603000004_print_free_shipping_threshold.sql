-- 무료배송 임계값 (예: \$150 이상 주문 시 무료)
ALTER TABLE print_shipping_config
  ADD COLUMN IF NOT EXISTS free_shipping_threshold_usd NUMERIC(12, 2) NOT NULL DEFAULT 0;
-- 0 = 무료배송 없음, > 0 = 해당 USD 이상 시 무료
