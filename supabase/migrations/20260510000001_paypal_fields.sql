-- Phase 7: PayPal payment integration - add columns to print_orders
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
