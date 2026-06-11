-- OMO-2909: PayPal 서버 웹훅이 paypal_order_id 로 주문을 조회/멱등 업데이트한다.
-- 매칭 가속을 위한 인덱스(부분 인덱스 — null 제외).
CREATE INDEX IF NOT EXISTS idx_print_orders_paypal_order_id
  ON print_orders(paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;
