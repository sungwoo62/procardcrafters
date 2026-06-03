-- =============================================================
-- /api/files/upload 보안 강화 (OMO-2277)
-- 1. IP 기반 rate limit 테이블
-- 2. 원자적 카운트 증가 함수
-- 3. print_files에 file_hash 컬럼 추가 (중복 업로드 방지)
-- 4. Supabase Storage print-assets 버킷 직접 INSERT 차단
-- =============================================================

-- Rate limit 추적 테이블 (IP 해시 + 1분 윈도우)
CREATE TABLE IF NOT EXISTS print_upload_rate_limits (
  ip_hash      TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  upload_count INT         NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, window_start)
);

CREATE INDEX IF NOT EXISTS print_upload_rate_limits_window_idx
  ON print_upload_rate_limits(window_start);

-- 24h 이상 된 rate limit 레코드 자동 정리 (배치 삭제용 인덱스)
CREATE INDEX IF NOT EXISTS print_upload_rate_limits_expire_idx
  ON print_upload_rate_limits(window_start)
  WHERE window_start < NOW() - INTERVAL '1 day';

-- 원자적 카운트 증가 + 제한 초과 여부 반환
-- 반환값: true = 허용, false = 제한 초과
CREATE OR REPLACE FUNCTION increment_upload_rate_limit(
  p_ip_hash     TEXT,
  p_window_start TIMESTAMPTZ,
  p_limit       INT DEFAULT 5
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO print_upload_rate_limits (ip_hash, window_start, upload_count)
  VALUES (p_ip_hash, p_window_start, 1)
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET upload_count = print_upload_rate_limits.upload_count + 1
  RETURNING upload_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- print_files에 file_hash 컬럼 추가 (SHA-256, 중복 파일 재업로드 방지)
ALTER TABLE print_files
  ADD COLUMN IF NOT EXISTS file_hash TEXT;

CREATE INDEX IF NOT EXISTS print_files_file_hash_idx
  ON print_files(file_hash)
  WHERE file_hash IS NOT NULL;

-- RLS: print_upload_rate_limits는 service_role 전용
ALTER TABLE print_upload_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_upload_rate_limits_service_only"
  ON print_upload_rate_limits FOR ALL
  USING (auth.role() = 'service_role');

-- Storage RLS: print-assets 버킷에 anon/authenticated 직접 INSERT 차단
-- (service_role은 RLS 우회이므로 API 업로드는 그대로 동작)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'print_assets_deny_direct_insert'
  ) THEN
    CREATE POLICY "print_assets_deny_direct_insert" ON storage.objects
      FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id != 'print-assets');
  END IF;
END $$;
