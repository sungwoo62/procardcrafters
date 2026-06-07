-- 공장 발주 파이프라인 헬스 스냅샷 (북극성 축1: 업무 풀 자동화 / 축2: 성과측정)
-- /api/cron/factory-pipeline-health 가 주기적으로 INSERT 한다.
-- 자동화 커버리지(수동개입 비율) 추세와 드리프트 발생 이력을 기록한다.
CREATE TABLE IF NOT EXISTS print_factory_pipeline_health (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 큐 상태 집계
  total_factory_orders     INTEGER     NOT NULL DEFAULT 0,
  placed_count             INTEGER     NOT NULL DEFAULT 0,
  pending_count            INTEGER     NOT NULL DEFAULT 0,
  placing_count            INTEGER     NOT NULL DEFAULT 0,
  failed_count             INTEGER     NOT NULL DEFAULT 0,
  -- 드리프트 신호
  stalled_placing_count    INTEGER     NOT NULL DEFAULT 0,  -- placing 잠금 후 임계시간 초과 (워커 사망)
  stale_pending_count      INTEGER     NOT NULL DEFAULT 0,  -- pending 임계시간 초과 (큐 미배출)
  unowned_paid_count       INTEGER     NOT NULL DEFAULT 0,  -- 결제+시안승인됐으나 발주 미생성 (핸드오프 단절)
  requeued_count           INTEGER     NOT NULL DEFAULT 0,  -- 이번 실행에서 self-heal 재할당한 건수
  -- 자동화 커버리지 지표 (북극성 축2)
  automation_coverage_pct  NUMERIC(5,2) NOT NULL DEFAULT 0, -- placed / total * 100
  manual_intervention_pct  NUMERIC(5,2) NOT NULL DEFAULT 0, -- (failed + stalled + unowned) / total * 100
  severity                 TEXT        NOT NULL DEFAULT 'ok'
                                       CHECK (severity IN ('ok', 'warning', 'critical')),
  details                  JSONB       NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS print_factory_pipeline_health_created_idx
  ON print_factory_pipeline_health (created_at DESC);

ALTER TABLE print_factory_pipeline_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_print_factory_pipeline_health"
  ON print_factory_pipeline_health
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
