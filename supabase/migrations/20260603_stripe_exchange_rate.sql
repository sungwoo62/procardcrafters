-- Stripe 세션 ID 컬럼 추가
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

COMMENT ON COLUMN print_orders.stripe_session_id IS 'Stripe Checkout 세션 ID';

CREATE INDEX IF NOT EXISTS idx_print_orders_stripe_session_id
  ON print_orders (stripe_session_id);

-- 환율 캐시 테이블 (1시간 TTL)
CREATE TABLE IF NOT EXISTS print_exchange_rates (
  id          SERIAL      PRIMARY KEY,
  base_currency   TEXT    NOT NULL,
  target_currency TEXT    NOT NULL,
  rate        NUMERIC(20, 6) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_currency, target_currency)
);

COMMENT ON TABLE print_exchange_rates IS 'USD/KRW 환율 캐시 (TTL 1시간, print_ prefix)';
COMMENT ON COLUMN print_exchange_rates.fetched_at IS '마지막 API 조회 시각';
