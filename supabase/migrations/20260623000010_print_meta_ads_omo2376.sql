-- PCCF Meta Ads 자동화 테이블 (OMO-2376)
-- prefix: print_ads_ (procardcrafters US POD, 공유 Supabase ilcfemvqommqyoohfoxw — OMO-3661 grandfather: procard=print_)

-- 1. Graph API 호출 로그
CREATE TABLE IF NOT EXISTS print_ads_api_log (
  id              BIGSERIAL   PRIMARY KEY,
  endpoint        TEXT        NOT NULL,
  method          TEXT        NOT NULL DEFAULT 'GET',
  status_code     INTEGER,
  error_code      INTEGER,
  error_subcode   INTEGER,
  error_message   TEXT,
  spend_cents     INTEGER,
  duration_ms     INTEGER,
  dry_run         BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE print_ads_api_log IS 'Meta Graph API v22 호출 기록 (OMO-2376)';

-- 2. 정책 거절 로그 (가드레일 B)
CREATE TABLE IF NOT EXISTS print_ads_rejection_log (
  id              BIGSERIAL   PRIMARY KEY,
  campaign_id     TEXT,
  adset_id        TEXT,
  ad_id           TEXT,
  error_subcode   INTEGER,
  error_message   TEXT        NOT NULL,
  payload         JSONB,
  reviewed_at     TIMESTAMPTZ,
  resubmitted_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE print_ads_rejection_log IS 'Meta 정책 거절 기록 — 자동 재제출 금지, 수동 검토 필수 (가드레일 B)';

-- 3. 신규 캠페인 7일 학습락 (가드레일 C)
CREATE TABLE IF NOT EXISTS print_ads_learning_lock (
  id              BIGSERIAL   PRIMARY KEY,
  campaign_id     TEXT        NOT NULL UNIQUE,
  campaign_name   TEXT,
  locked_until    TIMESTAMPTZ NOT NULL,
  unlocked_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE print_ads_learning_lock IS 'Meta learning phase 7일 락 — 락 중 budget/타겟팅 변경 금지 (가드레일 C)';

CREATE INDEX IF NOT EXISTS idx_print_ads_learning_lock_campaign_id
  ON print_ads_learning_lock (campaign_id);
CREATE INDEX IF NOT EXISTS idx_print_ads_learning_lock_locked_until
  ON print_ads_learning_lock (locked_until) WHERE unlocked_at IS NULL;

-- 4. 일일 지출 스냅샷 (가드레일 A 캡 검증)
CREATE TABLE IF NOT EXISTS print_ads_daily_spend (
  id              BIGSERIAL   PRIMARY KEY,
  spend_date      DATE        NOT NULL,
  spend_cents     INTEGER     NOT NULL DEFAULT 0,
  cap_cents       INTEGER     NOT NULL DEFAULT 2000,
  capped_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spend_date)
);

COMMENT ON TABLE print_ads_daily_spend IS '일일 지출 스냅샷 — $20 캡 검증용 (가드레일 A). 단위: cents';

-- 5. 15분 ROAS 시계열 (가드레일 D)
CREATE TABLE IF NOT EXISTS print_ads_roas_snapshot (
  id              BIGSERIAL   PRIMARY KEY,
  campaign_id     TEXT        NOT NULL,
  campaign_name   TEXT,
  impressions     INTEGER     NOT NULL DEFAULT 0,
  clicks          INTEGER     NOT NULL DEFAULT 0,
  spend_cents     INTEGER     NOT NULL DEFAULT 0,
  revenue_cents   INTEGER     NOT NULL DEFAULT 0,
  roas            NUMERIC(10, 4) GENERATED ALWAYS AS (
    CASE WHEN spend_cents = 0 THEN 0
         ELSE revenue_cents::NUMERIC / spend_cents
    END
  ) STORED,
  action          TEXT,  -- 'scale_up' | 'pause' | 'monitor'
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE print_ads_roas_snapshot IS 'ROAS 15분 시계열 — 스케일/킬 판단 기준 (가드레일 D). 단위: cents';

CREATE INDEX IF NOT EXISTS idx_print_ads_roas_snapshot_campaign_at
  ON print_ads_roas_snapshot (campaign_id, snapshot_at DESC);

-- RLS: service role만 접근 (공개 읽기 불필요)
ALTER TABLE print_ads_api_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_ads_rejection_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_ads_learning_lock  ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_ads_daily_spend    ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_ads_roas_snapshot  ENABLE ROW LEVEL SECURITY;
