-- print_orders 테이블에 고객이 선택한 배송 서비스 정보 저장
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS shipping_service_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_service_name_en TEXT;
