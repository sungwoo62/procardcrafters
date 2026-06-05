-- 프로모 코드 테이블
-- OMO-2390: 프로모션 DB migration 5종 중 4/5
-- 코드 자동 생성 헬퍼(printpromo_<season>_<year>_<random4>)는 OMO-2388-B/C에서 구현

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS print_promo_codes (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- campaign_id NULL = 캠페인 비종속 상시 코드
  campaign_id         UUID          REFERENCES print_promotion_campaigns(id) ON DELETE SET NULL,
  code                TEXT          NOT NULL UNIQUE,
  discount_pct        NUMERIC(5,2)  NOT NULL
                        CHECK (discount_pct > 0 AND discount_pct <= 100),
  discount_tier       TEXT          NOT NULL DEFAULT 'standard'
                        CHECK (discount_tier IN ('top', 'standard', 'always_on', 'bestseller')),
  min_order_cents     INT           NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
  max_discount_cents  INT           CHECK (max_discount_cents IS NULL OR max_discount_cents > 0),
  valid_from          TIMESTAMPTZ   NOT NULL,
  valid_until         TIMESTAMPTZ   NOT NULL,
  max_uses            INT           CHECK (max_uses IS NULL OR max_uses > 0),
  per_user_max        INT           NOT NULL DEFAULT 1 CHECK (per_user_max > 0),
  status              TEXT          NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'locked', 'expired')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_valid_range CHECK (valid_until > valid_from)
);

COMMENT ON TABLE  print_promo_codes IS '프로모 코드. printpromo_<season>_<year>_<rnd4> 패턴 권장.';
COMMENT ON COLUMN print_promo_codes.discount_pct IS '할인율 (%). ex) 15.00 = 15%';
COMMENT ON COLUMN print_promo_codes.discount_tier IS 'top=최고할인, standard=기본, always_on=상시, bestseller=베스트셀러 특별';
COMMENT ON COLUMN print_promo_codes.min_order_cents IS '최소 주문금액 (센트 단위). 0=제한없음.';
COMMENT ON COLUMN print_promo_codes.max_discount_cents IS '최대 할인금액 (센트 단위). NULL=상한없음.';
COMMENT ON COLUMN print_promo_codes.max_uses IS '전체 사용 한도. NULL=무제한.';
COMMENT ON COLUMN print_promo_codes.per_user_max IS '사용자당 사용 횟수 한도. 기본 1회.';
COMMENT ON COLUMN print_promo_codes.status IS 'active=사용가능, locked=잠금(일시정지), expired=만료';

-- 자동 updated_at
DROP TRIGGER IF EXISTS print_promo_codes_updated_at ON print_promo_codes;
CREATE TRIGGER print_promo_codes_updated_at
  BEFORE UPDATE ON print_promo_codes
  FOR EACH ROW EXECUTE FUNCTION print_set_updated_at();

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_promo_codes_code
  ON print_promo_codes (code);

CREATE INDEX IF NOT EXISTS idx_print_promo_codes_code_status
  ON print_promo_codes (code, status);

CREATE INDEX IF NOT EXISTS idx_print_promo_codes_campaign
  ON print_promo_codes (campaign_id);

CREATE INDEX IF NOT EXISTS idx_print_promo_codes_valid_range
  ON print_promo_codes (valid_from, valid_until) WHERE status = 'active';

-- RLS: active 코드만 공개 읽기 (검증용), 관리는 service_role
ALTER TABLE print_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promo_codes_public_active" ON print_promo_codes;
CREATE POLICY "print_promo_codes_public_active"
  ON print_promo_codes FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "print_promo_codes_service_role_all" ON print_promo_codes;
CREATE POLICY "print_promo_codes_service_role_all"
  ON print_promo_codes FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- DOWN
-- DROP TABLE IF EXISTS print_promo_codes CASCADE;
-- ============================================================
