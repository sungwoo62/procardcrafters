-- 용지 옵션에 질감 이미지 URL 컬럼 추가
ALTER TABLE print_product_options
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN print_product_options.image_url IS
  '용지 질감 이미지 URL. Supabase Storage paper-textures 버킷 또는 외부 CDN URL.';
