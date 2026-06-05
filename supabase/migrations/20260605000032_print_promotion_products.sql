-- 프로모션 캠페인-상품 매핑 테이블
-- OMO-2390: 프로모션 DB migration 5종 중 3/5

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS print_promotion_products (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID        NOT NULL
                    REFERENCES print_promotion_campaigns(id) ON DELETE CASCADE,
  -- print_products.slug 참조 (FK 없이 slug 직접 저장 — 유연성 우선)
  product_slug    TEXT        NOT NULL,
  sort_order      INT         NOT NULL DEFAULT 0,
  custom_hero_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, product_slug)
);

COMMENT ON TABLE  print_promotion_products IS '캠페인에 포함된 상품 목록 + 노출 순서';
COMMENT ON COLUMN print_promotion_products.product_slug IS 'print_products.slug 참조. FK 없이 slug로 관리.';
COMMENT ON COLUMN print_promotion_products.custom_hero_url IS '캠페인 전용 상품 히어로 이미지. NULL이면 제품 기본 이미지 사용.';

CREATE INDEX IF NOT EXISTS idx_print_promo_products_campaign
  ON print_promotion_products (campaign_id, sort_order);

-- RLS: 캠페인 조인으로 live 여부 확인 — 단순화 위해 service_role 전용 + API 레이어에서 필터
ALTER TABLE print_promotion_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promotion_products_public_read" ON print_promotion_products;
CREATE POLICY "print_promotion_products_public_read"
  ON print_promotion_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM print_promotion_campaigns c
      WHERE c.id = campaign_id AND c.status = 'live'
    )
  );

DROP POLICY IF EXISTS "print_promotion_products_service_role_all" ON print_promotion_products;
CREATE POLICY "print_promotion_products_service_role_all"
  ON print_promotion_products FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- DOWN
-- DROP TABLE IF EXISTS print_promotion_products CASCADE;
-- ============================================================
