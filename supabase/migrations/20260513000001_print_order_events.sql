-- 주문 이벤트 감사 로그 테이블
-- 모든 주문 상태 변경, 이메일 발송, 결제 이벤트를 기록한다.
CREATE TABLE IF NOT EXISTS print_order_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL CHECK (event_type IN (
    'status_change',
    'email_sent',
    'payment_received',
    'payment_failed',
    'fraud_alert',
    'file_uploaded',
    'file_approved',
    'file_rejected'
  )),
  old_value    TEXT,
  new_value    TEXT,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  actor        TEXT        NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS print_order_events_order_id_idx
  ON print_order_events (order_id, created_at DESC);

-- RLS: 관리자(service_role)만 읽기/쓰기
ALTER TABLE print_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_print_order_events"
  ON print_order_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
