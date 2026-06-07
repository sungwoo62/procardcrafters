-- =============================================================
-- A/B 실험 프레임워크 + 자동 최적화 루프 (OMO-2596)
-- 참조 패턴: OMO-2543 (굿즈 분석→마케팅 자동 최적화 피드백 루프)
-- print_ prefix, 공유 Supabase(ilcfemvqommqyoohfoxw), RLS service_role
-- =============================================================

-- ── 실험 정의 (변형·지표·승자) ────────────────────────────────
CREATE TABLE IF NOT EXISTS print_marketing_experiments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 코드/배정에서 참조하는 안정적 슬러그 (예: 'pdp_cta_copy')
  key                  TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  description          TEXT,
  -- 실험이 동작하는 표면 (예: 'product_page', 'hero', 'pricing', 'checkout')
  surface              TEXT NOT NULL DEFAULT 'unknown',
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
  -- 승자 판정 기준 지표
  goal_metric          TEXT NOT NULL DEFAULT 'cvr'
                         CHECK (goal_metric IN ('cvr', 'ctr', 'rpv', 'aov')),
  -- 자동 최적화 게이트
  min_sample_per_variant INTEGER NOT NULL DEFAULT 200,
  confidence_level     NUMERIC NOT NULL DEFAULT 0.95
                         CHECK (confidence_level > 0.5 AND confidence_level < 1),
  -- 유의한 승자 발견 시 자동 채택 여부
  auto_promote         BOOLEAN NOT NULL DEFAULT true,
  -- 최대 운영 기간(일). 초과 + 미결 시 자동 종료(최고 성과 채택)
  max_runtime_days     INTEGER NOT NULL DEFAULT 30,
  winner_variant_id    UUID,
  decided_at           TIMESTAMPTZ,
  decision_reason      TEXT,
  started_at           TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE print_marketing_experiments IS 'A/B 실험 정의: 변형·지표·승자 (OMO-2596)';
COMMENT ON COLUMN print_marketing_experiments.goal_metric IS 'cvr=전환율, ctr=클릭률, rpv=방문당매출, aov=객단가';

-- ── 실험 변형 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_marketing_experiment_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES print_marketing_experiments(id) ON DELETE CASCADE,
  -- 실험 내 변형 키 (예: 'control', 'A', 'B')
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  is_control      BOOLEAN NOT NULL DEFAULT false,
  -- 가중 배정 (높을수록 더 많이 노출)
  weight          INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 0),
  -- 변형별 페이로드 (카피/색상/가격 등 클라이언트가 해석)
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 패자 비활성화 시 false → 배정 풀에서 제외
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT print_experiment_variant_key_unique UNIQUE (experiment_id, key)
);

COMMENT ON TABLE print_marketing_experiment_variants IS 'A/B 실험 변형 (가중·config·활성)';

ALTER TABLE print_marketing_experiments
  ADD CONSTRAINT print_experiment_winner_fk
  FOREIGN KEY (winner_variant_id)
  REFERENCES print_marketing_experiment_variants(id) ON DELETE SET NULL;

-- ── 변형 배정 (sticky, 세션별 고정) ──────────────────────────
CREATE TABLE IF NOT EXISTS print_marketing_experiment_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES print_marketing_experiments(id) ON DELETE CASCADE,
  variant_id      UUID NOT NULL REFERENCES print_marketing_experiment_variants(id) ON DELETE CASCADE,
  -- 비로그인 식별용 세션 ID (localStorage uuid)
  session_id      TEXT NOT NULL,
  user_id         UUID,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT print_experiment_assignment_unique UNIQUE (experiment_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_print_exp_assign_variant
  ON print_marketing_experiment_assignments (variant_id);

COMMENT ON TABLE print_marketing_experiment_assignments IS '세션별 변형 고정 배정 (sticky)';

-- ── 노출/전환 이벤트 수집 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_marketing_experiment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES print_marketing_experiments(id) ON DELETE CASCADE,
  variant_id      UUID NOT NULL REFERENCES print_marketing_experiment_variants(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL
                    CHECK (event_type IN ('impression', 'click', 'conversion')),
  session_id      TEXT,
  user_id         UUID,
  -- 전환 매출(USD 등) — rpv/aov 산출용
  value           NUMERIC NOT NULL DEFAULT 0,
  -- 주문 등 연결 (있을 때)
  order_id        UUID REFERENCES print_orders(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_exp_events_variant_type
  ON print_marketing_experiment_events (variant_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_exp_events_experiment
  ON print_marketing_experiment_events (experiment_id, occurred_at DESC);

COMMENT ON TABLE print_marketing_experiment_events IS '노출/클릭/전환 이벤트 (성과 수집)';

-- ── 변형별 성과 집계 뷰 (평가·승자판정 입력) ──────────────────
CREATE OR REPLACE VIEW print_marketing_experiment_perf AS
SELECT
  v.experiment_id,
  v.id                                                      AS variant_id,
  v.key                                                     AS variant_key,
  v.name                                                    AS variant_name,
  v.is_control,
  v.is_active,
  v.weight,
  COUNT(*) FILTER (WHERE e.event_type = 'impression')       AS impressions,
  COUNT(*) FILTER (WHERE e.event_type = 'click')            AS clicks,
  COUNT(*) FILTER (WHERE e.event_type = 'conversion')       AS conversions,
  COALESCE(SUM(e.value) FILTER (WHERE e.event_type = 'conversion'), 0) AS revenue,
  -- 전환율 = 전환 / 노출
  CASE WHEN COUNT(*) FILTER (WHERE e.event_type = 'impression') > 0
    THEN COUNT(*) FILTER (WHERE e.event_type = 'conversion')::numeric
       / COUNT(*) FILTER (WHERE e.event_type = 'impression')
    ELSE 0 END                                              AS cvr,
  -- 클릭률 = 클릭 / 노출
  CASE WHEN COUNT(*) FILTER (WHERE e.event_type = 'impression') > 0
    THEN COUNT(*) FILTER (WHERE e.event_type = 'click')::numeric
       / COUNT(*) FILTER (WHERE e.event_type = 'impression')
    ELSE 0 END                                              AS ctr,
  -- 방문당 매출 = 매출 / 노출
  CASE WHEN COUNT(*) FILTER (WHERE e.event_type = 'impression') > 0
    THEN COALESCE(SUM(e.value) FILTER (WHERE e.event_type = 'conversion'), 0)
       / COUNT(*) FILTER (WHERE e.event_type = 'impression')
    ELSE 0 END                                              AS rpv,
  -- 객단가 = 매출 / 전환
  CASE WHEN COUNT(*) FILTER (WHERE e.event_type = 'conversion') > 0
    THEN COALESCE(SUM(e.value) FILTER (WHERE e.event_type = 'conversion'), 0)
       / COUNT(*) FILTER (WHERE e.event_type = 'conversion')
    ELSE 0 END                                              AS aov
FROM print_marketing_experiment_variants v
LEFT JOIN print_marketing_experiment_events e ON e.variant_id = v.id
GROUP BY v.id;

COMMENT ON VIEW print_marketing_experiment_perf IS '변형별 노출/클릭/전환/매출 + CVR/CTR/RPV/AOV (OMO-2596)';

-- ── updated_at 자동 갱신 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION print_marketing_experiments_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_print_experiments_touch ON print_marketing_experiments;
CREATE TRIGGER trg_print_experiments_touch
  BEFORE UPDATE ON print_marketing_experiments
  FOR EACH ROW EXECUTE FUNCTION print_marketing_experiments_touch();

-- ── RLS: 모든 접근 service_role (어드민/서버 API 경유) ─────────
ALTER TABLE print_marketing_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_marketing_experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_marketing_experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_marketing_experiment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_experiments_service_role_all" ON print_marketing_experiments;
CREATE POLICY "print_experiments_service_role_all"
  ON print_marketing_experiments FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "print_exp_variants_service_role_all" ON print_marketing_experiment_variants;
CREATE POLICY "print_exp_variants_service_role_all"
  ON print_marketing_experiment_variants FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "print_exp_assign_service_role_all" ON print_marketing_experiment_assignments;
CREATE POLICY "print_exp_assign_service_role_all"
  ON print_marketing_experiment_assignments FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "print_exp_events_service_role_all" ON print_marketing_experiment_events;
CREATE POLICY "print_exp_events_service_role_all"
  ON print_marketing_experiment_events FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- DOWN
-- DROP VIEW IF EXISTS print_marketing_experiment_perf;
-- DROP TABLE IF EXISTS print_marketing_experiment_events CASCADE;
-- DROP TABLE IF EXISTS print_marketing_experiment_assignments CASCADE;
-- DROP TABLE IF EXISTS print_marketing_experiment_variants CASCADE;
-- DROP TABLE IF EXISTS print_marketing_experiments CASCADE;
-- DROP FUNCTION IF EXISTS print_marketing_experiments_touch();
-- ============================================================
