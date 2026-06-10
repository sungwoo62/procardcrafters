-- OMO-2830: 발주시점 실원가 저장 — 주문 교차검증 마진 정확도 향상
--
-- 배경: print_factory_orders 는 발주 스펙/수량/상태만 기록하고 우리가 성원애드피아에
--       실제 지불한 금액(원가)을 저장하지 않았다. 교차검증 패널의 마진 계산이
--       추정값(base_price_krw 마스터 또는 판매가÷margin_multiplier)에 의존 →
--       옵션별 실 단가·성원 가격변동·실제 청구액을 반영하지 못함.
--
-- 결정(OMO-2830 보드): 발주시점 실원가를 저장하는 하이브리드.
--   - 발주 전: base_price_krw 기반 추정 원가 표시(프리뷰)
--   - 발주 후: 운영자가 성원 결제금액(KRW)을 입력 → actual_cost_usd 스냅샷 저장
--   - 패널은 실원가가 있으면 실원가 기준 마진, 없으면 추정 기준으로 폴백
--
-- 단일 서비스(print_) 테이블, 기존 행 영향 없음(전부 NULL 허용 추가 컬럼).

ALTER TABLE print_factory_orders
  ADD COLUMN IF NOT EXISTS actual_cost_krw  NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS actual_cost_usd  NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS cost_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cost_recorded_by TEXT;

COMMENT ON COLUMN print_factory_orders.actual_cost_krw  IS 'OMO-2830: 성원애드피아 실 결제금액(KRW). 운영자 입력.';
COMMENT ON COLUMN print_factory_orders.actual_cost_usd  IS 'OMO-2830: 기록 시점 환율로 환산한 실원가(USD) 스냅샷.';
COMMENT ON COLUMN print_factory_orders.cost_recorded_at IS 'OMO-2830: 실원가 기록 일시.';
COMMENT ON COLUMN print_factory_orders.cost_recorded_by IS 'OMO-2830: 실원가 기록자(관리자 이메일).';
