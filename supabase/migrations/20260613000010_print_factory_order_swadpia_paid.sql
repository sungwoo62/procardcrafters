-- OMO-3018: 성원애드피아 발주 결제완료(swadpia_paid) 추적
--
-- 배경: 발주 폼 제출(status='placed')은 "성원에 발주는 들어갔으나 사장님이 아직 결제 안 함"
-- 상태다(checkout_url 에 결제 대기). 사장님이 하루 1~2회 성원에서 결제까지 완료하면
-- 그 사실을 시스템이 추적해야 한다. 이를 위해 'paid' 상태 + 결제완료 시각/주체를 추가한다.
--
-- 상태 흐름: pending → placing → placed(발주됨·미결제) → paid(성원 결제완료)

ALTER TABLE print_factory_orders
  DROP CONSTRAINT IF EXISTS print_factory_orders_status_check;

ALTER TABLE print_factory_orders
  ADD CONSTRAINT print_factory_orders_status_check
  CHECK (status IN ('pending', 'placing', 'placed', 'paid', 'failed', 'cancelled'));

ALTER TABLE print_factory_orders
  ADD COLUMN IF NOT EXISTS swadpia_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS swadpia_paid_by TEXT;

-- 결제 대기(placed·미결제) 발주를 빠르게 조회하기 위한 부분 인덱스
-- (사장님 일일 결제 체크리스트 / 리컨실 크론에서 사용)
CREATE INDEX IF NOT EXISTS print_factory_orders_awaiting_payment_idx
  ON print_factory_orders (placed_at)
  WHERE status = 'placed';

COMMENT ON COLUMN print_factory_orders.swadpia_paid_at IS
  'OMO-3018: 성원애드피아에서 발주 결제를 완료한 시각. NULL이면 미결제(placed).';
COMMENT ON COLUMN print_factory_orders.swadpia_paid_by IS
  'OMO-3018: 성원 결제완료 표시 주체(관리자 이메일 또는 reconcile 자동화).';
