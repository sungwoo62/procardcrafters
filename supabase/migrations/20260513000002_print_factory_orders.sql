-- 성원애드피아 공장 발주 추적 테이블
-- 결제 확인 후 Swadpia 자동 발주 상태를 기록한다.
CREATE TABLE IF NOT EXISTS print_factory_orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  print_order_id        UUID        NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  print_order_item_id   UUID        REFERENCES print_order_items(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'placing', 'placed', 'failed', 'cancelled')),
  swadpia_order_number  TEXT,
  -- /order/order_info/direct_order 결제 대기 페이지 URL (결제는 관리자 수동 진행)
  checkout_url          TEXT,
  category_code         TEXT        NOT NULL,
  -- selected_options + quantity snapshot at time of queuing
  options_snapshot      JSONB       NOT NULL DEFAULT '{}',
  quantity              INTEGER     NOT NULL DEFAULT 1,
  -- Supabase Storage path or public URL for the print file
  file_url              TEXT,
  attempt_count         INTEGER     NOT NULL DEFAULT 0,
  last_error            TEXT,
  queued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  placed_at             TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS print_factory_orders_status_queued_idx
  ON print_factory_orders (status, queued_at);

CREATE INDEX IF NOT EXISTS print_factory_orders_print_order_id_idx
  ON print_factory_orders (print_order_id);

-- RLS: service_role 전용 (관리자 스크립트, API route에서만 접근)
ALTER TABLE print_factory_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_print_factory_orders"
  ON print_factory_orders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
