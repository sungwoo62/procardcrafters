-- print_orders 테이블에 PayPal 결제 컬럼 추가
-- 이미 컬럼이 있는 경우를 위해 IF NOT EXISTS 사용

ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

-- 결제 상태 인덱스
CREATE INDEX IF NOT EXISTS idx_print_orders_payment_status
  ON print_orders (payment_status);

COMMENT ON COLUMN print_orders.payment_status IS 'PayPal 결제 상태: unpaid | paid | refunded';
COMMENT ON COLUMN print_orders.paypal_order_id IS 'PayPal 캡처된 주문 ID';
