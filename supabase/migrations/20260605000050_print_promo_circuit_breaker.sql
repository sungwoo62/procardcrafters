-- 프로모 코드 abuse 감지 + lock history
-- OMO-2398: circuit breaker + margin 음수 알림

-- ============================================================
-- UP
-- ============================================================

-- 1. abuse 이벤트 테이블 (rate limiting 백스토어)
CREATE TABLE IF NOT EXISTS print_promo_abuse_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id     UUID        REFERENCES print_promo_codes(id) ON DELETE CASCADE,
  ip_hash     TEXT,                   -- SHA-256(IP + salt) 앞 32자, 원본 IP 미저장
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL
                CHECK (event_type IN ('attempt', 'code_locked', 'ip_blocked', 'user_blocked', 'margin_alert')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  print_promo_abuse_events IS '프로모 코드 abuse 감지 이벤트 로그. IP는 해시만 저장.';
COMMENT ON COLUMN print_promo_abuse_events.ip_hash IS 'SHA-256(ip+salt)[0:32]. 원본 IP 비저장.';

-- 1h 윈도우 쿼리용 인덱스
CREATE INDEX IF NOT EXISTS idx_promo_abuse_code_time
  ON print_promo_abuse_events (code_id, created_at);

CREATE INDEX IF NOT EXISTS idx_promo_abuse_ip_time
  ON print_promo_abuse_events (ip_hash, created_at) WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promo_abuse_user_time
  ON print_promo_abuse_events (user_id, created_at) WHERE user_id IS NOT NULL;

-- RLS: 서비스롤 전용
ALTER TABLE print_promo_abuse_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promo_abuse_service_role_all" ON print_promo_abuse_events;
CREATE POLICY "print_promo_abuse_service_role_all"
  ON print_promo_abuse_events FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================

-- 2. 코드 잠금 이력 테이블 (admin UI 표시용)
CREATE TABLE IF NOT EXISTS print_promo_code_lock_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id     UUID        NOT NULL REFERENCES print_promo_codes(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL CHECK (action IN ('locked', 'unlocked')),
  reason      TEXT,                   -- 'abuse_auto_lock' | 'admin_manual_lock' | 'admin_manual_unlock' | 'margin_alert'
  context     JSONB,                  -- 추가 데이터 (redemptions_1h, margin_usd 등)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  print_promo_code_lock_history IS '프로모 코드 lock/unlock 이력. 자동 + 수동 모두 기록.';
COMMENT ON COLUMN print_promo_code_lock_history.reason IS 'abuse_auto_lock | admin_manual_lock | admin_manual_unlock | margin_alert';
COMMENT ON COLUMN print_promo_code_lock_history.context IS '{"redemptions_1h": 152} 또는 {"margin_usd": -3.20} 등 트리거 컨텍스트.';

CREATE INDEX IF NOT EXISTS idx_promo_lock_history_code
  ON print_promo_code_lock_history (code_id, created_at DESC);

-- RLS: 서비스롤 전용
ALTER TABLE print_promo_code_lock_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promo_lock_history_service_role_all" ON print_promo_code_lock_history;
CREATE POLICY "print_promo_lock_history_service_role_all"
  ON print_promo_code_lock_history FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- DOWN
-- DROP TABLE IF EXISTS print_promo_code_lock_history CASCADE;
-- DROP TABLE IF EXISTS print_promo_abuse_events CASCADE;
-- ============================================================
