-- =============================================================
-- Procardcrafters (procardcrafters.com) - print_ prefix 스키마
-- 공유 Supabase 프로젝트(ilcfemvqommqyoohfoxw)에 적용
-- =============================================================

-- 상품 카탈로그 (5종: business_cards, stickers, flyers, postcards, posters)
CREATE TABLE IF NOT EXISTS print_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ko TEXT,
  category TEXT NOT NULL CHECK (category IN ('business_cards', 'stickers', 'flyers', 'postcards', 'posters')),
  -- 성원애드피아 기준 단가 (KRW)
  base_price_krw NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- 마진 배율 (기본 3.3배)
  margin_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 3.3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 상품별 옵션 (수량, 용지, 코팅, 사이즈 등)
CREATE TABLE IF NOT EXISTS print_product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES print_products(id) ON DELETE CASCADE,
  option_type TEXT NOT NULL CHECK (option_type IN ('quantity', 'paper', 'coating', 'size', 'finish')),
  label_ko TEXT NOT NULL,
  label_en TEXT NOT NULL,
  value TEXT NOT NULL,
  -- 옵션별 추가 단가 (KRW, 성원 기준)
  extra_price_krw NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, option_type, value)
);

-- 주문
CREATE TABLE IF NOT EXISTS print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT 'PCCF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6)),
  -- 고객 정보
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  -- 배송 정보
  shipping_name TEXT NOT NULL,
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT,
  shipping_country TEXT NOT NULL DEFAULT 'US',
  shipping_postal_code TEXT NOT NULL,
  -- 금액 (USD)
  subtotal_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- 환율 정보 (주문 시점)
  exchange_rate_krw_usd NUMERIC(10, 4),
  -- 결제 정보 (Stripe)
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 주문 항목
CREATE TABLE IF NOT EXISTS print_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES print_products(id),
  product_name_ko TEXT NOT NULL,
  product_name_en TEXT NOT NULL,
  -- 선택된 옵션 (JSON)
  selected_options JSONB NOT NULL DEFAULT '{}',
  quantity INT NOT NULL DEFAULT 1,
  -- 단가 및 소계 (USD, 주문 시점 확정)
  unit_price_usd NUMERIC(12, 2) NOT NULL,
  subtotal_usd NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 업로드 파일 관리
CREATE TABLE IF NOT EXISTS print_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES print_orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES print_order_items(id) ON DELETE CASCADE,
  -- Supabase Storage 경로
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'approved', 'rejected', 'processing')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER print_products_updated_at
  BEFORE UPDATE ON print_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER print_orders_updated_at
  BEFORE UPDATE ON print_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_print_products_category ON print_products(category);
CREATE INDEX IF NOT EXISTS idx_print_products_is_active ON print_products(is_active);
CREATE INDEX IF NOT EXISTS idx_print_product_options_product_id ON print_product_options(product_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_status ON print_orders(status);
CREATE INDEX IF NOT EXISTS idx_print_orders_customer_email ON print_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_print_orders_created_at ON print_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_order_items_order_id ON print_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_print_files_order_id ON print_files(order_id);
