-- OMO-2807: 메달 견적(주문) 자동응답 이메일 하드바운스 캡처
-- OMO-2799 후속(인프라). 포맷 검증으로 못 잡는 실제 하드바운스(예: 550 5.1.1 NoSuchUser)를
-- Resend 수신 웹훅(email.bounced/email.complained/email.delivered)으로 비동기 캡처한다.
--
-- 이 리포는 별도 quotes 테이블 대신 print_orders 로 주문/견적을 관리하고
-- 자동응답('Order Received') 이메일을 발송한다. 따라서 바운스 상태도 print_orders 에 기록한다.

-- 1) 자동응답 이메일 상태/바운스 사유 컬럼
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS auto_response_email_id TEXT,            -- 발송 시 Resend 메시지 id (바운스 상관용 키)
  ADD COLUMN IF NOT EXISTS email_status           TEXT,            -- null | 'sent' | 'delivered' | 'bounced' | 'complained'
  ADD COLUMN IF NOT EXISTS email_bounce_reason     TEXT,           -- 바운스/불만 상세 (예: 550 5.1.1 NoSuchUser)
  ADD COLUMN IF NOT EXISTS email_bounced_at        TIMESTAMPTZ;    -- 바운스/불만 수신 시각

-- 웹훅이 Resend email_id 로 주문을 역조회한다.
CREATE INDEX IF NOT EXISTS print_orders_auto_response_email_id_idx
  ON print_orders (auto_response_email_id);

-- 2) print_order_events.event_type 에 바운스/불만/전달 이벤트 추가
--    (기존 값 13종 모두 보존 + 신규 3종)
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
  'email_delivered'
));
