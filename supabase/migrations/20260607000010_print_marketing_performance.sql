-- =============================================================
-- 마케팅 성과측정 토대 (OMO-2587 · 북극성 축3)
-- print_ prefix, 공유 Supabase(ilcfemvqommqyoohfoxw)
-- additive only — medal_/ops_ 등 타 서비스 영향 없음
-- =============================================================

-- ────────────────────────────────────────────────────────────
-- 1) 주문 채널 귀속(attribution) 컬럼
--    체크아웃 시점에 캡처(별도 child 이슈에서 wiring). 전부 nullable.
--    채널별 매출 기여 / CVR 분석의 1차 소스.
-- ────────────────────────────────────────────────────────────
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS gclid        TEXT,  -- Google Ads click id
  ADD COLUMN IF NOT EXISTS fbclid       TEXT,  -- Meta click id
  ADD COLUMN IF NOT EXISTS landing_path TEXT,  -- 최초 진입 경로
  ADD COLUMN IF NOT EXISTS referrer_host TEXT; -- document.referrer 호스트

COMMENT ON COLUMN print_orders.utm_source IS 'UTM source (예: google, facebook, newsletter)';
COMMENT ON COLUMN print_orders.gclid IS 'Google Ads click id — 유료검색 귀속/ROAS 매칭용';

CREATE INDEX IF NOT EXISTS idx_print_orders_attribution
  ON print_orders (utm_source, utm_medium, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 2) 광고비 집계 테이블 (ROAS/CPA 산출)
--    Google Ads/Meta API 또는 수기 입력으로 일배치 적재(별도 child 이슈).
--    채널×캠페인×일자 단위 upsert.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_ad_spend (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  spend_date  DATE        NOT NULL,
  channel     TEXT        NOT NULL,          -- google_ads / meta / tiktok / ...
  campaign    TEXT        NOT NULL DEFAULT '(all)',
  spend_usd   NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions BIGINT      NOT NULL DEFAULT 0,
  clicks      BIGINT      NOT NULL DEFAULT 0,
  conversions NUMERIC(12,2) NOT NULL DEFAULT 0,  -- 플랫폼 보고 전환수
  source      TEXT        NOT NULL DEFAULT 'manual'
                CHECK (source IN ('google_ads','meta','tiktok','manual')),
  currency    TEXT        NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spend_date, channel, campaign)
);

COMMENT ON TABLE print_ad_spend IS '채널×캠페인×일자 광고비/노출/클릭 집계. ROAS=매출/spend, CPA=spend/전환.';

CREATE INDEX IF NOT EXISTS idx_print_ad_spend_date
  ON print_ad_spend (spend_date DESC, channel);

ALTER TABLE print_ad_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_ad_spend_service_role_all" ON print_ad_spend;
CREATE POLICY "print_ad_spend_service_role_all"
  ON print_ad_spend FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- DOWN
-- ALTER TABLE print_orders
--   DROP COLUMN IF EXISTS utm_source, DROP COLUMN IF EXISTS utm_medium,
--   DROP COLUMN IF EXISTS utm_campaign, DROP COLUMN IF EXISTS utm_term,
--   DROP COLUMN IF EXISTS utm_content, DROP COLUMN IF EXISTS gclid,
--   DROP COLUMN IF EXISTS fbclid, DROP COLUMN IF EXISTS landing_path,
--   DROP COLUMN IF EXISTS referrer_host;
-- DROP TABLE IF EXISTS print_ad_spend CASCADE;
-- ============================================================
