-- option_values 테이블에 용지 정보 컬럼 추가
ALTER TABLE option_values
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 기존 용지 옵션에 설명 업데이트
UPDATE option_values SET
  description = 'Smooth matte surface with excellent ink absorption. 250gsm gives solid rigidity for a professional finish.'
WHERE id = 'ov-art250';

UPDATE option_values SET
  description = 'Bright white surface with vibrant colour reproduction. 250gsm weight delivers a premium, crisp feel.'
WHERE id = 'ov-snow250';

UPDATE option_values SET
  description = 'Extra thick 300gsm stock for a truly premium, substantial card. Makes a lasting first impression.'
WHERE id = 'ov-prem300';

COMMENT ON COLUMN option_values.image_url IS '용지 질감 이미지 URL (Supabase Storage)';
COMMENT ON COLUMN option_values.description IS '용지 특성 설명 (팝업 표시용)';
