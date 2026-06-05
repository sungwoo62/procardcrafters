-- OMO-2410: D+7 리뷰 요청 이메일 인프라
-- 1. print_orders.delivered_at 컬럼 + 자동 타임스탬프 트리거
-- 2. print_review_request_log 발송 이력 테이블

-- ─────────────────────────────────────────────
-- 1. delivered_at 컬럼
-- ─────────────────────────────────────────────
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 백필: print_shipments.delivered_at 우선 → 없으면 print_orders.updated_at
UPDATE print_orders o
SET delivered_at = COALESCE(
  (
    SELECT s.delivered_at
    FROM print_shipments s
    WHERE s.order_id = o.id
      AND s.delivered_at IS NOT NULL
    ORDER BY s.created_at DESC
    LIMIT 1
  ),
  o.updated_at
)
WHERE o.status = 'delivered'
  AND o.delivered_at IS NULL;

-- 새 배송완료 감지 트리거 함수
CREATE OR REPLACE FUNCTION print_set_delivered_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'delivered'
    AND (OLD.status IS NULL OR OLD.status <> 'delivered')
  THEN
    NEW.delivered_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS print_orders_set_delivered_at ON print_orders;
CREATE TRIGGER print_orders_set_delivered_at
  BEFORE UPDATE ON print_orders
  FOR EACH ROW EXECUTE FUNCTION print_set_delivered_at();

-- ─────────────────────────────────────────────
-- 2. 리뷰 요청 이메일 발송 로그
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_review_request_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID        NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  email_type        TEXT        NOT NULL CHECK (email_type IN ('d7', 'd14')),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_message_id TEXT,
  CONSTRAINT print_review_request_log_order_type_unique
    UNIQUE (order_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_review_req_log_sent
  ON print_review_request_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_req_log_email
  ON print_review_request_log(email);

ALTER TABLE print_review_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_req_log_service_role"
  ON print_review_request_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- DOWN (참고용)
-- DROP TABLE IF EXISTS print_review_request_log;
-- DROP TRIGGER IF EXISTS print_orders_set_delivered_at ON print_orders;
-- DROP FUNCTION IF EXISTS print_set_delivered_at();
-- ALTER TABLE print_orders DROP COLUMN IF EXISTS delivered_at;
-- ─────────────────────────────────────────────
