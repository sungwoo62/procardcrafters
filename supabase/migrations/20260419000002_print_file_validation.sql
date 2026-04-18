-- 파일 검증 결과 컬럼 추가
ALTER TABLE print_files
  ADD COLUMN IF NOT EXISTS validation_result JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT DEFAULT NULL;

-- 검증 경고가 있는 파일 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_print_files_status ON print_files(status);

COMMENT ON COLUMN print_files.validation_result IS '자동 파일 검증 결과 (색상공간, 블리드, DPI 등)';
COMMENT ON COLUMN print_files.reviewed_at IS '관리자 검토 완료 시간';
COMMENT ON COLUMN print_files.reviewed_by IS '검토자 이름';
