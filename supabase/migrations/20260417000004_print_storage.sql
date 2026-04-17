-- =============================================================
-- Procardcrafters - Storage Bucket & 정책 설정
-- print-assets 버킷: 인쇄 파일 보관
-- =============================================================

-- Storage 버킷 생성 (Supabase Dashboard에서 수동 생성이 필요할 수 있음)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('print-assets', 'print-assets', false)
-- ON CONFLICT (id) DO NOTHING;

-- 서버 사이드(service_role)는 모든 작업 허용 (RLS 우회)
-- 아래는 anon/authenticated 접근 정책 예시 (현재는 서버 전용이므로 미적용)

-- 주문 완료 후 운영자만 파일 조회 가능하도록 RLS 강화 필요 시 아래 참조:
-- CREATE POLICY "운영자 파일 조회" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'print-assets');
