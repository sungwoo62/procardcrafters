-- print_beta_applications: Pre-launch 베타 테스터 모집 신청 테이블 (OMO-2421)
-- 캠페인 인프라: 신청 → 어드민 검토 → 무료 제품 코드 발급 → D+7 리뷰 요청
-- 보드 승인 완료 2026-06-05 (Path α, $1,400-2,500 예산)

CREATE TABLE IF NOT EXISTS print_beta_applications (
  id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 신청자 정보
  name                       TEXT         NOT NULL,
  email                      TEXT         NOT NULL,
  phone                      TEXT,
  shipping_address           JSONB        NOT NULL DEFAULT '{}'::jsonb,

  -- 채널 정보 (선정 평가용)
  channel                    TEXT,
  channel_handle             TEXT,
  preferred_sku              TEXT         NOT NULL
    CHECK (preferred_sku IN ('business-cards', 'flyers', 'postcards', 'eco-stickers')),
  use_case                   TEXT,

  -- 동의 (필수 게이트)
  review_commitment          BOOLEAN      NOT NULL DEFAULT FALSE,
  disclosure_acknowledged    BOOLEAN      NOT NULL DEFAULT FALSE,

  -- 상태 머신
  status                     TEXT         NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled', 'reviewed', 'expired')),
  rejected_reason            TEXT,
  approved_at                TIMESTAMPTZ,
  fulfilled_order_id         UUID         REFERENCES print_orders(id) ON DELETE SET NULL,

  -- UTM 캡처
  utm_source                 TEXT,
  utm_medium                 TEXT,
  utm_campaign               TEXT,
  utm_term                   TEXT,
  utm_content                TEXT,

  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 중복 이메일 차단 (소문자 unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_print_beta_applications_email_lower
  ON print_beta_applications (LOWER(email));

-- 어드민 큐 정렬용
CREATE INDEX IF NOT EXISTS idx_print_beta_applications_status_created
  ON print_beta_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_print_beta_applications_preferred_sku
  ON print_beta_applications (preferred_sku);

-- 코멘트
COMMENT ON TABLE print_beta_applications IS 'Pre-launch 베타 테스터 신청 (OMO-2421/OMO-2411). 선정 시 print_orders.is_complimentary=true 로 무료 주문 생성.';
COMMENT ON COLUMN print_beta_applications.status IS 'pending → approved → fulfilled → reviewed | rejected | expired';
COMMENT ON COLUMN print_beta_applications.disclosure_acknowledged IS 'FTC §255.5 무료 제공 표기 동의 (필수)';
COMMENT ON COLUMN print_beta_applications.review_commitment IS '7일 내 솔직한 리뷰 작성 동의 (필수)';
COMMENT ON COLUMN print_beta_applications.fulfilled_order_id IS 'OMO-2422 어드민 큐에서 생성된 print_orders FK';

-- RLS: 공개 INSERT 허용 (신청), 그 외 모든 SELECT/UPDATE/DELETE 차단
-- 어드민은 service_role 키로 서버사이드에서 접근
ALTER TABLE print_beta_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beta_applications_public_insert ON print_beta_applications;
CREATE POLICY beta_applications_public_insert
  ON print_beta_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

-- 어드민/서버는 service_role 로 우회. 일반 사용자에게는 SELECT 노출 금지.
