-- print_products에 is_bestseller + margin_pct 컬럼 추가
-- OMO-2392: 프로모션 엔진 tier-cap 강제에 필요

-- ============================================================
-- UP
-- ============================================================

ALTER TABLE print_products
  ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS margin_pct    NUMERIC(5,2);

COMMENT ON COLUMN print_products.is_bestseller IS '베스트셀러 플래그. TRUE이면 프로모 코드 할인 cap 10% 영구 적용.';
COMMENT ON COLUMN print_products.margin_pct IS '마진율 %. NULL=미설정. 25 미만이면 프로모 자동 제외.';

CREATE INDEX IF NOT EXISTS idx_print_products_bestseller
  ON print_products (is_bestseller) WHERE is_bestseller = TRUE;

-- ============================================================
-- DOWN
-- ALTER TABLE print_products DROP COLUMN IF EXISTS is_bestseller;
-- ALTER TABLE print_products DROP COLUMN IF EXISTS margin_pct;
-- ============================================================
