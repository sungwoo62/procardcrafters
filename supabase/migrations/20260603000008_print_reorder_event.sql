-- print_order_events.event_type 체크에 'reorder' 추가
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
  'shipped',
  'delivered',
  'reorder'
));
