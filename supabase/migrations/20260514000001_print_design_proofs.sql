-- =============================================================
-- 시안확인 (Design Proof Confirmation) 테이블
-- 관리자가 시안을 업로드하면 고객이 확인/승인/수정요청
-- =============================================================

CREATE TABLE IF NOT EXISTS print_design_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  -- Supabase Storage 경로
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  -- 관리자 메모 (시안 설명)
  admin_note TEXT,
  -- 고객 응답 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revision_requested')),
  -- 고객 코멘트 (수정요청 시 사유)
  customer_comment TEXT,
  -- 시안 버전 (같은 주문에 여러 시안 가능)
  version INT NOT NULL DEFAULT 1,
  -- 업로드/응답 시각
  uploaded_by TEXT NOT NULL DEFAULT 'admin',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_print_design_proofs_order_id ON print_design_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_design_proofs_status ON print_design_proofs(status);
