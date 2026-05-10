-- Phase 7: PayPal 결제 연동 - print_orders 컬럼 추가
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
