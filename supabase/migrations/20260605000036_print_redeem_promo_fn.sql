-- 원자적 프로모 코드 redemption 함수
-- OMO-2392: race condition 방지 — SELECT FOR UPDATE + INSERT in single txn

-- ============================================================
-- UP
-- ============================================================

CREATE OR REPLACE FUNCTION print_redeem_promo_code(
  p_code_id             UUID,
  p_order_id            UUID,
  p_user_id             UUID,
  p_discount_amount_cents INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code        print_promo_codes%ROWTYPE;
  v_use_count   INT;
  v_user_count  INT;
  v_redemption  print_promo_code_redemptions%ROWTYPE;
BEGIN
  -- 코드 행 잠금 (concurrent 요청 직렬화)
  SELECT * INTO v_code
    FROM print_promo_codes
    WHERE id = p_code_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'code_not_found');
  END IF;

  -- status 재확인
  IF v_code.status <> 'active' THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'code_not_active');
  END IF;

  -- max_uses 체크
  IF v_code.max_uses IS NOT NULL THEN
    SELECT COUNT(*) INTO v_use_count
      FROM print_promo_code_redemptions
      WHERE code_id = p_code_id;
    IF v_use_count >= v_code.max_uses THEN
      RETURN jsonb_build_object('ok', FALSE, 'reason', 'max_uses_exceeded');
    END IF;
  END IF;

  -- per_user_max 체크
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_count
      FROM print_promo_code_redemptions
      WHERE code_id = p_code_id AND user_id = p_user_id;
    IF v_user_count >= v_code.per_user_max THEN
      RETURN jsonb_build_object('ok', FALSE, 'reason', 'per_user_max_exceeded');
    END IF;
  END IF;

  -- redemption 삽입
  INSERT INTO print_promo_code_redemptions
    (code_id, order_id, user_id, discount_amount_cents)
  VALUES
    (p_code_id, p_order_id, p_user_id, p_discount_amount_cents)
  RETURNING * INTO v_redemption;

  RETURN jsonb_build_object(
    'ok',           TRUE,
    'redemption_id', v_redemption.id,
    'applied_at',   v_redemption.applied_at
  );
END;
$$;

COMMENT ON FUNCTION print_redeem_promo_code IS
  '프로모 코드 원자적 사용 처리. SELECT FOR UPDATE로 race condition 방지.';

-- ============================================================
-- DOWN
-- DROP FUNCTION IF EXISTS print_redeem_promo_code(UUID, UUID, UUID, INT);
-- ============================================================
