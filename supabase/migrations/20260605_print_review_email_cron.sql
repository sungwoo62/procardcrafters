-- OMO-2423 (OMO-2411 #3): D+7 리뷰 요청 메일 cron + Beta tester 변형
--
-- print_orders에 리뷰 요청 추적 컬럼 추가 + 발송 로그/수신거부 테이블 신설.
-- shipped_at 자동 갱신 트리거 포함 (status='shipped'로 전환되는 시점에 1회 기록).

-- 1) print_orders 컬럼 확장
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_request_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_request_source TEXT
    CHECK (review_request_source IS NULL OR review_request_source IN ('paid','beta_tester')),
  ADD COLUMN IF NOT EXISTS review_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_print_orders_review_token
  ON print_orders(review_token)
  WHERE review_token IS NOT NULL;

COMMENT ON COLUMN print_orders.shipped_at IS 'status가 shipped로 전환된 시점 — D+7 리뷰 요청 trigger 기준';
COMMENT ON COLUMN print_orders.is_complimentary IS '베타 테스터 무상 주문 (FTC §255.5 disclosure 자동 적용)';
COMMENT ON COLUMN print_orders.review_request_sent_at IS 'D+7 리뷰 요청 메일 발송 시점 (멱등성)';
COMMENT ON COLUMN print_orders.review_request_reminder_sent_at IS 'D+14 리마인더 메일 발송 시점 (1회 한정)';
COMMENT ON COLUMN print_orders.review_request_source IS '리뷰 CTA 클릭 시 결정된 source — 어드민 승인 시 disclosure 자동화';
COMMENT ON COLUMN print_orders.review_token IS '리뷰 작성 페이지 일회성 토큰';

-- cron 후보 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_print_orders_review_request_due
  ON print_orders(shipped_at)
  WHERE review_request_sent_at IS NULL
    AND status NOT IN ('cancelled');

CREATE INDEX IF NOT EXISTS idx_print_orders_review_reminder_due
  ON print_orders(review_request_sent_at)
  WHERE review_request_reminder_sent_at IS NULL
    AND status NOT IN ('cancelled');

-- 2) shipped_at 자동 갱신 트리거 (status로 전환되는 시점에 1회 기록)
CREATE OR REPLACE FUNCTION set_print_orders_shipped_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'shipped' AND (OLD.status IS DISTINCT FROM 'shipped') AND NEW.shipped_at IS NULL THEN
    NEW.shipped_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_print_orders_set_shipped_at ON print_orders;
CREATE TRIGGER trg_print_orders_set_shipped_at
  BEFORE UPDATE ON print_orders
  FOR EACH ROW EXECUTE FUNCTION set_print_orders_shipped_at();

-- 3) 메일 발송 로그 (멱등성 + audit)
CREATE TABLE IF NOT EXISTS print_marketing_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES print_orders(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  email_type TEXT NOT NULL
    CHECK (email_type IN (
      'review_request_paid',
      'review_request_beta',
      'review_request_reminder_paid',
      'review_request_reminder_beta'
    )),
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','failed','skipped_opt_out','skipped_duplicate')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_marketing_email_log_order
  ON print_marketing_email_log(order_id, email_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_print_marketing_email_log_email
  ON print_marketing_email_log(LOWER(customer_email), created_at DESC);

ALTER TABLE print_marketing_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_email_log_admin_read ON print_marketing_email_log;
CREATE POLICY marketing_email_log_admin_read
  ON print_marketing_email_log FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE print_marketing_email_log IS '리뷰 요청·리마인더 메일 발송 audit log (멱등성 + 수신거부 추적)';

-- 4) 이메일 수신거부 (opt-out)
CREATE TABLE IF NOT EXISTS print_email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT,
  source TEXT,  -- 'link' | 'manual' | 'bounce' | 'complaint'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_print_email_unsubscribes_email
  ON print_email_unsubscribes(LOWER(email));

ALTER TABLE print_email_unsubscribes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_unsubscribes_admin_read ON print_email_unsubscribes;
CREATE POLICY email_unsubscribes_admin_read
  ON print_email_unsubscribes FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE print_email_unsubscribes IS '리뷰 요청 메일 수신거부 (opt-out). 메일 푸터 unsubscribe 링크가 채움.';
