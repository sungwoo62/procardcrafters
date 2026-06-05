-- OMO-2407: print_reviews photos JSONB 컬럼 추가
-- 리뷰 작성 시 사진 URL 배열 저장 (최대 5장)
ALTER TABLE print_reviews
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;
