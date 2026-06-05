-- 이메일 구독자 테이블 (쿠폰 팝업 캡처)
-- OMO-2440: 회원가입 쿠폰 팝업 이메일 저장소

CREATE TABLE IF NOT EXISTS print_email_subscribers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL,
  coupon_code     TEXT,
  source          TEXT        NOT NULL DEFAULT 'coupon_popup',
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  welcome_sent_at TIMESTAMPTZ,
  CONSTRAINT print_email_subscribers_email_unique UNIQUE(email)
);

COMMENT ON TABLE  print_email_subscribers IS '이메일 구독자 (쿠폰 팝업·마케팅 캡처). source로 유입 경로 구분.';
COMMENT ON COLUMN print_email_subscribers.coupon_code IS '발급된 쿠폰 코드. 팝업 즉시 생성.';
COMMENT ON COLUMN print_email_subscribers.welcome_sent_at IS '환영 메일 발송 완료 시각. NULL이면 미발송.';

CREATE INDEX IF NOT EXISTS print_email_subscribers_email_idx
  ON print_email_subscribers(email);

CREATE INDEX IF NOT EXISTS print_email_subscribers_subscribed_at_idx
  ON print_email_subscribers(subscribed_at DESC);

-- RLS: service_role 전용
ALTER TABLE print_email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_email_subscribers_service_role_all"
  ON print_email_subscribers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- DOWN
-- DROP TABLE IF EXISTS print_email_subscribers CASCADE;
