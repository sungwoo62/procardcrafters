-- OMO-2371: FedEx 자동 생성 Commercial Invoice PDF 저장 경로
-- ETD (Electronic Trade Documents) 통관 신속 처리 — 발송 시 invoice 가 함께 생성됨.

ALTER TABLE print_shipments
  ADD COLUMN IF NOT EXISTS invoice_storage_path TEXT;

-- 라벨 발급 이벤트 추가
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
  'reorder'
));
