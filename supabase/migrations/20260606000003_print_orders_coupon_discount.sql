-- print_orders에 coupon_discount_usd 컬럼 추가
-- OMO-2409: 리뷰 쿠폰 할인 금액 기록

ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS coupon_discount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_coupon_id UUID REFERENCES print_review_coupons(id) ON DELETE SET NULL;

COMMENT ON COLUMN print_orders.coupon_discount_usd IS '리뷰 쿠폰 적용 할인 금액(USD). 0=할인 없음.';
COMMENT ON COLUMN print_orders.review_coupon_id IS '적용된 print_review_coupons.id';

CREATE INDEX IF NOT EXISTS print_orders_review_coupon_id
  ON print_orders(review_coupon_id)
  WHERE review_coupon_id IS NOT NULL;

-- DOWN
-- ALTER TABLE print_orders DROP COLUMN IF EXISTS coupon_discount_usd;
-- ALTER TABLE print_orders DROP COLUMN IF EXISTS review_coupon_id;
