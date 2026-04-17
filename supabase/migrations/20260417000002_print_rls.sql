-- =============================================================
-- RLS 정책 - print_ 테이블
-- =============================================================

-- print_products: 공개 읽기, 관리자만 쓰기
ALTER TABLE print_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_products_public_read"
  ON print_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "print_products_admin_all"
  ON print_products FOR ALL
  USING (auth.role() = 'service_role');

-- print_product_options: 공개 읽기, 관리자만 쓰기
ALTER TABLE print_product_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_product_options_public_read"
  ON print_product_options FOR SELECT
  USING (true);

CREATE POLICY "print_product_options_admin_all"
  ON print_product_options FOR ALL
  USING (auth.role() = 'service_role');

-- print_orders: 비인증 사용자도 생성 가능 (비회원 주문 지원)
-- 조회는 이메일 기반 (비회원) 또는 service_role
ALTER TABLE print_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_orders_insert_anon"
  ON print_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "print_orders_admin_all"
  ON print_orders FOR ALL
  USING (auth.role() = 'service_role');

-- print_order_items: 관리자만 직접 접근 (API 경유)
ALTER TABLE print_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_order_items_admin_all"
  ON print_order_items FOR ALL
  USING (auth.role() = 'service_role');

-- print_files: 업로드 허용, 조회는 service_role만
ALTER TABLE print_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_files_insert_anon"
  ON print_files FOR INSERT
  WITH CHECK (true);

CREATE POLICY "print_files_admin_all"
  ON print_files FOR ALL
  USING (auth.role() = 'service_role');
