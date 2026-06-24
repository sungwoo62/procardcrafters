-- OMO-2597 주간 마케팅 개선 리뷰 자동 생성 (routine)
-- 북극성 축3 '마케팅 성과측정 및 평가와 개선' 루프 마감.
-- 주 1회 cron이 측정 가능 데이터를 집계해 전주 대비 추세 + 실행 가능한
-- 개선 제안을 생성하고 이 테이블에 영속화한다(리포트 산출물 + 이력 추적).

CREATE TABLE IF NOT EXISTS print_marketing_reviews (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 리뷰 대상 주(week) 경계. period_start = 월요일 00:00 UTC.
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  -- 집계 결과 전체(매출/주문/퍼널/이메일/실험) + 전주 대비 델타.
  metrics       JSONB       NOT NULL DEFAULT '{}',
  -- 실행 가능한 개선 제안 배열(budget 재배분 / SEO 주제 / 랜딩 개선 등).
  suggestions   JSONB       NOT NULL DEFAULT '[]',
  -- 데이터 부족으로 산출 불가한 지표 + 언블록 의존성(ROAS/CPA/채널귀속/사이트CVR).
  data_gaps     JSONB       NOT NULL DEFAULT '[]',
  -- 사람이 읽는 마크다운 요약(코멘트/이메일에 그대로 사용).
  summary_md    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 같은 주는 1건만 유지(cron 재실행 시 upsert 대상).
  CONSTRAINT print_marketing_reviews_period_unique UNIQUE (period_start)
);

CREATE INDEX IF NOT EXISTS idx_print_marketing_reviews_period
  ON print_marketing_reviews (period_start DESC);

-- RLS: service_role(서버 cron)만 쓰기, 인증 사용자(admin)는 읽기.
ALTER TABLE print_marketing_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS print_marketing_reviews_service_all ON print_marketing_reviews;
CREATE POLICY print_marketing_reviews_service_all
  ON print_marketing_reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS print_marketing_reviews_auth_read ON print_marketing_reviews;
CREATE POLICY print_marketing_reviews_auth_read
  ON print_marketing_reviews
  FOR SELECT
  TO authenticated
  USING (true);
