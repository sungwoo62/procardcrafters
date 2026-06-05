-- OMO-2422 (OMO-2411 #2): print_orders 컴플리멘터리(베타 무상) 컬럼 + 안전선
--
-- 베타 테스터 선정 시 어드민이 /admin/beta-applications 큐에서 "comp 주문 생성" 클릭.
-- 이 마이그레이션은 멱등(IF NOT EXISTS / DO 블록)으로, 기존 환경에 안전하게 적용된다.
--
-- 정지선 (보드 승인 2026-06-05):
--   1. is_complimentary=TRUE 인 행은 total_amount=0, payment_status='comp', 할인 0.
--   2. 일반 주문은 payment_status='comp' 로 우회 금지 (오직 is_complimentary 경로만).
--   3. 동일 이메일 fulfilled 2회 차단은 print_beta_applications.email LOWER unique 로 이미 보장.

-- 1) 결제 추적 / 고객 정보 컬럼 보강 (멱등) -------------------------------------------------
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS customer_name    TEXT,
  ADD COLUMN IF NOT EXISTS customer_email   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address JSONB,
  ADD COLUMN IF NOT EXISTS total_amount     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount   NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_discount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status   TEXT    NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS site             TEXT    NOT NULL DEFAULT 'procardcrafters';

-- 2) 베타 컴플리멘터리 컬럼 -------------------------------------------------------------------
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS complimentary_application_id UUID
    REFERENCES print_beta_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_print_orders_complimentary_app
  ON print_orders (complimentary_application_id)
  WHERE complimentary_application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_print_orders_is_complimentary_created
  ON print_orders (created_at DESC)
  WHERE is_complimentary = TRUE;

-- 3) payment_status CHECK 재정의 (기존 CHECK 제거 후 'comp' 추가한 신규 enum 적용) ---------
DO $$
DECLARE
  cons RECORD;
BEGIN
  FOR cons IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'print_orders'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
       AND pg_get_constraintdef(oid) NOT ILIKE '%complimentary%'
  LOOP
    EXECUTE format('ALTER TABLE print_orders DROP CONSTRAINT %I', cons.conname);
  END LOOP;
END $$;

ALTER TABLE print_orders
  ADD CONSTRAINT print_orders_payment_status_check
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'comp', 'complimentary'));

-- 4) 컴플리멘터리 무결성 CHECK (정지선) -------------------------------------------------------
--   - 무상 주문은 total_amount=0, payment_status='comp'|'complimentary', 모든 할인 0.
--   - 일반 주문은 payment_status='comp'|'complimentary' 사용 금지 (우회 차단).
ALTER TABLE print_orders
  DROP CONSTRAINT IF EXISTS print_orders_complimentary_invariants;

ALTER TABLE print_orders
  ADD CONSTRAINT print_orders_complimentary_invariants
    CHECK (
      (is_complimentary = TRUE
        AND total_amount = 0
        AND payment_status IN ('comp', 'complimentary')
        AND COALESCE(promo_discount, 0) = 0
        AND COALESCE(coupon_discount, 0) = 0)
      OR
      (is_complimentary = FALSE
        AND payment_status NOT IN ('comp', 'complimentary'))
    );

-- 5) 코멘트 ------------------------------------------------------------------------------------
COMMENT ON COLUMN print_orders.is_complimentary
  IS 'OMO-2422 베타 무상 주문 여부. TRUE 인 경우 total=0 / payment=comp / 할인 0 강제.';
COMMENT ON COLUMN print_orders.complimentary_application_id
  IS 'OMO-2422 어드민이 print_beta_applications 큐에서 승인할 때 채우는 FK.';
COMMENT ON COLUMN print_orders.payment_status
  IS 'unpaid | paid | refunded | comp | complimentary (comp 는 베타 무상 전용)';
