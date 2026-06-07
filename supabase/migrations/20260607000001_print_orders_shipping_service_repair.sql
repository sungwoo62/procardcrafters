-- OMO-2567 repair: 20260605000005가 마이그레이션 히스토리엔 적용됨으로 기록됐으나
-- 실제 prod print_orders 테이블엔 컬럼이 누락되어 주문 INSERT가 500으로 실패함.
-- 멱등 재적용 + PostgREST 스키마 캐시 리로드.
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS shipping_service_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_service_name_en TEXT;
NOTIFY pgrst, 'reload schema';
