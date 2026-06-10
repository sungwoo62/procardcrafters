-- OMO-2830: 발주 실원가 확정 후 마진 차이(원가 초과/마진 음수) 감지 시 기록할
-- 'margin_alert' 이벤트 타입 추가. 결제서에서 캡처한 실원가가 예상 대비 크게
-- 벗어나면 발주 러너가 이 이벤트를 남겨 타임라인/감사에 노출한다.

ALTER TABLE print_order_events DROP CONSTRAINT IF EXISTS print_order_events_event_type_check;
ALTER TABLE print_order_events ADD CONSTRAINT print_order_events_event_type_check CHECK (event_type IN (
  'status_change',
  'email_sent',
  'payment_received',
  'payment_failed',
  'fraud_alert',
  'file_uploaded',
  'file_approved',
  'file_rejected',
  'shipment_created',
  'shipment_label_created',
  'shipped',
  'delivered',
  'reorder',
  'email_bounced',
  'email_complained',
  'email_delivered',
  'margin_alert'
));
