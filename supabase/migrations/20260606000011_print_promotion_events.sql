-- 프로모션 funnel 이벤트 추적 테이블
-- OMO-2397: promo_impression → promo_code_redeem 6단계 funnel

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS print_promotion_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL
                 REFERENCES print_promotion_campaigns(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL
                 CHECK (event_type IN (
                   'promo_impression',
                   'promo_click',
                   'promo_code_view',
                   'promo_add_to_cart',
                   'promo_checkout_start',
                   'promo_code_redeem'
                 )),
  -- 노출 표면
  surface      TEXT        NOT NULL DEFAULT 'unknown'
                 CHECK (surface IN ('megamenu', 'hero', 'toast', 'lp', 'unknown')),
  code         TEXT,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id   TEXT,
  product_slug TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  print_promotion_events IS 'promo funnel 이벤트 로그. 단계별 전환율 분석용.';
COMMENT ON COLUMN print_promotion_events.surface IS '이벤트 발생 표면: megamenu/hero/toast/lp/unknown';
COMMENT ON COLUMN print_promotion_events.session_id IS '비로그인 사용자 식별용 임시 세션 ID (localStorage uuid)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_print_promo_events_campaign_type
  ON print_promotion_events (campaign_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_print_promo_events_campaign_hour
  ON print_promotion_events (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_print_promo_events_user
  ON print_promotion_events (user_id, campaign_id)
  WHERE user_id IS NOT NULL;

-- RLS: 쓰기는 service_role만, 읽기도 service_role (어드민 API 경유)
ALTER TABLE print_promotion_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promo_events_service_role_all" ON print_promotion_events;
CREATE POLICY "print_promo_events_service_role_all"
  ON print_promotion_events FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- DOWN
-- DROP TABLE IF EXISTS print_promotion_events CASCADE;
-- ============================================================
