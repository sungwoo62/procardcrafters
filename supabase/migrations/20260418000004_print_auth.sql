-- =============================================================
-- Phase 13: 사용자 인증 연동 — print_orders user_id 추가
-- =============================================================

-- print_orders에 user_id 컬럼 추가 (nullable: 비회원 주문 지원)
ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_print_orders_user_id ON print_orders(user_id);

-- 인증된 사용자가 자신의 주문을 조회할 수 있는 RLS 정책 추가
CREATE POLICY "print_orders_owner_select"
  ON print_orders FOR SELECT
  USING (auth.uid() = user_id);

-- 인증된 사용자가 주문 생성 시 user_id 자동 설정 허용
CREATE POLICY "print_orders_auth_insert"
  ON print_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- print_order_items: 소유자 조회 허용 (order를 통해)
CREATE POLICY "print_order_items_owner_select"
  ON print_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM print_orders
      WHERE print_orders.id = print_order_items.order_id
        AND print_orders.user_id = auth.uid()
    )
  );

-- print_files: 소유자 조회 허용 (order를 통해)
CREATE POLICY "print_files_owner_select"
  ON print_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM print_orders
      WHERE print_orders.id = print_files.order_id
        AND print_orders.user_id = auth.uid()
    )
  );
