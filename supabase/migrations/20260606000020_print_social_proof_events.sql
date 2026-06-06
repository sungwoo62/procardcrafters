-- =============================================================
-- Social Proof 감사 로그 테이블 (OMO-2441)
-- print_ prefix, 공유 Supabase(ilcfemvqommqyoohfoxw)
-- =============================================================

-- 토스트 노출 이벤트 로그
CREATE TABLE IF NOT EXISTS print_social_proof_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toast_id        TEXT NOT NULL,
  toast_type      TEXT NOT NULL CHECK (toast_type IN (
                    'recent_order', 'viewer_count', 'weekly_stats',
                    'stock_alert', 'deadline'
                  )),
  -- 연결된 주문 (recent_order 타입에만 해당)
  order_id        UUID REFERENCES print_orders(id) ON DELETE SET NULL,
  -- 토스트를 본 사용자
  viewer_user_id  UUID,
  is_self_recognition BOOLEAN NOT NULL DEFAULT false,
  product_slug    TEXT,
  page_path       TEXT,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 공유 이벤트 로그
CREATE TABLE IF NOT EXISTS print_share_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toast_id        TEXT NOT NULL,
  user_id         UUID,
  order_id        UUID REFERENCES print_orders(id) ON DELETE SET NULL,
  share_method    TEXT NOT NULL CHECK (share_method IN (
                    'image_download', 'kakao', 'url_copy', 'twitter'
                  )),
  utm_ref         TEXT,
  shared_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS print_social_proof_events_order_id_idx
  ON print_social_proof_events(order_id);
CREATE INDEX IF NOT EXISTS print_social_proof_events_viewer_idx
  ON print_social_proof_events(viewer_user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS print_social_proof_events_self_idx
  ON print_social_proof_events(viewer_user_id, is_self_recognition, viewed_at DESC);
CREATE INDEX IF NOT EXISTS print_share_events_user_idx
  ON print_share_events(user_id, shared_at DESC);

-- RLS: anon은 INSERT만 허용 (노출 로그), SELECT는 service_role만
ALTER TABLE print_social_proof_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insert social_proof_events"
  ON print_social_proof_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "service_role all social_proof_events"
  ON print_social_proof_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated select own social_proof_events"
  ON print_social_proof_events FOR SELECT
  TO authenticated
  USING (viewer_user_id = auth.uid());

CREATE POLICY "anon insert share_events"
  ON print_share_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "service_role all share_events"
  ON print_share_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
