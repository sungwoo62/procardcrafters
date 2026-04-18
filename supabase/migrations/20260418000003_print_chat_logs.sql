-- =============================================================
-- print_chat_logs: AI 견적 챗봇 대화 로그
-- =============================================================

CREATE TABLE IF NOT EXISTS print_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,               -- 브라우저 세션 식별자 (UUID, 클라이언트 생성)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  -- 견적 추출 결과 (assistant 메시지에서 파싱, nullable)
  estimate_product TEXT,
  estimate_quantity INT,
  estimate_size TEXT,
  estimate_finish TEXT,
  estimate_price_usd NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS print_chat_logs_session_idx ON print_chat_logs(session_id);
CREATE INDEX IF NOT EXISTS print_chat_logs_created_at_idx ON print_chat_logs(created_at DESC);

-- RLS: 익명 사용자 insert 허용 (챗봇 사용 로그), select는 service_role만
ALTER TABLE print_chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_chat_logs_insert_anon"
  ON print_chat_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- service_role은 RLS 우회 가능 (어드민 API에서 사용)
