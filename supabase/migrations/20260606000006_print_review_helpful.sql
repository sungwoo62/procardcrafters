-- =====================================================================
-- OMO-2404: print_review_helpful + helpful_count
--   - print_review_helpful: IP + user 중복 방지 테이블
--   - print_reviews.helpful_count: 집계 카운터
-- =====================================================================

-- ─────────────────────────────────────────────
-- print_reviews에 helpful_count 컬럼 추가
-- ─────────────────────────────────────────────
ALTER TABLE print_reviews ADD COLUMN IF NOT EXISTS helpful_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS print_reviews_helpful_count
  ON print_reviews(helpful_count DESC);

-- ─────────────────────────────────────────────
-- print_review_helpful: 도움이 됐어요 투표 추적
-- 로그인: user_id 기준 유니크
-- 비로그인: ip_address 기준 유니크 (partial index)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_review_helpful (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID        NOT NULL REFERENCES print_reviews(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 로그인 유저: (review_id, user_id) 유니크 (NULL은 허용 — 비로그인)
  CONSTRAINT uq_helpful_user UNIQUE NULLS NOT DISTINCT (review_id, user_id),
  -- 최소 하나의 식별자 필요
  CONSTRAINT chk_helpful_identity CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- 비로그인(IP) 중복 방지 partial index
CREATE UNIQUE INDEX IF NOT EXISTS uq_helpful_ip
  ON print_review_helpful(review_id, ip_address)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS print_review_helpful_review_id
  ON print_review_helpful(review_id);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE print_review_helpful ENABLE ROW LEVEL SECURITY;

-- 어드민(service_role) 전체 접근 — API Route는 service_role 사용
CREATE POLICY "print_review_helpful_admin_all"
  ON print_review_helpful FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- DOWN (참고용)
-- DROP TABLE IF EXISTS print_review_helpful;
-- ALTER TABLE print_reviews DROP COLUMN IF EXISTS helpful_count;
-- ─────────────────────────────────────────────
