-- 프로모 코드 사용 이력 테이블
-- OMO-2390: 프로모션 DB migration 5종 중 5/5

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS print_promo_code_redemptions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id               UUID        NOT NULL
                          REFERENCES print_promo_codes(id) ON DELETE RESTRICT,
  -- print_orders.id 참조. FK 없이 UUID 저장 — 주문 취소 시에도 이력 보존
  order_id              UUID,
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  discount_amount_cents INT         NOT NULL CHECK (discount_amount_cents > 0),
  applied_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  print_promo_code_redemptions IS '프로모 코드 사용 이력. 중복 사용 방지 및 통계용.';
COMMENT ON COLUMN print_promo_code_redemptions.order_id IS 'print_orders.id 참조. FK 없이 저장하여 주문 취소 후에도 이력 보존.';
COMMENT ON COLUMN print_promo_code_redemptions.discount_amount_cents IS '실제 적용된 할인 금액 (센트). 상한 초과 시 max_discount_cents 값.';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_print_promo_redemptions_code_applied
  ON print_promo_code_redemptions (code_id, applied_at);

CREATE INDEX IF NOT EXISTS idx_print_promo_redemptions_order
  ON print_promo_code_redemptions (order_id);

CREATE INDEX IF NOT EXISTS idx_print_promo_redemptions_user
  ON print_promo_code_redemptions (user_id, code_id);

-- RLS: 완전 서비스롤 전용 (사용자 본인 조회도 API 레이어에서 처리)
ALTER TABLE print_promo_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promo_redemptions_service_role_all" ON print_promo_code_redemptions;
CREATE POLICY "print_promo_redemptions_service_role_all"
  ON print_promo_code_redemptions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 중복 사용 방지 함수: code_id + user_id 조합으로 per_user_max 체크
-- 실제 비즈니스 로직은 API 레이어(서버 액션)에서 트랜잭션으로 처리 권장
-- ============================================================

CREATE OR REPLACE FUNCTION print_check_promo_redemption_limit(
  p_code_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (
    SELECT COUNT(*) FROM print_promo_code_redemptions
    WHERE code_id = p_code_id AND user_id = p_user_id
  ) < (
    SELECT per_user_max FROM print_promo_codes WHERE id = p_code_id
  );
$$;

COMMENT ON FUNCTION print_check_promo_redemption_limit IS
  '사용자가 해당 코드를 per_user_max 내로 더 사용할 수 있으면 TRUE 반환.';

-- ============================================================
-- DOWN
-- DROP FUNCTION IF EXISTS print_check_promo_redemption_limit(UUID, UUID);
-- DROP TABLE IF EXISTS print_promo_code_redemptions CASCADE;
-- ============================================================
