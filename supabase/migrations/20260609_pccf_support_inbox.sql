-- 20260609_pccf_support_inbox.sql
-- OMO-2774: PCCF/ProCardCrafters inbound support email → AI 1차 자동회신 파이프라인
--
-- 인바운드 고객 문의 메일을 티켓(thread)으로 적재하고, AI가 영어 1차 회신 초안을
-- 생성한다. 가드레일(첫 N건 승인 모드 + 고관여 에스컬레이션)을 위해 초안은
-- pccf_support_drafts 큐에 적재되며, 자동 발송 여부는 status 로 추적한다.
--
-- 모든 테이블은 service_role(Edge/Server route)만 접근. RLS 활성.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. pccf_support_threads — 고객별 문의 스레드(티켓)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pccf_support_threads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email        text NOT NULL,
  from_name         text,
  subject           text,
  status            text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','waiting','escalated','resolved')),
  escalated         boolean NOT NULL DEFAULT false,
  escalation_reason text,
  last_inbound_at   timestamptz,
  last_outbound_at  timestamptz,
  message_count     int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 같은 고객 이메일은 open 스레드 1개로 합쳐 추적 (resolved 는 새로 열림)
CREATE UNIQUE INDEX IF NOT EXISTS pccf_support_threads_open_email_idx
  ON pccf_support_threads (lower(from_email))
  WHERE status <> 'resolved';

CREATE INDEX IF NOT EXISTS pccf_support_threads_status_idx
  ON pccf_support_threads (status, last_inbound_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. pccf_support_messages — 스레드 내 메시지(수/발신) + 멱등성
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pccf_support_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES pccf_support_threads(id) ON DELETE CASCADE,
  direction     text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_id    text,                 -- 메일 Message-ID (멱등 키)
  from_email    text,
  to_email      text,
  subject       text,
  body_text     text,
  body_html     text,
  ai_generated  boolean NOT NULL DEFAULT false,
  received_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 멱등성: 같은 메일(Message-ID)은 한 번만 적재
CREATE UNIQUE INDEX IF NOT EXISTS pccf_support_messages_msgid_idx
  ON pccf_support_messages (message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pccf_support_messages_thread_idx
  ON pccf_support_messages (thread_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 3. pccf_support_drafts — AI 1차 회신 초안 승인 큐 (가드레일 핵심)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pccf_support_drafts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           uuid NOT NULL REFERENCES pccf_support_threads(id) ON DELETE CASCADE,
  inbound_message_id  uuid REFERENCES pccf_support_messages(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','sent','auto_sent','rejected','failed')),
  draft_subject       text,
  draft_text          text NOT NULL,
  ai_model            text,
  confidence          numeric,             -- 0~1, AI 자가 신뢰도
  escalate            boolean NOT NULL DEFAULT false,
  escalation_reason   text,
  send_error          text,
  approved_by         text,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pccf_support_drafts_status_idx
  ON pccf_support_drafts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS pccf_support_drafts_thread_idx
  ON pccf_support_drafts (thread_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. updated_at 자동 갱신 트리거 (공용 함수 재사용 또는 생성)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pccf_support_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pccf_support_threads_updated_at ON pccf_support_threads;
CREATE TRIGGER pccf_support_threads_updated_at
  BEFORE UPDATE ON pccf_support_threads
  FOR EACH ROW EXECUTE FUNCTION pccf_support_set_updated_at();

DROP TRIGGER IF EXISTS pccf_support_drafts_updated_at ON pccf_support_drafts;
CREATE TRIGGER pccf_support_drafts_updated_at
  BEFORE UPDATE ON pccf_support_drafts
  FOR EACH ROW EXECUTE FUNCTION pccf_support_set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. RLS: service_role(Server route / Edge) 전용
-- ─────────────────────────────────────────────────────────────
ALTER TABLE pccf_support_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pccf_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pccf_support_drafts   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pccf_support_threads_service ON pccf_support_threads;
CREATE POLICY pccf_support_threads_service ON pccf_support_threads
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS pccf_support_messages_service ON pccf_support_messages;
CREATE POLICY pccf_support_messages_service ON pccf_support_messages
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS pccf_support_drafts_service ON pccf_support_drafts;
CREATE POLICY pccf_support_drafts_service ON pccf_support_drafts
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
