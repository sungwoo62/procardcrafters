-- print_orders에 promo_discount_usd 컬럼 추가
-- OMO-2392: 주문별 프로모 할인 금액 기록

-- ============================================================
-- UP
-- ============================================================

ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS promo_discount_usd NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN print_orders.promo_discount_usd IS '프로모 코드 적용 할인 금액(USD). 0=할인 없음.';

-- ============================================================
-- DOWN
-- ALTER TABLE print_orders DROP COLUMN IF EXISTS promo_discount_usd;
-- ============================================================
