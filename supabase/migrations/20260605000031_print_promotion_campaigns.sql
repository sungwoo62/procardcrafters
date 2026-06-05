-- 시즌 프로모션 캠페인 (연도×시즌 인스턴스)
-- OMO-2390: 프로모션 DB migration 5종 중 2/5

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS print_promotion_campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id     UUID        NOT NULL
                    REFERENCES print_promotion_calendar(id) ON DELETE CASCADE,
  year            INT         NOT NULL CHECK (year >= 2024 AND year <= 2100),
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
  promo_start_at  TIMESTAMPTZ,
  promo_end_at    TIMESTAMPTZ,
  peak_start_at   TIMESTAMPTZ,
  order_cutoff_at TIMESTAMPTZ,
  headline_ko     TEXT,
  headline_en     TEXT,
  hero_image_url  TEXT,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (calendar_id, year)
);

COMMENT ON TABLE  print_promotion_campaigns IS '캘린더 시즌의 연도별 실행 인스턴스';
COMMENT ON COLUMN print_promotion_campaigns.status IS 'draft→scheduled→live→ended. cancelled=취소.';
COMMENT ON COLUMN print_promotion_campaigns.order_cutoff_at IS '이 시각 이후 주문은 프로모션 가격 미적용';

-- 자동 updated_at (print_set_updated_at 함수는 migration 30에서 생성)
DROP TRIGGER IF EXISTS print_promotion_campaigns_updated_at ON print_promotion_campaigns;
CREATE TRIGGER print_promotion_campaigns_updated_at
  BEFORE UPDATE ON print_promotion_campaigns
  FOR EACH ROW EXECUTE FUNCTION print_set_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_print_campaigns_status_start
  ON print_promotion_campaigns (status, promo_start_at);

CREATE INDEX IF NOT EXISTS idx_print_campaigns_calendar_year
  ON print_promotion_campaigns (calendar_id, year);

-- RLS: live 상태만 공개 읽기, 나머지는 service_role
ALTER TABLE print_promotion_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promotion_campaigns_public_live" ON print_promotion_campaigns;
CREATE POLICY "print_promotion_campaigns_public_live"
  ON print_promotion_campaigns FOR SELECT
  USING (status = 'live');

DROP POLICY IF EXISTS "print_promotion_campaigns_service_role_all" ON print_promotion_campaigns;
CREATE POLICY "print_promotion_campaigns_service_role_all"
  ON print_promotion_campaigns FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- DOWN
-- DROP TABLE IF EXISTS print_promotion_campaigns CASCADE;
-- ============================================================
