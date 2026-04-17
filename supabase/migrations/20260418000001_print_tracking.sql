-- Phase 8: 배송 추적번호 컬럼 추가
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
