-- =====================================================================
-- OMO-2600: print_cs_threads — CS 문의→첫응답 타임스탬프 계측
--   부모 OMO-2593 (북극성 축2→3 고객만족 KPI).
--
--   목적: CS 문의(이메일/문의폼/CSAgent챗/카카오/네이버톡톡)의
--         opened_at / first_response_at / resolved_at 을 적재해
--         **CS 응답시간 = first_response_at − opened_at** 을 정량화.
--
--   설계 메모:
--     - is_automated: AI 견적챗(CSAgent)은 즉시(≈0초) 응답하는 셀프서비스라
--       사람 CS SLA를 왜곡한다. is_automated=true 로 분리 기록하여
--       사람 채널(이메일/문의폼/톡) 응답시간과 섞이지 않게 한다.
--     - external_ref: 챗 session_id / 이메일 Message-ID / 톡 thread id 등
--       채널 원본 식별자. (channel, external_ref) UNIQUE 로 멱등 적재.
--   RLS: service_role 전용(공개 노출 없음). 챗 라우트는 service_role 클라이언트
--        (createServerClient)로 기록하므로 RLS 우회.
-- =====================================================================

-- ─────────────────────────────────────────────
-- ENUM
-- ─────────────────────────────────────────────
CREATE TYPE print_cs_channel AS ENUM (
  'email',         -- hello@procardcrafters.com 인입
  'contact_form',  -- 사이트 문의폼(향후)
  'chat',          -- AI 견적챗(CSAgent) — is_automated=true 로 기록
  'kakao',         -- 카카오 상담
  'naver_talk',    -- 네이버 톡톡
  'phone'          -- 전화 상담 수기 기록
);

CREATE TYPE print_cs_status AS ENUM (
  'open',          -- 문의 인입, 첫응답 전
  'responded',     -- 첫응답 완료(first_response_at 채워짐)
  'resolved',      -- 해결 완료
  'closed'         -- 종료(미해결 종료 포함)
);

-- ─────────────────────────────────────────────
-- print_cs_threads
-- ─────────────────────────────────────────────
CREATE TABLE print_cs_threads (
  id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 주문 연계(비회원/주문무관 문의는 NULL 허용)
  order_id          UUID             REFERENCES print_orders(id) ON DELETE SET NULL,
  channel           print_cs_channel NOT NULL,
  customer_email    TEXT,
  subject           TEXT,
  -- 채널 원본 식별자(챗 session_id 등) — 멱등 적재 키
  external_ref      TEXT,
  -- AI 셀프서비스 챗 여부(사람 CS SLA에서 제외)
  is_automated      BOOLEAN          NOT NULL DEFAULT false,
  assignee          TEXT,            -- 응대자(에이전트/사람) 식별자
  -- KPI 타임스탬프
  opened_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  status            print_cs_status  NOT NULL DEFAULT 'open',
  note              TEXT,
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  -- 첫응답/해결 시각은 인입 이후여야 함
  CONSTRAINT chk_cs_first_response_after_open
    CHECK (first_response_at IS NULL OR first_response_at >= opened_at),
  CONSTRAINT chk_cs_resolved_after_open
    CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
);

-- 멱등 적재: 채널 원본 식별자가 있으면 (channel, external_ref) 유일
CREATE UNIQUE INDEX print_cs_threads_channel_extref
  ON print_cs_threads(channel, external_ref)
  WHERE external_ref IS NOT NULL;

CREATE INDEX print_cs_threads_status      ON print_cs_threads(status);
CREATE INDEX print_cs_threads_channel     ON print_cs_threads(channel);
CREATE INDEX print_cs_threads_opened_at   ON print_cs_threads(opened_at DESC);
CREATE INDEX print_cs_threads_order_id    ON print_cs_threads(order_id) WHERE order_id IS NOT NULL;
-- 미응답 오픈 문의(사람 채널) 빠른 조회
CREATE INDEX print_cs_threads_open_human
  ON print_cs_threads(opened_at)
  WHERE first_response_at IS NULL AND is_automated = false;

-- ─────────────────────────────────────────────
-- 상태 자동 정합 트리거
--   first_response_at 채워지면 status 'open'→'responded' (이미 더 진행됐으면 유지)
--   resolved_at 채워지면 status→'resolved'
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION print_cs_threads_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.resolved_at IS NOT NULL AND NEW.status NOT IN ('resolved', 'closed') THEN
    NEW.status := 'resolved';
  ELSIF NEW.first_response_at IS NOT NULL AND NEW.status = 'open' THEN
    NEW.status := 'responded';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER print_cs_threads_sync_status_trg
  BEFORE INSERT OR UPDATE ON print_cs_threads
  FOR EACH ROW EXECUTE FUNCTION print_cs_threads_sync_status();

-- ─────────────────────────────────────────────
-- 뷰: print_cs_response_metrics (행별 응답시간)
--   CS 응답시간 = first_response_at − opened_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW print_cs_response_metrics AS
SELECT
  id,
  channel,
  is_automated,
  order_id,
  customer_email,
  status,
  opened_at,
  first_response_at,
  resolved_at,
  EXTRACT(EPOCH FROM (first_response_at - opened_at)) AS first_response_seconds,
  EXTRACT(EPOCH FROM (resolved_at - opened_at))       AS resolution_seconds
FROM print_cs_threads;

-- ─────────────────────────────────────────────
-- 뷰: print_cs_response_kpi (대시보드 집계)
--   사람 채널(is_automated=false)을 SLA 기준으로 분리 집계.
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW print_cs_response_kpi AS
SELECT
  -- 사람 채널 SLA
  COUNT(*) FILTER (WHERE NOT is_automated)                                          AS human_threads,
  COUNT(*) FILTER (WHERE NOT is_automated AND first_response_at IS NOT NULL)        AS human_responded,
  COUNT(*) FILTER (WHERE NOT is_automated AND first_response_at IS NULL
                        AND status NOT IN ('resolved', 'closed'))                   AS human_open_unanswered,
  ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - opened_at)))
        FILTER (WHERE NOT is_automated AND first_response_at IS NOT NULL)::NUMERIC, 1)
                                                                                     AS human_avg_first_response_seconds,
  -- 자동 챗(참고용 — 셀프서비스 디플렉션)
  COUNT(*) FILTER (WHERE is_automated)                                              AS automated_threads,
  ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - opened_at)))
        FILTER (WHERE is_automated AND first_response_at IS NOT NULL)::NUMERIC, 1)
                                                                                     AS automated_avg_first_response_seconds
FROM print_cs_threads;

-- ─────────────────────────────────────────────
-- RLS: service_role 전용
-- ─────────────────────────────────────────────
ALTER TABLE print_cs_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_cs_threads_service_all"
  ON print_cs_threads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- DOWN (참고용)
-- DROP VIEW  IF EXISTS print_cs_response_kpi;
-- DROP VIEW  IF EXISTS print_cs_response_metrics;
-- DROP TABLE IF EXISTS print_cs_threads;
-- DROP FUNCTION IF EXISTS print_cs_threads_sync_status();
-- DROP TYPE  IF EXISTS print_cs_status;
-- DROP TYPE  IF EXISTS print_cs_channel;
-- ─────────────────────────────────────────────
