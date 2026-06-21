-- OMO-2914 (R2) — 라이브 퍼널 1st-party 상단 계측 싱크
-- 배경: 라이브 전환 동선 = products/[slug](view) → /order(begin_checkout) → 주문생성 → 결제.
--   주문생성(print_orders)·결제(print_order_events)는 이미 DB 쿼리 가능하나,
--   상단 단계(view_item / begin_checkout)는 GA4/dataLayer 전용이라 DB에서 못 본다.
--   GA4 Data API 조회는 보드 키 대기(OMO-2894)로 막혀 있어, 위클리 신호 루틴(OMO-2891)이
--   cart→order 이탈을 측정할 수 없다. 이 테이블이 그 갭을 메운다(omoongmoo goods_analytics_events 대응).
-- 적재: 클라이언트 analytics.ts → /api/analytics/funnel-event(fire-and-forget) → service_role insert.
CREATE TABLE IF NOT EXISTS print_funnel_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT        NOT NULL CHECK (event_type IN (
    'view_item',        -- 제품 상세 조회 (products/[slug])
    'begin_checkout'    -- 주문폼 진입 (/order)
  )),
  session_id    TEXT,                  -- 익명 세션 식별자(localStorage _pcsid) — 세션 단위 퍼널 집계용
  product_id    TEXT,
  product_slug  TEXT,
  product_name  TEXT,
  category      TEXT,
  value         NUMERIC,               -- begin_checkout 시 예상 주문 금액(USD)
  path          TEXT,                  -- 발생 경로(이탈 분석용)
  referrer      TEXT,                  -- 유입 referrer(신규 vs 재방문/채널 분석용)
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 위클리 루틴은 created_at 범위 + event_type 으로 집계 → 복합 인덱스.
CREATE INDEX IF NOT EXISTS print_funnel_events_type_created_idx
  ON print_funnel_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS print_funnel_events_session_idx
  ON print_funnel_events (session_id, created_at DESC);

-- RLS: service_role(서버 라우트)만 읽기/쓰기. 클라이언트는 라우트를 통해서만 적재.
ALTER TABLE print_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_print_funnel_events" ON print_funnel_events;
CREATE POLICY "service_role_all_print_funnel_events"
  ON print_funnel_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
